'use strict'

/**
 * 戦略プレミアム測定スクリプト。
 *
 * 各エリアで「戦略知識の価値」を測る。ペルソナ:
 *   - strategist : ジョブ/亜種/隊列/装備を統合し progressScore を山登り最大化（上限＝専念プレイヤー）
 *   - median     : 中位装備・ジョブなし・亜種なし・デフォルト隊列（＝装備は買うがシステムを理解しない層）
 *   - floor      : 装備なし・因子なし（下限。thresholds.csv から必要Lvを引く）
 *
 * 指標:
 *   - 最適必要レベル L* : strategist が Tier0 で成功率 SUCCESS_TH% に達する最低レベル（レベル走査）。
 *   - 戦略プレミアム    : (strategist の L* での成功率) − (median の L* での成功率)
 *                         = 約 SUCCESS_TH% − median(L*)。
 *                         median が L* で高い → 戦略不要（レベルで押せる）。
 *                         median がほぼ0 → 戦略が決定的（良い設計）。
 *
 * 出力:
 *   - out/strategyPremium.csv  : area×指標×最良ビルド要約（本編到達エリアを進行順）
 *   - out/wallClassification.csv: floor必要Lv / strategist必要Lv / 戦略プレミアム を1表にし分類
 *
 * 性能設計:
 *   全エリア×レベル走査×山登りは重いので:
 *     - レベルグリッドは粗め（analyzeThresholds.js と同じ）。
 *     - strategist の山登り探索はエリアごと1回だけ。代表探索レベルは「median 成功率が
 *       50%付近＝ビルド差が最も出る帯」を選び、SEARCH_LEVEL_CAP で上限を切る（探索を高速化）。
 *       探索した build 構造は全レベルへ流用（ceiling が代表Tierを流用するのと同じ）。
 *   決定論厳守（seed 固定 / rng は areaId 由来固定 / persona キャッシュ）。同一引数2回で一致。
 *
 * 実行: node scripts/balance/strategyPremium.js [options]
 */

const fs = require('fs')
const path = require('path')

require('./headless/runtime')
const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
const allAreaData = require('@/shared/data/expeditionArea/allArea.json')
const { getAreaConfig } = require('@/shared/data/expeditionArea')
const { getPersona, searchStrategistBuild, summarizeStrategistBuild } = require('./headless/personas')
const { extractExpeditionMetrics, aggregateMetrics } = require('./headless/metrics')
const { suppressEngineLogs } = require('./headless/runtime')

// ---------------------------------------------------------------------------
// チューニング定数
// ---------------------------------------------------------------------------
const SUCCESS_TH = 80 // 必要レベル判定の成功率閾値（%）
const TIER = 0 // 計測 Tier（Tier0 で必要レベルを測る）
const SIZE = 6 // 出撃人数
const SEEDS_MEASURE = 30 // 必要レベル走査・プレミアム計測のシード数（CRN）
const LEVEL_GRID = [3, 5, 8, 10, 13, 16, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 180]
// strategist 山登り探索の代表レベル上限（構造は級robustのため上限を切って高速化）
const SEARCH_LEVEL_CAP = 80

// wallClassification 分類の閾値（すべてここに集約。根拠はコメント）
const HOLLOW_FLOOR_MAX = 30 // floor(裸)必要Lv がこれ以下 → 裸パーティが安く踏破＝【空洞】(簡単すぎ)
const LEVEL_WALL_STRAT_MIN = 80 // strategist でも必要Lv がこれ以上 or 到達不能 → 【レベルの壁】(過剰調整)
const PREMIUM_HIGH = 0.4 // 戦略プレミアムがこれ以上 → 戦略が効いている
const STRAT_GAP_MIN = 20 // floor必要Lv − strategist必要Lv がこれ以上 → 戦略で大幅に下がる

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const o = {
    areas: null,
    seeds: SEEDS_MEASURE,
    searchCap: SEARCH_LEVEL_CAP,
    out: path.resolve(__dirname, 'out', 'strategyPremium.csv'),
    wallOut: path.resolve(__dirname, 'out', 'wallClassification.csv'),
    thresholds: path.resolve(__dirname, 'out', 'thresholds.csv'),
    strat: {}, // strategist 探索オプション（seeds/starts/candidateCap/maxSlots）
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const val = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} の値がありません`); return v }
    if (a === '--areas') o.areas = val().split(',').map(s => s.trim()).filter(Boolean)
    else if (a === '--seeds') o.seeds = Number(val())
    else if (a === '--search-cap') o.searchCap = Number(val())
    else if (a === '--out') o.out = path.resolve(val())
    else if (a === '--wall-out') o.wallOut = path.resolve(val())
    else if (a === '--thresholds') o.thresholds = path.resolve(val())
    else if (a === '--strat-seeds') o.strat.seeds = Number(val())
    else if (a === '--strat-starts') o.strat.starts = Number(val())
    else if (a === '--strat-candidates') o.strat.candidateCap = Number(val())
    else if (a === '--strat-max-slots') o.strat.maxSlots = Number(val())
    else if (a === '--help' || a === '-h') o.help = true
    else throw new Error(`不明な引数です: ${a}`)
  }
  return o
}

// ---------------------------------------------------------------------------
// 本編チェーン（slime_cave 起点 BFS。深さ→areaLevel 順。analyzeThresholds と同じ）
// ---------------------------------------------------------------------------
const areas = allAreaData.areas || []
const byId = Object.fromEntries(areas.map(a => [a.id, a]))
function mainChain() {
  const depth = { slime_cave: 0 }
  const q = ['slime_cave']
  while (q.length) {
    const x = q.shift()
    const a = byId[x] || {}
    const kids = []
    if (a.unlockNext) kids.push(a.unlockNext)
    if (a.unlockNexts) kids.push(...a.unlockNexts)
    for (const c of kids) if (byId[c] && !(c in depth)) { depth[c] = depth[x] + 1; q.push(c) }
  }
  return Object.keys(depth)
    .sort((a, b) => depth[a] - depth[b] || (byId[a].areaLevel || 0) - (byId[b].areaLevel || 0))
    .map(id => ({ id, depth: depth[id], areaLevel: byId[id].areaLevel || 0 }))
}

// ---------------------------------------------------------------------------
// シミュレーション
// ---------------------------------------------------------------------------
async function runExpedition(areaId, tier, party, seed) {
  const engine = new ExpeditionEngine(seed)
  return suppressEngineLogs(() => engine.generateExpedition(
    { partyId: 'strat-premium', areaId, tier, returnPolicy: 'never', clientVersion: 'strat-premium' },
    party.map(g => ({ ...g, currentHp: undefined })),
  ))
}
function makeSimulate(areaId) {
  return async (party, tier, seed) => extractExpeditionMetrics(await runExpedition(areaId, tier, party, seed))
}

// (persona, level) の計測をキャッシュしつつ集計。unsupported なら null。
async function measure(areaId, level, persona, simulate, seeds, cache) {
  const key = `${persona.id}|${level}`
  if (cache.has(key)) return cache.get(key)
  let party
  try {
    party = await persona.buildParty({ level, size: SIZE, areaId, tier: TIER, tiers: [TIER], simulate, options: { strategist: {} } })
  } catch (_) { cache.set(key, null); return null }
  const per = []
  for (let s = 1; s <= seeds; s++) {
    try { per.push(extractExpeditionMetrics(await runExpedition(areaId, level, party, s))) } catch (_) { cache.set(key, null); return null }
  }
  const agg = aggregateMetrics(per)
  cache.set(key, agg)
  return agg
}

// グリッド上で成功率>=閾値の最低レベルを返す（未達なら null）。行の成功率も返す。
async function requiredLevel(areaId, persona, simulate, seeds, cache) {
  const curve = {}
  let found = null
  for (const L of LEVEL_GRID) {
    const agg = await measure(areaId, L, persona, simulate, seeds, cache)
    curve[L] = agg ? agg.successRate : null
    if (found === null && agg && agg.successRate * 100 >= SUCCESS_TH) found = L
  }
  return { level: found, curve }
}

// median の踏破フロンティア直前＝ビルド差が最も出る帯を代表探索レベルに選ぶ。
// median 成功率はレベルに対しほぼ階段状（0%→100%）なので「0.5 に最も近い」は退化する。
// そこで median が初めて 50% 以上へ跨ぐレベルを探し、その1つ手前（まだ苦しい帯）を採る。
// ここは strategist（＝より強い）が部分的に成否を分ける＝山登りの勾配が立つ帯。
function pickSearchLevel(medianCurve, cap) {
  const entries = LEVEL_GRID.filter(L => L <= cap && medianCurve[L] !== null)
  if (entries.length === 0) return Math.min(cap, LEVEL_GRID[LEVEL_GRID.length - 1])
  let crossIdx = -1
  for (let i = 0; i < entries.length; i++) {
    if (medianCurve[entries[i]] >= 0.5) { crossIdx = i; break }
  }
  if (crossIdx === -1) return entries[entries.length - 1] // フロンティアが cap 超＝壁。上限側で探索。
  if (crossIdx === 0) return entries[0] // 最低レベルで既に踏破＝簡単。
  return entries[crossIdx - 1] // クロス直前
}

// ---------------------------------------------------------------------------
// floor 必要Lv（thresholds.csv）読み込み
// ---------------------------------------------------------------------------
function loadFloorLevels(thresholdsPath) {
  const map = {}
  if (!fs.existsSync(thresholdsPath)) return map
  const lines = fs.readFileSync(thresholdsPath, 'utf8').trim().split('\n')
  const header = lines[0].split(',')
  const idIdx = header.indexOf('area_id')
  const flIdx = header.indexOf('floor_clear_level')
  if (idIdx < 0 || flIdx < 0) return map
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const v = cols[flIdx]
    map[cols[idIdx]] = (v === 'NONE' || v === '' || v === undefined) ? null : Number(v)
  }
  return map
}

// ---------------------------------------------------------------------------
// 分類
// ---------------------------------------------------------------------------
function classifyWall({ floorLv, stratLv, premium }) {
  // 1. strategist でも必要Lv が高い or 到達不能 → 過剰調整＝【レベルの壁】
  if (stratLv === null || stratLv >= LEVEL_WALL_STRAT_MIN) return '【レベルの壁】'
  // 2. floor(裸)が安く踏破 → 簡単すぎ＝【空洞】
  if (floorLv !== null && floorLv <= HOLLOW_FLOOR_MAX) return '【空洞】'
  // 3. premium が高く floor が strategist より大幅に高い → 戦略が鍵＝【戦略の壁】
  if (premium >= PREMIUM_HIGH && floorLv !== null && (floorLv - stratLv) >= STRAT_GAP_MIN) return '【戦略の壁】'
  // 4. それ以外
  return '【標準】'
}

// CSV セルのクォート
function q(s) { const t = String(s); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(`戦略プレミアム測定

実行: node scripts/balance/strategyPremium.js [options]
  --areas <a,b>          対象エリア（既定: 本編チェーン全域）
  --seeds <N>            計測シード数（既定: ${SEEDS_MEASURE}）
  --search-cap <L>       strategist 代表探索レベルの上限（既定: ${SEARCH_LEVEL_CAP}）
  --strat-seeds <K>      山登り評価シード数
  --strat-starts <S>     多スタート数
  --strat-candidates <M> 装備候補上位数
  --strat-max-slots <N>  最適化スロット上限
  --out <path>           strategyPremium.csv 出力先
  --wall-out <path>      wallClassification.csv 出力先
  --thresholds <path>    floor 必要Lv を読む thresholds.csv
`)
    return
  }

  const chain = mainChain()
  const targetIds = opts.areas ? new Set(opts.areas) : null
  const rows = chain.filter(c => (!targetIds || targetIds.has(c.id)) && getAreaConfig(c.id))

  const floorLevels = loadFloorLevels(opts.thresholds)
  const strategist = getPersona('strategist')
  const median = getPersona('median')

  const startedAt = Date.now()
  const results = []

  for (let ri = 0; ri < rows.length; ri++) {
    const { id: areaId, depth, areaLevel } = rows[ri]
    const t0 = Date.now()
    const simulate = makeSimulate(areaId)
    const cache = new Map()

    // 1. median カーブ（無探索・安価） → 代表探索レベルを決める
    const med = await requiredLevel(areaId, median, simulate, opts.seeds, cache)
    const searchLevel = pickSearchLevel(med.curve, opts.searchCap)

    // 2. strategist 山登り探索（エリア1回。この searchLevel でキャッシュ確定）
    let detail
    try {
      detail = await searchStrategistBuild({
        areaId, level: searchLevel, size: SIZE, tier: TIER, simulate, options: { strategist: opts.strat },
      })
    } catch (e) {
      process.stderr.write(`\n[skip] ${areaId}: strategist 探索失敗 (${e.message})\n`)
      continue
    }
    const summary = summarizeStrategistBuild(detail)

    // 3. strategist 必要Lv 走査（探索済み build を全レベルへ流用）
    const strat = await requiredLevel(areaId, strategist, simulate, opts.seeds, cache)
    const stratLv = strat.level

    // 4. L*（= strategist 必要Lv）での median / strategist 成功率とプレミアム
    let medAtLstar = null
    let stratAtLstar = null
    if (stratLv !== null) {
      stratAtLstar = strat.curve[stratLv]
      const mAgg = await measure(areaId, stratLv, median, simulate, opts.seeds, cache)
      medAtLstar = mAgg ? mAgg.successRate : null
    }
    const premium = (stratAtLstar !== null && medAtLstar !== null) ? (stratAtLstar - medAtLstar) : null

    const floorLv = floorLevels[areaId] ?? null
    const cls = classifyWall({ floorLv, stratLv, premium: premium ?? 0 })

    const rec = {
      areaId, depth, areaLevel, floorLv, stratLv,
      medAtLstar, stratAtLstar, premium, searchLevel,
      summary, detail, cls,
      medianCurve: med.curve, stratCurve: strat.curve,
    }
    results.push(rec)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    const eta = ((Date.now() - startedAt) / (ri + 1) * (rows.length - ri - 1) / 1000).toFixed(0)
    process.stderr.write(
      `[${ri + 1}/${rows.length}] ${areaId.padEnd(20)} L*=${stratLv ?? '>' + LEVEL_GRID[LEVEL_GRID.length - 1]} ` +
      `floor=${floorLv ?? 'NA'} premium=${premium !== null ? (premium * 100).toFixed(0) + '%' : 'NA'} ` +
      `${cls} (${elapsed}s, 残り約${eta}s)  job=${summary.jobCount}/var=${summary.variantCount}\n`,
    )
  }

  // --- strategyPremium.csv --------------------------------------------------
  const spHeader = [
    'area_id', 'depth', 'area_level', 'optimal_required_level', 'floor_required_level',
    'median_success_at_Lstar', 'strategist_success_at_Lstar', 'strategy_premium',
    'search_level', 'job_count', 'variant_count', 'front_count', 'best_build',
  ]
  const spLines = [spHeader.join(',')]
  for (const r of results) {
    spLines.push([
      r.areaId, r.depth, r.areaLevel,
      r.stratLv ?? 'NONE', r.floorLv ?? 'NA',
      r.medAtLstar !== null ? (r.medAtLstar * 100).toFixed(1) : 'NA',
      r.stratAtLstar !== null ? (r.stratAtLstar * 100).toFixed(1) : 'NA',
      r.premium !== null ? (r.premium * 100).toFixed(1) : 'NA',
      r.searchLevel, r.summary.jobCount, r.summary.variantCount, r.summary.frontCount,
      q(r.summary.line),
    ].join(','))
  }
  fs.mkdirSync(path.dirname(opts.out), { recursive: true })
  fs.writeFileSync(opts.out, spLines.join('\n') + '\n', 'utf8')

  // --- wallClassification.csv ----------------------------------------------
  const wcHeader = [
    'area_id', 'depth', 'area_level', 'floor_required_level', 'strategist_required_level',
    'strategy_premium', 'classification', 'best_build',
  ]
  const wcLines = [wcHeader.join(',')]
  for (const r of results) {
    wcLines.push([
      r.areaId, r.depth, r.areaLevel,
      r.floorLv ?? 'NA', r.stratLv ?? 'NONE',
      r.premium !== null ? (r.premium * 100).toFixed(1) : 'NA',
      q(r.cls), q(r.summary.line),
    ].join(','))
  }
  fs.writeFileSync(opts.wallOut, wcLines.join('\n') + '\n', 'utf8')

  // --- コンソール表 ---------------------------------------------------------
  console.log('\n===== 戦略プレミアム（本編到達エリア・進行順） =====')
  console.log('area                 depth L*    floor  med@L* strat@L* premium  分類        構成(job/var)')
  console.log('-'.repeat(108))
  for (const r of results) {
    console.log(
      r.areaId.padEnd(20) + ' ' +
      String(r.depth).padStart(5) + ' ' +
      String(r.stratLv ?? '>180').padStart(5) + ' ' +
      String(r.floorLv ?? 'NA').padStart(5) + ' ' +
      (r.medAtLstar !== null ? (r.medAtLstar * 100).toFixed(0) + '%' : 'NA').padStart(6) + ' ' +
      (r.stratAtLstar !== null ? (r.stratAtLstar * 100).toFixed(0) + '%' : 'NA').padStart(7) + ' ' +
      (r.premium !== null ? (r.premium * 100).toFixed(0) + '%' : 'NA').padStart(7) + '  ' +
      r.cls.padEnd(10) + '  ' + `j${r.summary.jobCount}/v${r.summary.variantCount}`,
    )
  }
  console.log('-'.repeat(108))
  console.log(`出力: ${opts.out}`)
  console.log(`出力: ${opts.wallOut}`)
  console.log(`総所要: ${((Date.now() - startedAt) / 1000).toFixed(0)}s`)
}

main().catch(err => { console.error(err && err.stack ? err.stack : err); process.exit(1) })
