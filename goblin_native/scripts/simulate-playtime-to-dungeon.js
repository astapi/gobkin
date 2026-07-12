#!/usr/bin/env node

/**
 * ゲーム開始から指定ダンジョンの初回クリアまでの経過時間を見積もる。
 *
 * このシミュレーションは、以下を「経過時間」として扱う。
 * - 初回クリア: allArea.json の exploration_time_sec_first
 * - 周回: allArea.json の exploration_time_sec
 * - 経験値: ExpeditionEngine と同じ敵経験値式から求めた期待値
 * - 装備集め: 進行上の装備Tier更新ごとに指定回数の周回
 *
 * 戦闘の勝敗は、balance/out/strategyPremium.csv の
 * strategist 80%到達レベルを採用する。初回クリア失敗による再挑戦は
 * 別途の不確実性として扱い、このモデルには含めない。
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const allAreaPath = path.join(projectRoot, 'src', 'shared', 'data', 'expeditionArea', 'allArea.json')
const strategyPath = path.join(projectRoot, 'scripts', 'balance', 'out', 'strategyPremium.csv')

const MAIN_ROUTE = [
  'slime_cave',
  'forest_outskirts',
  'goblin_village_1',
  'forest_edge_village',
  'old_well_waterway',
  'undead_ruins_1',
  'bandit_hideout',
  'road_1',
  'orc_camp_1',
  'human_village',
  'wolf_grassland_1',
  'lizardman_swamp_1',
  'orc_fortress_1',
  'subjugation_force_1',
]

const FALLBACK_TARGET_LEVELS = {
  slime_cave: 3,
  forest_outskirts: 8,
  goblin_village_1: 10,
  forest_edge_village: 30,
  old_well_waterway: 30,
  undead_ruins_1: 40,
  bandit_hideout: 40,
  road_1: 40,
  orc_camp_1: 40,
  human_village: 40,
  wolf_grassland_1: 40,
  lizardman_swamp_1: 40,
  orc_fortress_1: 40,
  subjugation_force_1: 40,
}

const EQUIPMENT_PLANS = {
  forest_edge_village: { rank: 2, sourceAreaId: 'goblin_village_1', runs: 2 },
  wolf_grassland_1: { rank: 3, sourceAreaId: 'human_village', runs: 3 },
  subjugation_force_1: { rank: 4, sourceAreaId: 'orc_fortress_1', runs: 4 },
}

const DEFAULT_OPTIONS = {
  through: 'subjugation_force_1',
  farmPolicy: 'latest',
  equipmentRuns: null,
  out: path.join('reports', 'playtime-subjugation-force-1.json'),
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const readValue = () => {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${arg} の値がありません`)
      index++
      return value
    }
    if (arg === '--through') options.through = readValue()
    else if (arg === '--farm-policy') options.farmPolicy = readValue()
    else if (arg === '--equipment-runs') options.equipmentRuns = parseEquipmentRuns(readValue())
    else if (arg === '--out') options.out = readValue()
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function parseEquipmentRuns(value) {
  const result = {}
  for (const entry of value.split(',').map(item => item.trim()).filter(Boolean)) {
    const [rankText, runsText] = entry.split(':')
    const rank = Number(rankText.replace(/^rank/i, ''))
    const runs = Number(runsText)
    if (!Number.isInteger(rank) || !Number.isInteger(runs) || rank < 1 || runs < 0) {
      throw new Error(`--equipment-runs は rank:runs の形式で指定してください: ${entry}`)
    }
    result[rank] = runs
  }
  return result
}

function printHelp() {
  console.log(`Usage: npm run sim:playtime -- [options]

Options:
  --through <areaId>       到達対象。デフォルト: ${DEFAULT_OPTIONS.through}
  --farm-policy <policy>   latest または best-xp-hour。デフォルト: latest
  --equipment-runs <spec>  例: rank2:2,rank3:3,rank4:4
  --out <path>             JSON出力先。Markdownも同じ場所に出力
`)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readStrategyTargetLevels() {
  if (!fs.existsSync(strategyPath)) return { ...FALLBACK_TARGET_LEVELS, source: 'fallback' }
  const lines = fs.readFileSync(strategyPath, 'utf8').trim().split('\n')
  const header = lines[0].split(',')
  const areaIndex = header.indexOf('area_id')
  const levelIndex = header.indexOf('optimal_required_level')
  if (areaIndex < 0 || levelIndex < 0) return { ...FALLBACK_TARGET_LEVELS, source: 'fallback' }

  const levels = { source: strategyPath }
  for (const line of lines.slice(1)) {
    const columns = line.split(',')
    const areaId = columns[areaIndex]
    const level = Number(columns[levelIndex])
    if (areaId && Number.isFinite(level) && level > 0) levels[areaId] = level
  }
  return { ...FALLBACK_TARGET_LEVELS, ...levels }
}

function getRoute(through) {
  const index = MAIN_ROUTE.indexOf(through)
  if (index < 0) throw new Error(`メインルート上のエリアではありません: ${through}`)
  return MAIN_ROUTE.slice(0, index + 1)
}

function getAreaData() {
  const allArea = readJson(allAreaPath).areas
  const byId = new Map(allArea.map(area => [area.id, area]))
  for (const area of allArea) {
    const config = readJson(path.join(projectRoot, 'src', 'shared', 'data', 'expeditionArea', `${area.id}.json`))
    area.config = config
    area.enemyDatabase = readJson(path.join(projectRoot, 'src', 'shared', 'data', 'enemy', `${area.id}.json`))
  }
  return byId
}

function enemyExperience(enemy) {
  const raceCoefficient = enemy.raceTags?.includes('human')
    ? 1.15
    : enemy.raceTags?.includes('construct')
      ? 1.2
      : 1
  const base = enemy.level * (enemy.isBoss ? 9.6 : 1.8)
  return Math.round(base * raceCoefficient)
}

function patternExperience(pattern, enemyById) {
  return pattern.enemies.flat().reduce((sum, enemyId) => sum + enemyExperience(enemyById.get(enemyId)), 0)
}

function averagePatternExperience(patterns, enemyById) {
  if (patterns.length === 0) return 0
  return patterns.reduce((sum, pattern) => sum + patternExperience(pattern, enemyById), 0) / patterns.length
}

function expectedExpForDuration(area, durationSec) {
  const config = area.config
  const database = area.enemyDatabase
  const enemyById = new Map(database.enemies.map(enemy => [enemy.id, enemy]))
  const weightTotal = Object.values(config.encounter.eventWeights).reduce((sum, weight) => sum + weight, 0)
  const floorDuration = durationSec / config.floors
  const durationScale = Math.max(1, durationSec / config.baseDurationSec)
  const eventIntervalSec = config.encounter.eventIntervalSec * durationScale
  let randomBattleCountPerFloor = 0
  for (let at = eventIntervalSec; at < floorDuration; at += eventIntervalSec) {
    randomBattleCountPerFloor++
  }

  let expectedExp = 0
  for (let floor = 1; floor <= config.floors; floor++) {
    const normalPatterns = database.patterns.filter(pattern =>
      pattern.floors.includes(floor) && !pattern.isBoss,
    )
    const floorBossPatterns = normalPatterns.filter(pattern => pattern.isFloorBoss)
    const floorEndPatterns = floorBossPatterns.length > 0 ? floorBossPatterns : normalPatterns
    expectedExp += randomBattleCountPerFloor
      * (config.encounter.eventWeights.battle / weightTotal)
      * averagePatternExperience(normalPatterns, enemyById)
    expectedExp += averagePatternExperience(floorEndPatterns, enemyById)
  }

  const bossPattern = database.patterns.find(pattern =>
    pattern.isBoss && pattern.floors.includes(config.floors),
  )
  if (bossPattern) expectedExp += patternExperience(bossPattern, enemyById)
  return expectedExp
}

function buildExperienceTable() {
  // table[level] = Lv1からそのレベルへ到達する累計経験値。
  const table = [0, 0]
  for (let level = 1; level < 200; level++) {
    const nextLevelExp = Math.round(0.00032188652886324764 * Math.pow(level + 9.17, 4.735402233154439))
    table[level + 1] = table[level] + nextLevelExp
  }
  return table
}

function levelFromTotalExp(totalExp, experienceTable) {
  let level = 1
  while (level < 200 && totalExp >= experienceTable[level + 1]) level++
  return level
}

function chooseFarmArea(clearedAreas, areaById, expByArea, policy) {
  if (clearedAreas.length === 0) return null
  if (policy === 'latest') return clearedAreas[clearedAreas.length - 1]
  if (policy !== 'best-xp-hour') throw new Error(`--farm-policy は latest または best-xp-hour です: ${policy}`)
  return clearedAreas.reduce((best, areaId) => {
    const bestRate = expByArea[best] / areaById.get(best).exploration_time_sec
    const currentRate = expByArea[areaId] / areaById.get(areaId).exploration_time_sec
    return currentRate > bestRate ? areaId : best
  }, clearedAreas[0])
}

function getEquipmentPlan(areaId, equipmentRuns) {
  const plan = EQUIPMENT_PLANS[areaId]
  if (!plan) return null
  const runs = equipmentRuns?.[plan.rank] ?? plan.runs
  return { ...plan, runs }
}

function formatHours(seconds) {
  return `${(seconds / 3600).toFixed(2)}h`
}

function simulate(options) {
  const route = getRoute(options.through)
  const areaById = getAreaData()
  const targetLevels = readStrategyTargetLevels()
  const experienceTable = buildExperienceTable()
  const expByArea = {}
  const expectedFirstClearExpByArea = {}
  const expectedRepeatExpByArea = {}
  for (const areaId of route) {
    const area = areaById.get(areaId)
    expectedFirstClearExpByArea[areaId] = expectedExpForDuration(area, area.exploration_time_sec_first)
    expectedRepeatExpByArea[areaId] = expectedExpForDuration(area, area.exploration_time_sec)
    expByArea[areaId] = expectedRepeatExpByArea[areaId]
  }

  const rows = []
  const clearedAreas = []
  let totalExperience = 0
  let elapsedSec = 0
  let firstClearSec = 0
  let levelFarmSec = 0
  let equipmentFarmSec = 0
  let overlapSavedSec = 0

  for (let index = 0; index < route.length; index++) {
    const areaId = route[index]
    const area = areaById.get(areaId)
    const targetLevel = targetLevels[areaId] ?? FALLBACK_TARGET_LEVELS[areaId] ?? area.areaLevel
    const requiredLevel = index === 0
      ? 1
      : Math.max(...route.slice(0, index + 1).map(id => targetLevels[id] ?? FALLBACK_TARGET_LEVELS[id] ?? 1))
    const farmAreaId = chooseFarmArea(clearedAreas, areaById, expByArea, options.farmPolicy)
    const gearPlan = getEquipmentPlan(areaId, options.equipmentRuns)
    let levelRuns = 0
    let levelTimeSec = 0
    let equipmentTimeSec = 0

    if (farmAreaId && totalExperience < experienceTable[requiredLevel]) {
      const neededExp = experienceTable[requiredLevel] - totalExperience
      levelRuns = Math.ceil(neededExp / expectedRepeatExpByArea[farmAreaId])
      levelTimeSec = levelRuns * areaById.get(farmAreaId).exploration_time_sec
      totalExperience += levelRuns * expectedRepeatExpByArea[farmAreaId]
    }

    if (gearPlan) {
      equipmentTimeSec = gearPlan.runs * areaById.get(gearPlan.sourceAreaId).exploration_time_sec
      equipmentFarmSec += equipmentTimeSec
      if (gearPlan.sourceAreaId === farmAreaId) {
        const extraRuns = Math.max(0, gearPlan.runs - levelRuns)
        totalExperience += extraRuns * expectedRepeatExpByArea[gearPlan.sourceAreaId]
        levelTimeSec = Math.max(levelTimeSec, equipmentTimeSec)
      }
    }

    const hasTwoParties = clearedAreas.includes('goblin_village_1')
    let preClearSec = levelTimeSec
    if (gearPlan && gearPlan.sourceAreaId !== farmAreaId) {
      if (hasTwoParties) {
        preClearSec = Math.max(levelTimeSec, equipmentTimeSec)
        overlapSavedSec += Math.min(levelTimeSec, equipmentTimeSec)
      } else {
        preClearSec += equipmentTimeSec
      }
    }

    elapsedSec += preClearSec
    levelFarmSec += levelTimeSec
    const clearTimeSec = area.exploration_time_sec_first
    elapsedSec += clearTimeSec
    firstClearSec += clearTimeSec
    totalExperience += expectedFirstClearExpByArea[areaId]
    clearedAreas.push(areaId)

    rows.push({
      index: index + 1,
      areaId,
      areaName: area.name,
      targetLevel,
      requiredLevel,
      levelBefore: levelFromTotalExp(totalExperience - expectedFirstClearExpByArea[areaId], experienceTable),
      levelFarmAreaId: farmAreaId,
      levelRuns,
      levelFarmTimeSec: levelTimeSec,
      equipmentRank: gearPlan?.rank ?? null,
      equipmentSourceAreaId: gearPlan?.sourceAreaId ?? null,
      equipmentRuns: gearPlan?.runs ?? 0,
      equipmentFarmTimeSec: equipmentTimeSec,
      twoParties: hasTwoParties,
      preClearTimeSec: preClearSec,
      firstClearTimeSec: clearTimeSec,
      levelAfter: levelFromTotalExp(totalExperience, experienceTable),
      cumulativeTimeSec: elapsedSec,
      expectedExpPerFirstClear: expectedFirstClearExpByArea[areaId],
      expectedExpPerRepeat: expectedRepeatExpByArea[areaId],
    })
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    through: options.through,
    farmPolicy: options.farmPolicy,
    targetLevelSource: targetLevels.source,
    equipmentRuns: options.equipmentRuns ?? { rank2: 2, rank3: 3, rank4: 4 },
    assumptions: {
      firstAreaCanBeClearedAtLevel1: true,
      targetLevelsAreStrategist80PercentThresholds: true,
      repeatedRunsUseNormalExplorationTime: true,
      twoPartiesUnlockAfterGoblinVillage: true,
      secondaryPartyExperienceIsNotAddedToMainParty: true,
      failedFirstClearsAndManualInteractionTimeAreExcluded: true,
    },
    totals: {
      elapsedSec,
      elapsedHours: elapsedSec / 3600,
      elapsedDays: elapsedSec / 86400,
      firstClearSec,
      levelFarmSec,
      equipmentFarmSec,
      overlapSavedSec,
    },
    rows,
    expectedFirstClearExpByArea,
    expectedRepeatExpByArea,
  }
}

function buildReport(result) {
  const lines = [
    `# 初回クリアまでのプレイ時間シミュレーション: ${result.through}`,
    '',
    `- 周回方針: ${result.farmPolicy}`,
    `- 経過時間: ${formatHours(result.totals.elapsedSec)} (${result.totals.elapsedDays.toFixed(2)}日)`,
    `- 初回クリア: ${formatHours(result.totals.firstClearSec)}`,
    `- レベル上げ周回: ${formatHours(result.totals.levelFarmSec)}`,
    `- 装備周回: ${formatHours(result.totals.equipmentFarmSec)}`,
    `- 2PT並列による重複時間削減: ${formatHours(result.totals.overlapSavedSec)}`,
    '',
    '| # | ダンジョン | 開始必要Lv / 戦略目標Lv | 周回 | 装備周回 | 初回クリア | 累積 |',
    '|---:|---|---:|---|---|---:|---:|',
  ]
  for (const row of result.rows) {
    const levelFarm = row.levelRuns > 0
      ? `${row.levelRuns}回 ${row.levelFarmAreaId}`
      : '-'
    const equipmentFarm = row.equipmentRuns > 0
      ? `${row.equipmentRuns}回 rank${row.equipmentRank}`
      : '-'
    lines.push(`| ${row.index} | ${row.areaName} | ${row.requiredLevel} / ${row.targetLevel} | ${levelFarm} | ${equipmentFarm} | ${formatHours(row.firstClearTimeSec)} | ${formatHours(row.cumulativeTimeSec)} |`)
  }
  lines.push('', '## 前提', '', '- `latest`: 直前にクリアしたダンジョンを周回。', '- `best-xp-hour`: クリア済みダンジョンの経験値/時間が最大の場所を周回。', '- 経験値は各戦闘パターンの期待値で、実際の乱数・敗北・再挑戦は含まない。', '- ゴブリン集落クリア後は装備周回を別PTで並列化する。ただし主PTのレベル上げ時間そのものは半減させない。', '- 装備周回回数は rank2=2回、rank3=3回、rank4=4回の近似値。', '- `firstClear` / `levelFarm` / `equipmentFarm` は重複を含む内訳。最終経過時間はPT間の並列を反映して別計算する。', '')
  return `${lines.join('\n')}\n`
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  const result = simulate(options)
  const outputPath = path.resolve(projectRoot, options.out)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  const reportPath = outputPath.replace(/\.json$/, '.md')
  fs.writeFileSync(reportPath, buildReport(result), 'utf8')
  console.log(`through=${result.through}`)
  console.log(`farmPolicy=${result.farmPolicy}`)
  console.log(`elapsed=${formatHours(result.totals.elapsedSec)} (${result.totals.elapsedDays.toFixed(2)}日)`)
  console.log(`firstClear=${formatHours(result.totals.firstClearSec)} levelFarm=${formatHours(result.totals.levelFarmSec)} equipmentFarm=${formatHours(result.totals.equipmentFarmSec)}`)
  console.log(`json=${outputPath}`)
  console.log(`report=${reportPath}`)
}

main()
