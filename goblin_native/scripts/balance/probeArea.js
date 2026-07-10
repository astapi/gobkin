// 指定エリアを任意レベルで floor 成功率のみ細かく測る。
// 実行: node scripts/balance/probeArea.js "70,75,80,85" orc_camp_1 human_village
require('./headless/runtime')
const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
const { getPersona } = require('./headless/personas')
const { extractExpeditionMetrics, aggregateMetrics } = require('./headless/metrics')
const { suppressEngineLogs } = require('./headless/runtime')

const SEEDS = 30, SIZE = 6

async function runExpedition(areaId, tier, party, seed) {
  const engine = new ExpeditionEngine(seed)
  return suppressEngineLogs(() => engine.generateExpedition(
    { partyId: 'thr', areaId, tier, returnPolicy: 'never', clientVersion: 'thr' },
    party.map(g => ({ ...g, currentHp: undefined })),
  ))
}
async function measure(areaId, level) {
  const persona = getPersona('floor')
  const simulate = async (party, tier, seed) => extractExpeditionMetrics(await runExpedition(areaId, tier, party, seed))
  const party = await persona.buildParty({ level, size: SIZE, areaId, tier: 0, tiers: [0], simulate })
  const per = []
  for (let s = 1; s <= SEEDS; s++) per.push(extractExpeditionMetrics(await runExpedition(areaId, 0, party, s)))
  return aggregateMetrics(per)
}
async function main() {
  const levels = process.argv[2].split(',').map(Number)
  const areas = process.argv.slice(3)
  const header = ['area_id', ...levels.map(l => 'L' + l)]
  console.log(header.join('\t'))
  for (const id of areas) {
    const cells = []
    for (const L of levels) { const a = await measure(id, L); cells.push((a.successRate * 100).toFixed(0) + '%') }
    console.log([id, ...cells].join('\t'))
  }
}
main()
