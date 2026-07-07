'use strict'

/**
 * パーティ「ペルソナ」定義。
 *
 * ペルソナは「どんなパーティで測るか」を差し替え可能にする抽象。
 *   - floor  : 装備なし・因子なし・種族デフォルトスキル・デフォルト隊列（下限）
 *   - median : 到達時点で入手可能な装備プールから「中程度の一式」を決定論的に選ぶ
 *   - ceiling: 入手可能プール内を山登り法で進捗スコア最大化した準最適ビルド（上限）
 *
 * ペルソナ interface:
 *   {
 *     id: string,
 *     label: string,
 *     needsContext?: boolean,   // true なら buildParty に areaId / simulate 等が必要
 *     buildParty(ctx): Goblin[]  // ctx = { level, size, areaId?, tier?, tiers?, simulate?, options? }
 *   }
 * buildParty は決定論的（同一入力→同一パーティ）であること。common random numbers を保つため。
 * ceiling が使う疑似乱数も areaId 由来の固定 seed のみを用いる。
 */

// runtime を先に読み込んでおく（TS ローダ・エイリアス解決を有効化）
require('./runtime')

const { syncGoblinDerivedStats, calculateGoblinEffectiveStats } = require('@/shared/utils/goblinStats')
const { getDefaultSkillsForRace } = require('@/shared/data/raceSkills')
const { pureGoblinSeed } = require('@/shared/data/pureGoblin')
const { getLegacyRaceName } = require('@/shared/types/Race')
const { EquipmentService } = require('@/core/services/EquipmentService')
const { calculateSlotCount } = require('@/shared/data/equipmentConfig')
const { getEquipmentTemplate } = require('@/shared/data/equipmentPoolLoader')

const { deriveObtainablePool } = require('./obtainablePool')
const { aggregateMetrics } = require('./metrics')
const {
  getAvailableJobs,
  JOB_ROLE,
  buildStrategistParty,
} = require('./strategistLayer')
const { deriveBreedingPool, isStrategicallyObtainable } = require('./breedingPool')

const FLOOR_NAMES = ['グラッシュ', 'ゴブA', 'ゴブB', 'ゴブC', 'ゴブD', 'ゴブE', 'ゴブF', 'ゴブG']

// ---------------------------------------------------------------------------
// 装備パワースコア（ヒューリスティック）
//   ・median の「中央値付近」判定と ceiling の候補上位カットにのみ使う近似指標。
//   ・ceiling の最終的な良し悪しは実シミュレーションの progressScore で決めるため、
//     この重みは厳密である必要はない（探索の初期化・枝刈り用）。
// ---------------------------------------------------------------------------
const STAT_WEIGHT = {
  hp_flat: 0.5,
  atk_flat: 1.5,
  def_flat: 1.0,
  magic_atk_flat: 1.0,
  magic_def_flat: 0.8,
  attackCount_flat: 40, // 攻撃回数は極めて強力
  accuracy_flat: 0.1,
  evasion_flat: 0.3,
  magicHeal_flat: 0.8,
  hp_percent: 2,
  atk_percent: 3,
  def_percent: 2,
  critical_rate_percent: 1.5,
  damage_reduction: 3,
}

function equipmentPowerScore(templateId) {
  const t = getEquipmentTemplate(templateId)
  if (!t) return 0
  let score = 0
  for (const b of t.statBonuses || []) {
    score += (STAT_WEIGHT[b.stat] ?? 0) * b.value
  }
  return score
}

// ---------------------------------------------------------------------------
// ゴブリン生成
// ---------------------------------------------------------------------------

/**
 * 純ゴブリン1体を生成する。装備テンプレID配列 loadout と因子配列 factors を反映する。
 * StartExpeditionUseCase.prepareDepartingGoblins と同じ手順で effectiveStats / skills を確定する:
 *   equipmentSkills = collectGrantedSkills(instances)
 *   mergedSkills    = [...種族デフォルト, ...equipmentSkills]
 *   effectiveStats  = calculateGoblinEffectiveStats({...goblin, skills:mergedSkills, factors}, instances)
 */
function buildGoblin(id, level, { loadout = [], factors = [] } = {}) {
  const raceId = 'goblin'
  const instances = loadout.map((templateId, i) => ({
    id: `sim-eq-${id}-${i}`,
    templateId,
    slotIndex: i,
    goblinId: id,
  }))

  const baseSkills = getDefaultSkillsForRace(raceId)
  const seed = {
    id,
    name: FLOOR_NAMES[(id - 1) % FLOOR_NAMES.length],
    race: getLegacyRaceName(raceId),
    raceId,
    level,
    experience: 0,
    avatar: '/src/assets/goblin/goblin.png',
    baseAttributes: { ...pureGoblinSeed.baseAttributes },
    individualValue: 1,
    factors: [...factors],
    skills: baseSkills,
    stats: {
      hp: 0, atk: 0, magicAtk: 0, def: 0, magicDef: 0,
      attackCount: 0, accuracy: 0, evasion: 0, magicHeal: 0, criticalRate: 0,
    },
  }
  const withStats = syncGoblinDerivedStats(seed)
  const equipmentSkills = EquipmentService.collectGrantedSkills(instances)
  const mergedSkills = [...withStats.skills, ...equipmentSkills]
  const effectiveStats = calculateGoblinEffectiveStats(
    { ...withStats, skills: mergedSkills },
    instances,
  )
  return { ...withStats, skills: mergedSkills, effectiveStats, currentHp: undefined }
}

// 床ゴブリン（装備・因子なし）
function buildFloorGoblin(id, level) {
  return buildGoblin(id, level, { loadout: [], factors: [] })
}

// ---------------------------------------------------------------------------
// floor
// ---------------------------------------------------------------------------
const floorPersona = {
  id: 'floor',
  label: '床(装備なし/因子なし/デフォルト)',
  buildParty({ level, size }) {
    const party = []
    for (let i = 1; i <= size; i++) party.push(buildFloorGoblin(i, level))
    return party
  },
}

// ---------------------------------------------------------------------------
// median
//   平均的なプレイヤーが素朴に選ぶ「中程度の一式」を決定論的に選ぶ:
//   入手可能装備をパワースコア昇順に並べ、中央 index を中心とした slotCount 個の
//   連続窓を全メンバー共通で装備する（重複ペナルティを避けるため相異なる装備）。
//   因子は付けない（明快さ優先）。隊列はデフォルト（全員同一装備なので順序不問）。
// ---------------------------------------------------------------------------
function selectMedianLoadout(pool, slotCount) {
  const ranked = [...pool].sort((a, b) => {
    const d = equipmentPowerScore(a) - equipmentPowerScore(b)
    return d !== 0 ? d : a < b ? -1 : 1
  })
  if (ranked.length === 0 || slotCount <= 0) return []
  const mid = Math.floor(ranked.length / 2)
  let start = mid - Math.floor(slotCount / 2)
  start = Math.max(0, Math.min(start, Math.max(0, ranked.length - slotCount)))
  const loadout = []
  for (let i = 0; i < slotCount && start + i < ranked.length; i++) {
    loadout.push(ranked[start + i])
  }
  return loadout
}

const medianPersona = {
  id: 'median',
  label: '中央値(入手可能プール中位一式/因子なし)',
  needsContext: true,
  buildParty({ level, size, areaId }) {
    const pool = deriveObtainablePool(areaId)
    const slotCount = calculateSlotCount(level)
    const loadout = selectMedianLoadout(pool.equipmentTemplateIds, slotCount)
    const party = []
    for (let i = 1; i <= size; i++) {
      party.push(buildGoblin(i, level, { loadout, factors: [] }))
    }
    return party
  },
}

// ---------------------------------------------------------------------------
// ceiling
//   入手可能プール内を山登り法（steepest ascent）で進捗スコア最大化する準最適ビルド。
//
//   ビルド表現（隊列を意味づけするため前衛/後衛の2ロードアウト構成）:
//     { front: string[], back: string[], frontCount: number, factorId: string|null }
//   パーティ: index 0..frontCount-1 が front ロードアウト（＝前列。敵は前列から狙う）、
//             残りが back ロードアウト。因子は全員共通。
//
//   近傍操作:
//     1. front/back 各スロットを別の入手可能装備（候補上位）に交換
//     2. 隊列: frontCount を ±1（前衛/後衛の枚数を入れ替え）
//     3. 因子を付け替え（null 含む）
//   評価: 固定シード集合（CRN, seed 1..K）で代表Tierを実シミュレートし、
//         metrics.progressScore を目的関数にする。改善近傍が無くなったら停止。
//   多スタート（median起点 / 高パワー起点）して最良を採用。
//
//   対象Tier設計判断:
//     プレイヤーはエリア内でTierごとに装備を組み替えないため、代表Tier1つでビルドを
//     決め、それを全Tierの計測に流用する。代表Tierは既定で対象Tier集合の中央値
//     （--ceiling-tier で上書き可）。これにより山登りは「エリアごと1回」で済む。
// ---------------------------------------------------------------------------
const CEILING_DEFAULTS = {
  seeds: 12, // K: 近傍評価シード数（CRN）
  candidateCap: 6, // 各スロットの候補上位数（交換候補プール）
  maxSlots: 8, // 山登りで最適化するスロット数の上限（高レベルの枠爆発を抑える）
  starts: 2, // 多スタート数
  maxIters: 20, // 山登り反復上限（安全弁）
  factorCap: 6, // 探索する因子候補上限
}

// 進捗スコア（1ビルドを K seeds で評価）。simulate は async のため await する。
async function scoreBuild(party, simulate, tier, seeds) {
  const per = []
  for (const seed of seeds) {
    per.push(await simulate(party, tier, seed))
  }
  const agg = aggregateMetrics(per)
  return agg ? agg.progressScore : 0
}

// tail = 山登り対象外の残りスロットを埋める共通ロードアウト（前衛/後衛共通）。
function buildPartyFromBuild(build, level, size, tail = []) {
  const party = []
  for (let i = 1; i <= size; i++) {
    const isFront = i <= build.frontCount
    const loadout = [...(isFront ? build.front : build.back), ...tail]
    party.push(buildGoblin(i, level, { loadout, factors: build.factorId ? [build.factorId] : [] }))
  }
  return party
}

// 決定論的な擬似乱数（areaId + start index 由来）
function makeRng(seedStr) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return () => {
    h ^= h << 13; h >>>= 0
    h ^= h >>> 17
    h ^= h << 5; h >>>= 0
    return h / 4294967296
  }
}

function cloneBuild(b) {
  return { front: [...b.front], back: [...b.back], frontCount: b.frontCount, factorId: b.factorId }
}

/**
 * ceiling ビルドを1エリア分探索する（代表Tierで evaluate）。結果は areaId でキャッシュ。
 */
const _ceilingCache = new Map()
async function searchCeilingBuild(ctx) {
  const { areaId, level, size, tier, simulate, options = {} } = ctx
  const cacheKey = areaId
  if (_ceilingCache.has(cacheKey)) return _ceilingCache.get(cacheKey)

  const cfg = { ...CEILING_DEFAULTS, ...(options.ceiling || {}) }
  const seeds = []
  for (let s = 1; s <= cfg.seeds; s++) seeds.push(s)

  const pool = deriveObtainablePool(areaId)
  const slotCount = calculateSlotCount(level)
  // 山登りで最適化するスロットは上限 maxSlots まで。残りは高パワー装備で greedy に埋める
  // （枠が枠を増やしても近傍数が爆発しないようにするための性能上の設計判断）。
  const optimizedSlots = Math.min(slotCount, cfg.maxSlots)

  // 候補装備: パワースコア降順
  const rankedEquip = [...pool.equipmentTemplateIds].sort((a, b) => {
    const d = equipmentPowerScore(b) - equipmentPowerScore(a)
    return d !== 0 ? d : a < b ? -1 : 1
  })
  const equipCandidates = rankedEquip.slice(0, cfg.candidateCap)
  // 最適化対象外スロットを埋める tail（前衛/後衛共通・非探索）。
  const tailLoadout = rankedEquip.slice(optimizedSlots, slotCount)

  // 同一ビルドの再評価を避けるメモ（決定論なので安全）。
  const scoreMemo = new Map()
  const buildSig = b => `${b.front.join(',')}|${b.back.join(',')}|${b.frontCount}|${b.factorId}`
  async function scoreOf(build) {
    const sig = buildSig(build)
    if (scoreMemo.has(sig)) return scoreMemo.get(sig)
    const s = await scoreBuild(buildPartyFromBuild(build, level, size, tailLoadout), simulate, tier, seeds)
    scoreMemo.set(sig, s)
    return s
  }

  // 候補因子（null 含む）
  const factorCandidates = [null, ...pool.factorIds.slice(0, cfg.factorCap)]

  // 装備が全く無い（root エリア等）場合は床同等。探索不要。
  if (equipCandidates.length === 0 && pool.factorIds.length === 0) {
    const emptyBuild = { front: [], back: [], frontCount: size, factorId: null }
    const party = buildPartyFromBuild(emptyBuild, level, size, tailLoadout)
    const score = await scoreBuild(party, simulate, tier, seeds)
    const out = { build: emptyBuild, party, score, tier, tail: tailLoadout }
    _ceilingCache.set(cacheKey, out)
    return out
  }

  const defaultFront = Math.max(1, Math.min(size - 1, Math.ceil(size / 2)))
  const medianLoadout = selectMedianLoadout(pool.equipmentTemplateIds, optimizedSlots)
  const topLoadout = rankedEquip.slice(0, optimizedSlots)

  function makeInitialBuild(startIdx) {
    if (startIdx === 0) {
      // median 起点
      return { front: [...medianLoadout], back: [...medianLoadout], frontCount: defaultFront, factorId: null }
    }
    if (startIdx === 1) {
      // 高パワー起点（因子は先頭候補）
      return {
        front: [...topLoadout],
        back: [...topLoadout],
        frontCount: defaultFront,
        factorId: pool.factorIds[0] ?? null,
      }
    }
    // それ以降: 疑似乱数で候補から充填
    const rng = makeRng(`${areaId}:${startIdx}`)
    const pick = () => equipCandidates.length
      ? equipCandidates[Math.floor(rng() * equipCandidates.length)]
      : undefined
    const front = []
    const back = []
    for (let i = 0; i < optimizedSlots; i++) { const f = pick(); if (f) front.push(f) }
    for (let i = 0; i < optimizedSlots; i++) { const b = pick(); if (b) back.push(b) }
    const fc = factorCandidates[Math.floor(rng() * factorCandidates.length)]
    return { front, back, frontCount: defaultFront, factorId: fc }
  }

  // 近傍生成（steepest ascent 用に全近傍を列挙）
  function neighbors(build) {
    const out = []
    // 装備交換（front / back 各スロット）。配列は常に密（穴を作らない）。
    for (const side of ['front', 'back']) {
      const arr = build[side]
      // 既存スロット 0..len-1 の交換 + 末尾 len（未使用スロットが残っていれば追加）
      const maxSlot = Math.min(optimizedSlots - 1, arr.length)
      for (let slot = 0; slot <= maxSlot; slot++) {
        for (const cand of equipCandidates) {
          if (arr[slot] === cand) continue
          const nb = cloneBuild(build)
          nb[side] = [...arr]
          if (slot < nb[side].length) nb[side][slot] = cand
          else nb[side].push(cand) // 密に末尾追加
          out.push(nb)
        }
        // スロットを外す（末尾追加スロットには適用しない）
        if (slot < arr.length) {
          const nb = cloneBuild(build)
          nb[side] = arr.filter((_, i) => i !== slot)
          out.push(nb)
        }
      }
    }
    // 隊列（frontCount ±1）
    for (const delta of [-1, 1]) {
      const fc = build.frontCount + delta
      if (fc >= 1 && fc <= size - 1) {
        const nb = cloneBuild(build)
        nb.frontCount = fc
        out.push(nb)
      }
    }
    // 因子付け替え
    for (const fc of factorCandidates) {
      if (fc === build.factorId) continue
      const nb = cloneBuild(build)
      nb.factorId = fc
      out.push(nb)
    }
    return out
  }

  async function hillClimb(startBuild) {
    let current = startBuild
    let currentScore = await scoreOf(current)
    for (let iter = 0; iter < cfg.maxIters; iter++) {
      let bestNb = null
      let bestScore = currentScore
      for (const nb of neighbors(current)) {
        const s = await scoreOf(nb)
        if (s > bestScore + 1e-9) {
          bestScore = s
          bestNb = nb
        }
      }
      if (!bestNb) break
      current = bestNb
      currentScore = bestScore
    }
    return { build: current, score: currentScore }
  }

  let best = null
  for (let s = 0; s < cfg.starts; s++) {
    const res = await hillClimb(makeInitialBuild(s))
    if (!best || res.score > best.score) best = res
  }

  const party = buildPartyFromBuild(best.build, level, size, tailLoadout)
  const out = { build: best.build, party, score: best.score, tier, tail: tailLoadout }
  _ceilingCache.set(cacheKey, out)
  return out
}

const ceilingPersona = {
  id: 'ceiling',
  label: '天井(入手可能プールを山登り最適化)',
  needsContext: true,
  async buildParty(ctx) {
    return (await searchCeilingBuild(ctx)).party
  },
  // 探索結果（選ばれた装備・因子・隊列・スコア）を取得（--out 用）
  async describeBuild(ctx) {
    return searchCeilingBuild(ctx)
  },
}

// ---------------------------------------------------------------------------
// strategist
//   戦略層（ジョブ・亜種・隊列・装備）を統合し progressScore を山登り最大化する上限。
//
//   ceiling が「純ゴブリン＋装備＋因子」までなのに対し、strategist は各メンバーを
//   「ジョブ持ち純ゴブリン」または「亜種」（両者は排他: canTrainGoblin=isPureGoblin&&!job）
//   のいずれかに割り当て、実隊列（members 順＝前列ほど狙われやすい）と装備を最適化する。
//
//   ビルド表現:
//     { members:[{ kind:'job'|'variant', jobId?|(variant,raceId), loadout:string[] }...],
//       frontCount:number }
//     - kind='job'  … 純ゴブリン。jobId=null は「ジョブ無し純ゴブリン」（訓練前の素体）も許可。
//     - kind='variant' … 亜種。jobId は付けない（排他ルール）。因子は当該亜種因子を自動付与。
//     - members 配列順＝隊列（先頭ほど前列）。loadout は山登り対象スロット（残りは tail で greedy 充填）。
//
//   近傍操作:
//     1. kind 切替（job↔variant）  2. job 種別変更（null/各ジョブ）  3. variant 種別変更
//     4. loadout 1スロット交換/除去 5. 隣接メンバー入替（隊列）      6. frontCount ±1
//
//   役割ヒント（JOB_ROLE の front/back）を初期ビルドと kind 切替時の既定選択に使い、
//   前列に tank/dps、後列に healer/caster を寄せる（guard前+cleric後+dps/caster を multi-start に含む）。
//
//   評価は ceiling と同じ CRN 固定シードで progressScore。決定論厳守（疑似乱数は areaId 由来固定）。
//   探索はエリアごと1回（代表探索レベル＝初回 ctx.level）で行い、build 構造を全レベルへ流用する
//   （ceiling が代表Tierのビルドを全Tierへ流用するのと同じ設計判断）。レベル走査時は tail 長のみ
//   その都度 calculateSlotCount(level) で再計算する。
// ---------------------------------------------------------------------------
const STRATEGIST_DEFAULTS = {
  seeds: 5, // K: 近傍評価シード数（CRN）。実用的な小さめ既定。
  candidateCap: 4, // 各スロットの装備候補上位数
  maxSlots: 3, // 山登りで最適化する装備スロット数の上限（メンバー×スロットの爆発抑制）
  starts: 3, // 多スタート数（0,1=curated / 2=variant混在 / 3+=乱択）
  maxIters: 12, // 山登り反復上限（安全弁）
  variantThreshold: null, // 亜種の入手容易度閾値。null=breedingPool 既定(moderate)
}

// ジョブ配列を役割別に分類（JOB_ROLE.role 参照）
function jobsByRole(jobs) {
  const byRole = { tank: [], dps: [], skirmisher: [], caster: [], healer: [] }
  for (const j of jobs) {
    const r = JOB_ROLE[j]
    if (r && byRole[r.role]) byRole[r.role].push(j)
  }
  return byRole
}

// 隊列位置に応じた既定ジョブ（前列=tank>dps>skirmisher / 後列=healer>caster）。無ければ null。
function defaultJobForPosition(isFront, byRole, jobs) {
  if (jobs.length === 0) return null
  if (isFront) return byRole.tank[0] ?? byRole.dps[0] ?? byRole.skirmisher[0] ?? jobs[0]
  return byRole.healer[0] ?? byRole.caster[0] ?? byRole.dps[0] ?? jobs[0]
}

const _strategistCache = new Map()

async function searchStrategistBuild(ctx) {
  const { areaId, level, size, tier, simulate, options = {} } = ctx
  if (_strategistCache.has(areaId)) return _strategistCache.get(areaId)

  const cfg = { ...STRATEGIST_DEFAULTS, ...(options.strategist || {}) }
  const seeds = []
  for (let s = 1; s <= cfg.seeds; s++) seeds.push(s)

  // --- 入手可能な戦略要素 ---------------------------------------------------
  const jobs = getAvailableJobs(areaId) // [] もあり得る（初期エリア）
  const byRole = jobsByRole(jobs)
  const bp = deriveBreedingPool(areaId)
  const threshold = cfg.variantThreshold ?? bp.strategicThreshold
  const variants = bp.variants
    .filter(v => v.accessibility !== 'unavailable' && isStrategicallyObtainable(v.accessibility, threshold))
    .map(v => ({ id: v.id, raceId: v.statTraits.raceId }))

  const pool = deriveObtainablePool(areaId)
  const slotCount = calculateSlotCount(level)
  const optimizedSlots = Math.min(slotCount, cfg.maxSlots)
  const rankedEquip = [...pool.equipmentTemplateIds].sort((a, b) => {
    const d = equipmentPowerScore(b) - equipmentPowerScore(a)
    return d !== 0 ? d : a < b ? -1 : 1
  })
  const equipCandidates = rankedEquip.slice(0, cfg.candidateCap)
  const medianLoadout = selectMedianLoadout(pool.equipmentTemplateIds, optimizedSlots)
  const topLoadout = rankedEquip.slice(0, optimizedSlots)

  const jobChoices = [null, ...jobs] // null=ジョブ無し純ゴブリンも選択肢
  const hasVariants = variants.length > 0

  // build.members[i] = { kind, jobId, variant, raceId, loadout }
  function makeJobMember(jobId, loadout) {
    return { kind: 'job', jobId: jobId ?? null, variant: null, raceId: null, loadout: [...loadout] }
  }
  function makeVariantMember(v, loadout) {
    return { kind: 'variant', jobId: null, variant: v.id, raceId: v.raceId, loadout: [...loadout] }
  }
  function cloneMember(m) {
    return { kind: m.kind, jobId: m.jobId, variant: m.variant, raceId: m.raceId, loadout: [...m.loadout] }
  }
  function cloneBuild(b) {
    return { members: b.members.map(cloneMember), frontCount: b.frontCount }
  }

  // build → comp（buildStrategistParty 入力）。tail は要求レベルの slotCount で再計算。
  function buildCompFromBuild(build, atLevel) {
    const sc = calculateSlotCount(atLevel)
    const os = Math.min(sc, cfg.maxSlots)
    const tail = rankedEquip.slice(os, sc)
    const members = build.members.map(m => {
      const optimized = m.loadout.slice(0, os)
      const full = [...optimized, ...tail].slice(0, sc)
      if (m.kind === 'variant') {
        return { raceId: m.raceId, variant: m.variant, factors: [m.variant], loadout: full }
      }
      return { jobId: m.jobId ?? null, loadout: full }
    })
    return { frontCount: build.frontCount, members }
  }

  // 決定論メモ化スコア
  const scoreMemo = new Map()
  const memberSig = m => m.kind === 'variant'
    ? `V:${m.variant}:${m.loadout.join('.')}`
    : `J:${m.jobId}:${m.loadout.join('.')}`
  const buildSig = b => b.members.map(memberSig).join('|') + `#${b.frontCount}`
  async function scoreOf(build) {
    const sig = buildSig(build)
    if (scoreMemo.has(sig)) return scoreMemo.get(sig)
    const comp = buildCompFromBuild(build, level)
    const party = buildStrategistParty({ level, size, comp })
    const s = await scoreBuild(party, simulate, tier, seeds)
    scoreMemo.set(sig, s)
    return s
  }

  // --- 初期ビルド（multi-start） -------------------------------------------
  const defaultFront = Math.max(1, Math.min(size - 1, Math.ceil(size / 2)))
  // curated: 前列に tank/dps、後列に healer/caster を並べたジョブ編成
  function curatedJobMembers(loadout, fc) {
    const frontOrder = [...byRole.tank, ...byRole.dps, ...byRole.skirmisher]
    const backOrder = [...byRole.healer, ...byRole.caster]
    const members = []
    for (let i = 0; i < size; i++) {
      const isFront = i < fc
      const pref = isFront ? frontOrder : backOrder
      const alt = isFront ? backOrder : frontOrder
      let jobId = null
      if (jobs.length > 0) {
        const seq = pref.length ? pref : alt
        jobId = seq.length ? seq[(isFront ? i : i - fc) % seq.length] : jobs[0]
      }
      members.push(makeJobMember(jobId, loadout))
    }
    return members
  }

  function makeInitialBuild(startIdx) {
    if (startIdx === 0) {
      return { members: curatedJobMembers(medianLoadout, defaultFront), frontCount: defaultFront }
    }
    if (startIdx === 1) {
      return { members: curatedJobMembers(topLoadout, defaultFront), frontCount: defaultFront }
    }
    if (startIdx === 2 && hasVariants) {
      // 前列: guard(job)+亜種 / 後列: cleric(caster/healer job)。亜種を種として混ぜる。
      const members = []
      for (let i = 0; i < size; i++) {
        const isFront = i < defaultFront
        if (isFront) {
          if (i === 0 && jobs.length) members.push(makeJobMember(defaultJobForPosition(true, byRole, jobs), topLoadout))
          else members.push(makeVariantMember(variants[i % variants.length], topLoadout))
        } else {
          if (jobs.length) members.push(makeJobMember(defaultJobForPosition(false, byRole, jobs), topLoadout))
          else members.push(makeVariantMember(variants[i % variants.length], topLoadout))
        }
      }
      return { members, frontCount: defaultFront }
    }
    // 乱択（areaId 由来固定シード）
    const rng = makeRng(`${areaId}:strat:${startIdx}`)
    const pickEquip = () => equipCandidates.length
      ? equipCandidates[Math.floor(rng() * equipCandidates.length)] : undefined
    const members = []
    for (let i = 0; i < size; i++) {
      const loadout = []
      for (let s = 0; s < optimizedSlots; s++) { const e = pickEquip(); if (e) loadout.push(e) }
      const useVariant = hasVariants && rng() < 0.4
      if (useVariant) members.push(makeVariantMember(variants[Math.floor(rng() * variants.length)], loadout))
      else members.push(makeJobMember(jobChoices[Math.floor(rng() * jobChoices.length)], loadout))
    }
    const fc = 1 + Math.floor(rng() * (size - 1))
    return { members, frontCount: fc }
  }

  // --- 近傍生成 -------------------------------------------------------------
  function neighbors(build) {
    const out = []
    for (let i = 0; i < build.members.length; i++) {
      const m = build.members[i]
      const isFront = i < build.frontCount
      // 1. kind 切替
      if (m.kind === 'job' && hasVariants) {
        const nb = cloneBuild(build)
        nb.members[i] = makeVariantMember(variants[0], m.loadout)
        out.push(nb)
      } else if (m.kind === 'variant') {
        const nb = cloneBuild(build)
        nb.members[i] = makeJobMember(defaultJobForPosition(isFront, byRole, jobs), m.loadout)
        out.push(nb)
      }
      // 2. job 種別変更
      if (m.kind === 'job') {
        for (const jc of jobChoices) {
          if (jc === m.jobId) continue
          const nb = cloneBuild(build)
          nb.members[i] = makeJobMember(jc, m.loadout)
          out.push(nb)
        }
      }
      // 3. variant 種別変更
      if (m.kind === 'variant') {
        for (const v of variants) {
          if (v.id === m.variant) continue
          const nb = cloneBuild(build)
          nb.members[i] = makeVariantMember(v, m.loadout)
          out.push(nb)
        }
      }
      // 4. loadout 交換 / 除去
      const maxSlot = Math.min(optimizedSlots - 1, m.loadout.length)
      for (let slot = 0; slot <= maxSlot; slot++) {
        for (const cand of equipCandidates) {
          if (m.loadout[slot] === cand) continue
          const nb = cloneBuild(build)
          const arr = nb.members[i].loadout
          if (slot < arr.length) arr[slot] = cand
          else arr.push(cand)
          out.push(nb)
        }
        if (slot < m.loadout.length) {
          const nb = cloneBuild(build)
          nb.members[i].loadout = m.loadout.filter((_, k) => k !== slot)
          out.push(nb)
        }
      }
    }
    // 5. 隣接メンバー入替（隊列）
    for (let i = 0; i < build.members.length - 1; i++) {
      const nb = cloneBuild(build)
      const tmp = nb.members[i]; nb.members[i] = nb.members[i + 1]; nb.members[i + 1] = tmp
      out.push(nb)
    }
    // 6. frontCount ±1
    for (const delta of [-1, 1]) {
      const fc = build.frontCount + delta
      if (fc >= 1 && fc <= size - 1) {
        const nb = cloneBuild(build)
        nb.frontCount = fc
        out.push(nb)
      }
    }
    return out
  }

  async function hillClimb(startBuild) {
    let current = startBuild
    let currentScore = await scoreOf(current)
    for (let iter = 0; iter < cfg.maxIters; iter++) {
      let bestNb = null
      let bestScore = currentScore
      for (const nb of neighbors(current)) {
        const s = await scoreOf(nb)
        if (s > bestScore + 1e-9) { bestScore = s; bestNb = nb }
      }
      if (!bestNb) break
      current = bestNb
      currentScore = bestScore
    }
    return { build: current, score: currentScore }
  }

  let best = null
  for (let s = 0; s < cfg.starts; s++) {
    const res = await hillClimb(makeInitialBuild(s))
    if (!best || res.score > best.score) best = res
  }

  const detail = {
    areaId,
    build: best.build,
    score: best.score,
    tier,
    searchLevel: level,
    rankedEquip,
    optimizedSlots,
    jobs,
    variants,
    buildComp: b => buildCompFromBuild(b, level),
  }
  detail.comp = buildCompFromBuild(best.build, level)
  _strategistCache.set(areaId, detail)
  return detail
}

const strategistPersona = {
  id: 'strategist',
  label: '戦略(ジョブ/亜種/隊列/装備を統合最適化)',
  needsContext: true,
  async buildParty(ctx) {
    const detail = await searchStrategistBuild(ctx)
    const comp = buildStrategistCompAtLevel(detail, ctx.level)
    return buildStrategistParty({ level: ctx.level, size: ctx.size, comp })
  },
  // 探索結果（build 構造・スコア・ジョブ/亜種プール）を取得（--out / 分析用）
  async describeBuild(ctx) {
    return searchStrategistBuild(ctx)
  },
}

// 探索済み build を要求レベルの comp に変換（tail 長を再計算）。
function buildStrategistCompAtLevel(detail, level) {
  const sc = calculateSlotCount(level)
  const os = detail.optimizedSlots
  const tail = detail.rankedEquip.slice(os, sc)
  const members = detail.build.members.map(m => {
    const optimized = m.loadout.slice(0, os)
    const full = [...optimized, ...tail].slice(0, sc)
    if (m.kind === 'variant') {
      return { raceId: m.raceId, variant: m.variant, factors: [m.variant], loadout: full }
    }
    return { jobId: m.jobId ?? null, loadout: full }
  })
  return { frontCount: detail.build.frontCount, members }
}

// build を人間可読な要約に整形（job/variant 構成・隊列）。
function summarizeStrategistBuild(detail) {
  const b = detail.build
  const parts = b.members.map((m, i) => {
    const pos = i < b.frontCount ? 'F' : 'B'
    const who = m.kind === 'variant' ? `亜種:${m.variant}` : `job:${m.jobId ?? '素'}`
    return `${pos}[${who}]`
  })
  const jobCount = b.members.filter(m => m.kind === 'job').length
  const varCount = b.members.filter(m => m.kind === 'variant').length
  return {
    line: parts.join(' '),
    frontCount: b.frontCount,
    jobCount,
    variantCount: varCount,
    score: detail.score,
  }
}

const PERSONAS = {
  floor: floorPersona,
  median: medianPersona,
  ceiling: ceilingPersona,
  strategist: strategistPersona,
}

function getPersona(id) {
  return PERSONAS[id] ?? null
}

module.exports = {
  PERSONAS,
  getPersona,
  floorPersona,
  medianPersona,
  ceilingPersona,
  strategistPersona,
  searchStrategistBuild,
  buildStrategistCompAtLevel,
  summarizeStrategistBuild,
  buildFloorGoblin,
  buildGoblin,
  equipmentPowerScore,
  CEILING_DEFAULTS,
  STRATEGIST_DEFAULTS,
}
