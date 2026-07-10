'use strict'
/**
 * スキル考慮の拡張 strategist 探索プローブ。
 *
 * 標準の searchStrategistBuild との違い:
 *   1. 装備候補 = 素ステ top-8 ＋「主要新スキルごとに最良の1品」(支援系レアを候補に含める)
 *   2. tail(非探索スロットの貪欲充填)も 素ステ＋スキル価値 の合成スコアで選ぶ
 *   3. ビルド探索を対象Tier×代表レベルで行う(標準は最初の呼び出し=Lv3×先頭Tierで探索)
 *
 * 実行: node scripts/balance/probeOptimalBuild.js <areaId> <tier> [searchLevel=150]
 * 出力: 見つけた最適ビルド(ジョブ/隊列/装備/新スキル)と、LEVEL_GRID の閾値(成功率80%)
 */
// headless モジュールは同階層の headless/ を参照
require('./headless/runtime')
const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
const { suppressEngineLogs } = require('./headless/runtime')
const { deriveObtainablePool } = require('./headless/obtainablePool')
const { deriveBreedingPool, isStrategicallyObtainable } = require('./headless/breedingPool')
const { getAvailableJobs, JOB_ROLE, buildStrategistParty } = require('./headless/strategistLayer')
const { equipmentPowerScore } = require('./headless/personas')
const { extractExpeditionMetrics, aggregateMetrics } = require('./headless/metrics')
const { calculateSlotCount } = require('@/shared/data/equipmentConfig')
const { getEquipmentTemplate } = require('@/shared/data/equipmentPoolLoader')

const SUCCESS_TH = 80
const THRESH_SEEDS = 20
const SIZE = 6
const LEVEL_GRID = [3, 5, 8, 10, 13, 16, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 180, 220, 260, 300]

// 探索パラメータ(標準: seeds5/cap4/slots3/starts3/iters12)
const CFG = { seeds: 5, maxSlots: 3, starts: 3, maxIters: 12 }

// 主要新スキルの価値ヒューリスティック(候補選定・tail用。最終評価は実シミュ)
const SKILL_VALUE = {
  war_cry_1_3: 30, war_cry_1_2: 18,
  ward_physical_3: 24, ward_physical_2: 12, ward_magic_3: 20, ward_magic_2: 10,
  party_heal_regen_20: 22, party_heal_regen_10: 10,
  frost_nova_t4: 24, lifesteal_12: 16, lifesteal_8: 8, lifesteal_5: 4,
  battle_fervor_6: 14, battle_fervor_4: 7, mana_surge_6: 12, mana_surge_4: 6,
  crit_guard_50: 10, crit_guard_30: 5, pierce_guard_50: 10, pierce_guard_30: 5,
  action_order_200: 12, pursuit_30: 8, mighty_blow_180: 10, deadeye_200: 8,
  bulwark_stance_30: 6, mystic_stance_30: 6, spell_siphon_30: 8,
  hp_degen_10: -12, hp_degen_5: -6,
}
function skillValue(templateId) {
  const t = getEquipmentTemplate(templateId)
  if (!t) return 0
  let v = 0
  for (const s of t.grantedSkills || []) v += SKILL_VALUE[s.id] ?? 0
  return v
}
const combinedScore = id => equipmentPowerScore(id) + 3 * skillValue(id)

function makeRng(seedStr) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296 }
}

async function runExpedition(areaId, tier, party, seed) {
  const engine = new ExpeditionEngine(seed)
  return suppressEngineLogs(() => engine.generateExpedition(
    { partyId: 'probe', areaId, tier, returnPolicy: 'never', clientVersion: 'probe' },
    party.map(g => ({ ...g, currentHp: undefined })),
  ))
}
const simulate = (areaId) => async (party, tier, seed) =>
  extractExpeditionMetrics(await runExpedition(areaId, tier, party, seed))

async function main() {
  const areaId = process.argv[2]
  const tier = Number(process.argv[3])
  const searchLevel = Number(process.argv[4] || 150)
  const sim = simulate(areaId)

  // --- 候補構築 -------------------------------------------------------------
  const pool = deriveObtainablePool(areaId)
  const rankedByStat = [...pool.equipmentTemplateIds].sort((a, b) => {
    const d = equipmentPowerScore(b) - equipmentPowerScore(a)
    return d !== 0 ? d : a < b ? -1 : 1
  })
  const rankedCombined = [...pool.equipmentTemplateIds].sort((a, b) => {
    const d = combinedScore(b) - combinedScore(a)
    return d !== 0 ? d : a < b ? -1 : 1
  })
  // 主要新スキルごとに最良1品
  const bestPerSkill = new Map()
  for (const id of pool.equipmentTemplateIds) {
    const t = getEquipmentTemplate(id)
    for (const s of (t && t.grantedSkills) || []) {
      if (!(s.id in SKILL_VALUE) || SKILL_VALUE[s.id] <= 0) continue
      const cur = bestPerSkill.get(s.id)
      if (!cur || combinedScore(id) > combinedScore(cur)) bestPerSkill.set(s.id, id)
    }
  }
  const equipCandidates = [...new Set([...rankedByStat.slice(0, 8), ...bestPerSkill.values()])]

  const jobs = getAvailableJobs(areaId)
  const byRole = { tank: [], dps: [], skirmisher: [], caster: [], healer: [] }
  for (const j of jobs) { const r = JOB_ROLE[j]; if (r && byRole[r.role]) byRole[r.role].push(j) }
  const bp = deriveBreedingPool(areaId)
  const variants = bp.variants
    .filter(v => v.accessibility !== 'unavailable' && isStrategicallyObtainable(v.accessibility, bp.strategicThreshold))
    .map(v => ({ id: v.id, raceId: v.statTraits.raceId }))
  const hasVariants = variants.length > 0
  const jobChoices = [null, ...jobs]

  const slotCount = calculateSlotCount(searchLevel)
  const optimizedSlots = Math.min(slotCount, CFG.maxSlots)

  console.error(`[probe] ${areaId} T${tier} searchLevel=${searchLevel} slots=${slotCount}(opt${optimizedSlots}) cands=${equipCandidates.length} jobs=[${jobs.join(',')}] variants=${variants.length}`)

  // --- build 表現(personas.js searchStrategistBuild と同型) -----------------
  const makeJobMember = (jobId, loadout) => ({ kind: 'job', jobId: jobId ?? null, variant: null, raceId: null, loadout: [...loadout] })
  const makeVariantMember = (v, loadout) => ({ kind: 'variant', jobId: null, variant: v.id, raceId: v.raceId, loadout: [...loadout] })
  const cloneMember = m => ({ ...m, loadout: [...m.loadout] })
  const cloneBuild = b => ({ members: b.members.map(cloneMember), frontCount: b.frontCount })

  // tail は合成スコア順(optimized 装備との重複を除外して密に充填)
  function buildCompFromBuild(build, atLevel) {
    const sc = calculateSlotCount(atLevel)
    const os = Math.min(sc, CFG.maxSlots)
    const members = build.members.map(m => {
      const optimized = m.loadout.slice(0, os)
      const used = new Set(optimized)
      const tail = rankedCombined.filter(id => !used.has(id)).slice(0, Math.max(0, sc - optimized.length))
      const full = [...optimized, ...tail].slice(0, sc)
      if (m.kind === 'variant') return { raceId: m.raceId, variant: m.variant, factors: [m.variant], loadout: full }
      return { jobId: m.jobId ?? null, loadout: full }
    })
    return { frontCount: build.frontCount, members }
  }

  const seeds = []
  for (let s = 1; s <= CFG.seeds; s++) seeds.push(s)
  const scoreMemo = new Map()
  const memberSig = m => m.kind === 'variant' ? `V:${m.variant}:${m.loadout.join('.')}` : `J:${m.jobId}:${m.loadout.join('.')}`
  const buildSig = b => b.members.map(memberSig).join('|') + `#${b.frontCount}`
  async function scoreOf(build) {
    const sig = buildSig(build)
    if (scoreMemo.has(sig)) return scoreMemo.get(sig)
    const party = buildStrategistParty({ level: searchLevel, size: SIZE, comp: buildCompFromBuild(build, searchLevel) })
    const per = []
    for (const seed of seeds) per.push(await sim(party, tier, seed))
    const agg = aggregateMetrics(per)
    const s = agg ? agg.progressScore : 0
    scoreMemo.set(sig, s)
    return s
  }

  const defaultFront = Math.max(1, Math.min(SIZE - 1, Math.ceil(SIZE / 2)))
  const defaultJobFor = isFront => isFront
    ? (byRole.tank[0] ?? byRole.dps[0] ?? byRole.skirmisher[0] ?? jobs[0] ?? null)
    : (byRole.healer[0] ?? byRole.caster[0] ?? byRole.dps[0] ?? jobs[0] ?? null)

  const topCombined = rankedCombined.slice(0, optimizedSlots)
  const topStat = rankedByStat.slice(0, optimizedSlots)
  function curated(loadout) {
    const frontOrder = [...byRole.tank, ...byRole.dps, ...byRole.skirmisher]
    const backOrder = [...byRole.healer, ...byRole.caster]
    const members = []
    for (let i = 0; i < SIZE; i++) {
      const isFront = i < defaultFront
      const pref = isFront ? frontOrder : backOrder
      const alt = isFront ? backOrder : frontOrder
      let jobId = null
      if (jobs.length > 0) {
        const seq = pref.length ? pref : alt
        jobId = seq.length ? seq[(isFront ? i : i - defaultFront) % seq.length] : jobs[0]
      }
      members.push(makeJobMember(jobId, loadout))
    }
    return { members, frontCount: defaultFront }
  }
  function makeInitialBuild(idx) {
    if (idx === 0) return curated(topCombined)
    if (idx === 1) return curated(topStat)
    const rng = makeRng(`${areaId}:probe:${idx}`)
    const pick = () => equipCandidates[Math.floor(rng() * equipCandidates.length)]
    const members = []
    for (let i = 0; i < SIZE; i++) {
      const loadout = []
      for (let s = 0; s < optimizedSlots; s++) loadout.push(pick())
      const useVariant = hasVariants && rng() < 0.4
      if (useVariant) members.push(makeVariantMember(variants[Math.floor(rng() * variants.length)], loadout))
      else members.push(makeJobMember(jobChoices[Math.floor(rng() * jobChoices.length)], loadout))
    }
    return { members, frontCount: 1 + Math.floor(rng() * (SIZE - 1)) }
  }

  function neighbors(build) {
    const out = []
    for (let i = 0; i < build.members.length; i++) {
      const m = build.members[i]
      const isFront = i < build.frontCount
      if (m.kind === 'job' && hasVariants) {
        const nb = cloneBuild(build); nb.members[i] = makeVariantMember(variants[0], m.loadout); out.push(nb)
      } else if (m.kind === 'variant') {
        const nb = cloneBuild(build); nb.members[i] = makeJobMember(defaultJobFor(isFront), m.loadout); out.push(nb)
      }
      if (m.kind === 'job') {
        for (const jc of jobChoices) {
          if (jc === m.jobId) continue
          const nb = cloneBuild(build); nb.members[i] = makeJobMember(jc, m.loadout); out.push(nb)
        }
      }
      if (m.kind === 'variant') {
        for (const v of variants) {
          if (v.id === m.variant) continue
          const nb = cloneBuild(build); nb.members[i] = makeVariantMember(v, m.loadout); out.push(nb)
        }
      }
      const maxSlot = Math.min(optimizedSlots - 1, m.loadout.length)
      for (let slot = 0; slot <= maxSlot; slot++) {
        for (const cand of equipCandidates) {
          if (m.loadout[slot] === cand) continue
          const nb = cloneBuild(build)
          const arr = nb.members[i].loadout
          if (slot < arr.length) arr[slot] = cand; else arr.push(cand)
          out.push(nb)
        }
        if (slot < m.loadout.length) {
          const nb = cloneBuild(build)
          nb.members[i].loadout = m.loadout.filter((_, k) => k !== slot)
          out.push(nb)
        }
      }
    }
    for (let i = 0; i < build.members.length - 1; i++) {
      const nb = cloneBuild(build)
      const t = nb.members[i]; nb.members[i] = nb.members[i + 1]; nb.members[i + 1] = t
      out.push(nb)
    }
    for (const delta of [-1, 1]) {
      const fc = build.frontCount + delta
      if (fc >= 1 && fc <= SIZE - 1) { const nb = cloneBuild(build); nb.frontCount = fc; out.push(nb) }
    }
    return out
  }

  async function hillClimb(start) {
    let cur = start
    let curScore = await scoreOf(cur)
    for (let it = 0; it < CFG.maxIters; it++) {
      let bestNb = null, bestScore = curScore
      for (const nb of neighbors(cur)) {
        const s = await scoreOf(nb)
        if (s > bestScore + 1e-9) { bestScore = s; bestNb = nb }
      }
      if (!bestNb) break
      cur = bestNb; curScore = bestScore
      console.error(`[probe]   iter${it} score=${curScore.toFixed(3)}`)
    }
    return { build: cur, score: curScore }
  }

  let best = null
  for (let s = 0; s < CFG.starts; s++) {
    console.error(`[probe] start ${s}`)
    const res = await hillClimb(makeInitialBuild(s))
    if (!best || res.score > best.score) best = res
  }

  // --- 閾値スキャン(成功率80% / 20 seeds) -----------------------------------
  let threshold = null
  const scanRows = []
  for (const L of LEVEL_GRID) {
    const party = buildStrategistParty({ level: L, size: SIZE, comp: buildCompFromBuild(best.build, L) })
    const per = []
    for (let s = 1; s <= THRESH_SEEDS; s++) per.push(await sim(party, tier, s))
    const agg = aggregateMetrics(per)
    scanRows.push({ level: L, success: agg.successRate * 100, progress: agg.progressScore })
    if (agg.successRate * 100 >= SUCCESS_TH) { threshold = L; break }
  }

  // --- 出力 -----------------------------------------------------------------
  const result = {
    areaId, tier, searchLevel,
    searchScore: best.score,
    thresholdLevel: threshold, // null = >300
    scan: scanRows,
    build: best.build.members.map((m, i) => {
      const comp = buildCompFromBuild(best.build, threshold ?? searchLevel)
      const loadout = comp.members[i].loadout
      const newSkills = []
      for (const id of loadout) {
        const t = getEquipmentTemplate(id)
        for (const sk of (t && t.grantedSkills) || []) if (sk.id in SKILL_VALUE) newSkills.push(sk.id)
      }
      return {
        pos: i < best.build.frontCount ? 'front' : 'back',
        who: m.kind === 'variant' ? `variant:${m.variant}` : `job:${m.jobId ?? 'plain'}`,
        optimized: m.loadout.slice(0, optimizedSlots),
        newSkills: [...new Set(newSkills)],
      }
    }),
    frontCount: best.build.frontCount,
  }
  console.log(JSON.stringify(result, null, 1))
}

main().catch(e => { console.error(e && e.stack || e); process.exit(1) })
