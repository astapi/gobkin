// 指定エリアの floor / strategist 必要Lv を単体測定する(analyzeThresholds の単エリア版)。
// 実行: node scripts/balance/measureArea.js orc_camp_1 human_village
require('./headless/runtime')
const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
const { getPersona } = require('./headless/personas')
const { extractExpeditionMetrics, aggregateMetrics } = require('./headless/metrics')
const { suppressEngineLogs } = require('./headless/runtime')

const SUCCESS_TH = 80
const SEEDS = 30
const SIZE = 6
const LEVEL_GRID = [3, 5, 8, 10, 13, 16, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 180]

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
  return { level: null, agg: best }
}

async function main() {
  const areas = process.argv.slice(2)
  if (!areas.length) { console.error('usage: node measureArea.js <areaId> [areaId...]'); process.exit(1) }
  console.log('area_id,floor_clear_level,floor_best_defeat_ratio,floor_best_lose_rounds,strategist_clear_level,strategist_defeat_ratio')
  for (const id of areas) {
    const f = await threshold(id, 'floor')
    const s = await threshold(id, 'strategist')
    const fa = f.agg || {}, sa = s.agg || {}
    process.stderr.write(`  ${id}: floor=${f.level ?? '>180'} strategist=${s.level ?? '>180'}\n`)
    console.log([id, f.level ?? 'NONE', (fa.enemyDefeatRatio * 100 || 0).toFixed(0), (fa.loseAvgRounds || 0).toFixed(1),
      s.level ?? 'NONE', (sa.enemyDefeatRatio * 100 || 0).toFixed(0)].join(','))
  }
}
main()
