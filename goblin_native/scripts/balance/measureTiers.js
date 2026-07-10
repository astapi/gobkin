// 指定エリアを Tier別に floor / strategist 必要Lv 測定する。
// 実行: node scripts/balance/measureTiers.js "0,1,2,3,4" lizardman_swamp_1 orc_fortress_1 subjugation_force_1
require('./headless/runtime')
const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
const { getPersona } = require('./headless/personas')
const { extractExpeditionMetrics, aggregateMetrics } = require('./headless/metrics')
const { suppressEngineLogs } = require('./headless/runtime')
const { DUNGEON_TIER_META } = require('@/shared/types/DungeonTier')

const SUCCESS_TH = 80
const SEEDS = 20
const SIZE = 6
const LEVEL_GRID = [3, 5, 8, 10, 13, 16, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 180, 220, 260, 300]

async function runExpedition(areaId, tier, party, seed) {
  const engine = new ExpeditionEngine(seed)
  return suppressEngineLogs(() => engine.generateExpedition(
    { partyId: 'thr', areaId, tier, returnPolicy: 'never', clientVersion: 'thr' },
    party.map(g => ({ ...g, currentHp: undefined })),
  ))
}

async function measure(areaId, tier, level, personaId) {
  const persona = getPersona(personaId)
  const simulate = async (party, t, seed) => extractExpeditionMetrics(await runExpedition(areaId, t, party, seed))
  const party = await persona.buildParty({ level, size: SIZE, areaId, tier, tiers: [tier], simulate })
  const per = []
  for (let s = 1; s <= SEEDS; s++) per.push(extractExpeditionMetrics(await runExpedition(areaId, tier, party, s)))
  return aggregateMetrics(per)
}

async function threshold(areaId, tier, personaId) {
  for (const L of LEVEL_GRID) {
    const agg = await measure(areaId, tier, L, personaId)
    if (agg.successRate * 100 >= SUCCESS_TH) return L
  }
  return null
}

async function main() {
  const tiers = process.argv[2].split(',').map(Number)
  const areas = process.argv.slice(3)
  const label = t => (DUNGEON_TIER_META[t].prefix || '通常')
  console.log('area_id,tier,tier_name,floor_req_level,strategist_req_level')
  for (const id of areas) {
    for (const t of tiers) {
      const f = await threshold(id, t, 'floor')
      const s = await threshold(id, t, 'strategist')
      process.stderr.write(`  ${id} T${t}(${label(t)}): floor=${f ?? '>300'} strategist=${s ?? '>300'}\n`)
      console.log([id, t, label(t), f ?? '>300', s ?? '>300'].join(','))
    }
  }
}
main()
