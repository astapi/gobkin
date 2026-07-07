// 本編進行チェーンに沿って「各エリアの実クリア必要レベル」を測定する分析スクリプト。
// areaLevel ラベルが壊れているため、床/天井ペルソナが Tier0 で success>=THRESHOLD% に
// 達する最低パーティレベルを走査し、真の難易度曲線を出す。
// 実行: node scripts/balance/analyzeThresholds.js
require('./headless/runtime')
const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
const allAreaData = require('@/shared/data/expeditionArea/allArea.json')
const { getPersona } = require('./headless/personas')
const { extractExpeditionMetrics, aggregateMetrics } = require('./headless/metrics')
const { suppressEngineLogs } = require('./headless/runtime')

const SUCCESS_TH = 80
const SEEDS = 30
const SIZE = 6
const LEVEL_GRID = [3, 5, 8, 10, 13, 16, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 180]

const areas = Array.isArray(allAreaData) ? allAreaData : (allAreaData.areas || Object.values(allAreaData))
const byId = Object.fromEntries(areas.map(a => [a.id, a]))

// slime_cave 起点で到達可能な本編チェーンを深さ順に
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
  return Object.keys(depth).sort((a, b) => depth[a] - depth[b] || (byId[a].areaLevel || 0) - (byId[b].areaLevel || 0))
    .map(id => ({ id, depth: depth[id], areaLevel: byId[id].areaLevel || 0 }))
}

async function runExpedition(areaId, tier, party, seed) {
  const engine = new ExpeditionEngine(seed)
  return suppressEngineLogs(() => engine.generateExpedition(
    { partyId: 'thr', areaId, tier, returnPolicy: 'never', clientVersion: 'thr' },
    party.map(g => ({ ...g, currentHp: undefined })),
  ))
}

async function measure(areaId, level, personaId) {
  const persona = getPersona(personaId)
  const simulate = async (party, tier, seed) => extractExpeditionMetrics(await runExpedition(areaId, tier, party, seed))
  const party = await persona.buildParty({ level, size: SIZE, areaId, tier: 0, tiers: [0], simulate })
  const per = []
  for (let s = 1; s <= SEEDS; s++) per.push(extractExpeditionMetrics(await runExpedition(areaId, 0, party, s)))
  return aggregateMetrics(per)
}

async function threshold(areaId, personaId) {
  let best = null
  for (const L of LEVEL_GRID) {
    const agg = await measure(areaId, L, personaId)
    if (agg.successRate * 100 >= SUCCESS_TH) return { level: L, agg }
    best = agg
  }
  return { level: null, agg: best } // 最高レベルでも未達
}

async function main() {
  const chain = mainChain()
  const rows = []
  for (const { id, depth, areaLevel } of chain) {
    const f = await threshold(id, 'floor')
    process.stderr.write(`  ${id} floor=${f.level ?? '>' + LEVEL_GRID[LEVEL_GRID.length - 1]}\n`)
    rows.push({ id, depth, areaLevel, floorLv: f.level, floorAgg: f.agg })
  }
  console.log('area_id,depth,area_level,floor_clear_level,floor_best_defeat_ratio,floor_best_lose_rounds')
  for (const r of rows) {
    const a = r.floorAgg || {}
    console.log([r.id, r.depth, r.areaLevel, r.floorLv ?? 'NONE',
      (a.enemyDefeatRatio * 100 || 0).toFixed(0), (a.loseAvgRounds || 0).toFixed(1)].join(','))
  }
}
main()
