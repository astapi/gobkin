#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const projectRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(projectRoot, 'src')

global.__DEV__ = false
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    return {
      getItem: async () => null,
      setItem: async () => undefined,
    }
  }
  if (request === 'expo-localization') {
    return { getLocales: () => [{ languageCode: 'ja' }] }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(
      this,
      path.join(srcRoot, request.slice(2)),
      parent,
      isMain,
      options,
    )
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

require.extensions['.ts'] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  }).outputText
  module._compile(output, filename)
}

const bootConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
}
console.log = () => undefined
console.info = () => undefined
console.warn = () => undefined
console.error = () => undefined

const { ExpeditionEngine } = require('../src/core/services/ExpeditionEngine')
const { GoblinBirthService } = require('../src/core/services/GoblinBirthService')
const { GoblinEntity } = require('../src/core/domain/GoblinEntity')
const { EquipmentService } = require('../src/core/services/EquipmentService')
const { getAreaConfig } = require('../src/shared/data/expeditionArea')
const { applyGoblinJob } = require('../src/shared/data/goblinJobs')
const { applySkillBonusesToEquipmentBonuses } = require('../src/shared/data/characterSkills')
const allAreaData = require('../src/shared/data/expeditionArea/allArea.json')

console.log = bootConsole.log
console.info = bootConsole.info
console.warn = bootConsole.warn
console.error = bootConsole.error

function shouldHideLog(args) {
  if (typeof args[0] === 'string' && args[0].includes('i18next is made possible')) return
  return false
}

console.log = (...args) => {
  if (shouldHideLog(args)) return
  bootConsole.log(...args)
}
console.info = (...args) => {
  if (shouldHideLog(args)) return
  bootConsole.info(...args)
}

const DUNGEON_ROUTE = [
  'undead_ruins_1',
  'undead_ruins_1',
  'undead_ruins_1',
  'road_1',
  'orc_camp_1',
  'orc_camp_1',
  'orc_camp_1',
  'human_village',
  'wolf_grassland_1',
  'lizardman_swamp_1',
  'lizardman_swamp_1',
  'lizardman_swamp_1',
  'orc_fortress_1',
  'subjugation_force_1',
  'spider_forest_1',
  'dead_grave_1',
  'dead_grave_1',
  'dead_grave_1',
  'harpy_cliff_1',
]

const DEFAULT_OPTIONS = {
  seed: 1,
  trials: 1,
  maxRuns: 10000,
  partySize: 6,
  target: 'subjugation_force_1',
  report: 'text',
  out: null,
}

const AREA_META_BY_ID = new Map((allAreaData.areas ?? []).map(area => [area.id, area]))
const START_LEVEL = 12
const START_CLEARED_AREA_ID = 'goblin_village_1'
const PARTY_BLUEPRINT = [
  { name: 'ガード', job: 'guard', role: 'guard' },
  { name: 'ウォリアー', job: 'warrior', role: 'warrior' },
  { name: 'メイジ', job: 'mage', role: 'mage' },
  { name: 'シーフA', job: 'thief', role: 'thief' },
  { name: 'シーフB', job: 'thief', role: 'thief' },
  { name: 'シーフC', job: 'thief', role: 'thief' },
]
const ROLE_LOADOUTS = {
  guard: [
    'armor_tattered_cloth',
    'armor_leather_vest',
    'armor_fur_vest',
    'armor_armor',
    'armor_mithril',
    'armor_royal',
    'armor_kaiser',
    'armor_ancient',
    'armor_dragon',
    'armor_adamant',
  ],
  warrior: [
    'sword_club',
    'armor_leather_vest',
    'armor_armor',
    'sword_long',
    'gauntlet_gauntlet',
  ],
  mage: [
    'wand_twig',
    'wand_apprentice',
    'wand_wand',
    'wand_mithril',
    'wand_royal',
  ],
  thief: [
    'bow_slingshot',
    'bow_short',
    'bow_long',
    'bow_mithril',
    'gauntlet_cloth_gloves',
    'gauntlet_leather',
    'gauntlet_copper',
    'gauntlet_gauntlet',
    'gauntlet_mithril',
    'gauntlet_royal',
  ],
}
const EQUIPMENT_RULE_LABEL = [
  `start:${START_CLEARED_AREA_ID}`,
  `level:${START_LEVEL}`,
  'jobs:guard,warrior,mage,thief,thief,thief',
  'guard:armor_low_to_high',
  'warrior:sword_club,armor_leather_vest,armor_armor,sword_long,gauntlet_gauntlet',
  'mage:wand_twig_to_wand_royal',
  'thief:bow_to_mithril_then_gauntlet',
].join(',')

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

    if (arg === '--seed') options.seed = Number(readValue())
    else if (arg === '--trials') options.trials = Number(readValue())
    else if (arg === '--max-runs') options.maxRuns = Number(readValue())
    else if (arg === '--party-size') options.partySize = Number(readValue())
    else if (arg === '--target') options.target = readValue()
    else if (arg === '--report') options.report = readValue()
    else if (arg === '--out') options.out = readValue()
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: npm run sim:subjugation:optimized -- [options]

Options:
  --seed <number>      初期シード。デフォルト: ${DEFAULT_OPTIONS.seed}
  --trials <number>    試行回数。デフォルト: ${DEFAULT_OPTIONS.trials}
  --max-runs <number>  1試行あたりの最大遠征数。デフォルト: ${DEFAULT_OPTIONS.maxRuns}
  --target <areaId>    目標ダンジョン。デフォルト: ${DEFAULT_OPTIONS.target}
  --report <text|tsv>  出力形式。tsv は Google スプレッドシート貼り付け向け。
  --out <path>         レポート出力先。未指定なら標準出力。
`)
}

function createSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function getExplorationTimeSec(areaId, isCleared) {
  const meta = AREA_META_BY_ID.get(areaId)
  const area = getAreaConfig(areaId)
  if (!meta && !area) throw new Error(`Area not found: ${areaId}`)
  const first = meta?.exploration_time_sec_first ?? area?.baseDurationSec ?? 0
  const repeat = meta?.exploration_time_sec ?? area?.baseDurationSec ?? first
  return isCleared ? repeat : first
}

function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const parts = []
  if (days > 0) parts.push(`${days}日`)
  if (hours > 0 || parts.length > 0) parts.push(`${hours}時間`)
  if (minutes > 0 || parts.length > 0) parts.push(`${minutes}分`)
  parts.push(`${secs}秒`)
  return parts.join('')
}

function createBaseGoblin(id, name, job) {
  const birthService = new GoblinBirthService(() => 0)
  const born = birthService.createNewGoblin(id, 1)
  const leveled = {
    ...born,
    id,
    name,
    level: START_LEVEL,
    experience: 0,
    effectiveStats: undefined,
    factors: [],
  }
  return {
    ...applyGoblinJob(leveled, job),
    effectiveStats: undefined,
    factors: [],
  }
}

function createInitialParty() {
  return PARTY_BLUEPRINT.map((entry, index) => ({
    ...createBaseGoblin(index, entry.name, entry.job),
    simRole: entry.role,
  }))
}

function suppressEngineLogs(callback) {
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error
  console.log = () => undefined
  console.warn = () => undefined
  console.error = () => undefined
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
    })
}

function distributeExperience(goblins, replay) {
  const partyIds = replay.meta.party.map(id => Number.parseInt(id, 10))
  const byId = new Map(goblins.map(goblin => [goblin.id, goblin]))
  const currentHP = partyIds.map((id) => {
    const goblin = byId.get(id)
    return goblin?.effectiveStats?.hp ?? goblin?.stats.hp ?? 0
  })
  const expById = new Map(partyIds.map(id => [id, 0]))

  for (const event of replay.events) {
    if (event.type !== 'battle' && event.type !== 'boss') continue

    const aliveIndices = []
    for (let index = 0; index < currentHP.length; index++) {
      if (currentHP[index] > 0) aliveIndices.push(index)
    }

    if (event.combat.outcome === 'win' && aliveIndices.length > 0 && event.xp > 0) {
      const expPerMember = Math.floor(event.xp / aliveIndices.length)
      for (const index of aliveIndices) {
        const goblinId = partyIds[index]
        expById.set(goblinId, (expById.get(goblinId) ?? 0) + expPerMember)
      }
    }

    event.combat.allyHPDelta.forEach((delta, index) => {
      if (index < currentHP.length) {
        currentHP[index] = Math.max(0, currentHP[index] + delta)
      }
    })
  }

  const leveledUpIds = []
  const updatedGoblins = goblins.map((goblin) => {
    const exp = expById.get(goblin.id) ?? 0
    if (exp <= 0) return goblin
    const entity = new GoblinEntity(goblin)
    entity.gainExperience(exp)
    const updated = entity.toSnapshot()
    if (updated.level > goblin.level) {
      leveledUpIds.push(goblin.id)
    }
    return updated
  })

  return {
    goblins: updatedGoblins,
    leveledUpIds,
  }
}

function createLoadoutEquipment(goblin) {
  const loadout = ROLE_LOADOUTS[goblin.simRole] ?? []
  const slots = Math.min(EquipmentService.getAvailableSlots(goblin), loadout.length)
  return Array.from({ length: slots }, (_, slotIndex) => ({
    id: `sim_loadout_${goblin.id}_${slotIndex}`,
    templateId: loadout[slotIndex],
    slotIndex,
    goblinId: goblin.id,
  }))
}

function applyEquipmentFlatBonuses(stats, equipmentBonuses) {
  const next = { ...stats }
  for (const bonus of equipmentBonuses) {
    if (bonus.stat === 'hp_flat') next.hp += bonus.value
    else if (bonus.stat === 'atk_flat') next.atk += bonus.value
    else if (bonus.stat === 'def_flat') next.def += bonus.value
    else if (bonus.stat === 'magic_atk_flat') next.magicAtk += bonus.value
    else if (bonus.stat === 'magic_def_flat') next.magicDef += bonus.value
    else if (bonus.stat === 'attackCount_flat') next.attackCount += bonus.value
    else if (bonus.stat === 'accuracy_flat') next.accuracy += bonus.value
    else if (bonus.stat === 'evasion_flat') next.evasion += bonus.value
    else if (bonus.stat === 'magicHeal_flat') next.magicHeal += bonus.value
    else if (bonus.stat === 'critical_rate_percent') next.criticalRate += bonus.value
  }
  return next
}

function applyLoadoutEquipment(goblin) {
  const equippedItems = createLoadoutEquipment(goblin)
  const equipmentBonuses = applySkillBonusesToEquipmentBonuses(
    goblin.skills ?? [],
    EquipmentService.calculateEquipmentBonuses(equippedItems),
  )
  const equipmentSkills = EquipmentService.collectGrantedSkills(equippedItems)
  const stats = applyEquipmentFlatBonuses(goblin.stats, equipmentBonuses)

  return {
    ...goblin,
    stats,
    baseAttributes: undefined,
    effectiveStats: undefined,
    skills: [...(goblin.skills ?? []), ...equipmentSkills],
  }
}

function applyLoadoutEquipmentToParty(goblins, maxPartySize) {
  return goblins.slice(0, maxPartySize).map(applyLoadoutEquipment)
}

async function runExpedition(areaId, goblins, seed, maxPartySize) {
  const engine = new ExpeditionEngine(seed)
  const party = applyLoadoutEquipmentToParty(goblins, maxPartySize)
  return suppressEngineLogs(() =>
    engine.generateExpedition(
      {
        partyId: 'balance-sim',
        areaId,
        returnPolicy: 'never',
        clientVersion: 'balance-sim',
      },
      party.map(goblin => ({ ...goblin, currentHp: undefined })),
    ),
  )
}

async function runTrial(options, trialIndex) {
  const rng = createSeededRandom(options.seed + trialIndex * 1000003)
  const targetIndex = DUNGEON_ROUTE.indexOf(options.target)
  if (targetIndex < 0) {
    throw new Error(`target は次のいずれかを指定してください: ${DUNGEON_ROUTE.join(', ')}`)
  }

  let goblins = createInitialParty()
  let currentIndex = 0
  let highestClearedIndex = -1
  let recoveryTargetIndex = null
  let totalExplorationSec = 0
  const clearedAreaIds = new Set([START_CLEARED_AREA_ID])
  const areaStats = new Map(DUNGEON_ROUTE.map(areaId => [areaId, {
    attempts: 0,
    clears: 0,
    defeats: 0,
    explorationSec: 0,
    firstTimeAttempts: 0,
    repeatTimeAttempts: 0,
  }]))
  const milestones = []

  for (let run = 1; run <= options.maxRuns; run++) {
    const areaId = DUNGEON_ROUTE[currentIndex]
    const seed = Math.floor(rng() * 0x7fffffff)
    const isAreaClearedAtStart = clearedAreaIds.has(areaId)
    const explorationSec = getExplorationTimeSec(areaId, isAreaClearedAtStart)
    totalExplorationSec += explorationSec
    const replay = await runExpedition(areaId, goblins, seed, options.partySize)
    const stats = areaStats.get(areaId)
    stats.attempts++
    stats.explorationSec += explorationSec
    if (isAreaClearedAtStart) stats.repeatTimeAttempts++
    else stats.firstTimeAttempts++

    const experienceResult = distributeExperience(goblins, replay)
    goblins = experienceResult.goblins

    if (replay.summary.success) {
      stats.clears++
      const isNewClear = currentIndex > highestClearedIndex
      highestClearedIndex = Math.max(highestClearedIndex, currentIndex)
      clearedAreaIds.add(areaId)
      if (isNewClear) {
        milestones.push({
          run,
          areaId,
          areaName: replay.meta.areaName,
          partySize: Math.min(goblins.length, options.partySize),
          levels: goblins.slice(0, options.partySize).map(goblin => goblin.level),
          totalExplorationSec,
        })
      }

      if (recoveryTargetIndex !== null) {
        if (experienceResult.leveledUpIds.length > 0) {
          currentIndex = recoveryTargetIndex
          recoveryTargetIndex = null
        }
        continue
      }

      if (currentIndex >= targetIndex) {
        return {
          trial: trialIndex + 1,
          seed: options.seed + trialIndex * 1000003,
          completed: true,
          totalRuns: run,
          totalExplorationSec,
          goblins,
          areaStats,
          milestones,
        }
      }

      currentIndex++
      continue
    }

    stats.defeats++
    const fallbackIndex = Math.max(0, highestClearedIndex)
    if (fallbackIndex < currentIndex) {
      recoveryTargetIndex = currentIndex
      currentIndex = fallbackIndex
    } else {
      currentIndex = fallbackIndex
    }
  }

  return {
    trial: trialIndex + 1,
    seed: options.seed + trialIndex * 1000003,
    completed: false,
    totalRuns: options.maxRuns,
    totalExplorationSec,
    goblins,
    areaStats,
    milestones,
  }
}

function average(values) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values, ratio) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))
  return sorted[index]
}

function printSingleResult(result) {
  console.log(`結果: ${result.completed ? 'クリア' : '未達'}`)
  console.log(`開始条件: ゴブリン集落・中枢クリア後 / 6匹全員Lv${START_LEVEL}`)
  console.log('ジョブ: guard, warrior, mage, thief, thief, thief')
  console.log(`装備条件: ${EQUIPMENT_RULE_LABEL}`)
  console.log(`総遠征数: ${result.totalRuns}`)
  console.log(`実探索時間: ${formatDuration(result.totalExplorationSec)} (${result.totalExplorationSec}秒)`)
  console.log(`最終Lv: ${result.goblins.map(goblin => `${goblin.name} Lv${goblin.level}`).join(' / ')}`)
  console.log('')
  console.log('クリア到達:')
  for (const milestone of result.milestones) {
    console.log(
      `- #${milestone.run} ${milestone.areaName}: ${formatDuration(milestone.totalExplorationSec)} / ${milestone.partySize}体 / Lv ${milestone.levels.join(', ')}`,
    )
  }
  console.log('')
  console.log('ダンジョン別:')
  for (const [areaId, stats] of result.areaStats.entries()) {
    const area = getAreaConfig(areaId)
    console.log(
      `- ${area?.name ?? areaId}: 挑戦${stats.attempts} / クリア${stats.clears} / 全滅${stats.defeats} / 探索時間${formatDuration(stats.explorationSec)}`,
    )
  }
}

function printTrialSummary(results) {
  const completed = results.filter(result => result.completed)
  const runs = completed.map(result => result.totalRuns)
  console.log(`試行数: ${results.length}`)
  console.log(`開始条件: ゴブリン集落・中枢クリア後 / 6匹全員Lv${START_LEVEL}`)
  console.log(`装備条件: ${EQUIPMENT_RULE_LABEL}`)
  console.log(`到達率: ${completed.length}/${results.length}`)
  if (completed.length === 0) return

  console.log(
    `総遠征数: 平均${average(runs).toFixed(1)} / p50 ${percentile(runs, 0.5)} / p90 ${percentile(runs, 0.9)} / 最小${Math.min(...runs)} / 最大${Math.max(...runs)}`,
  )

  const explorationTimes = completed.map(result => result.totalExplorationSec)
  console.log(
    `実探索時間: 平均${formatDuration(Math.round(average(explorationTimes)))} / p50 ${formatDuration(percentile(explorationTimes, 0.5))} / p90 ${formatDuration(percentile(explorationTimes, 0.9))}`,
  )

  const finalLevels = completed.map(result => average(result.goblins.map(goblin => goblin.level)))
  console.log(
    `最終平均Lv: 平均${average(finalLevels).toFixed(1)} / p50 ${percentile(finalLevels, 0.5).toFixed(1)} / p90 ${percentile(finalLevels, 0.9).toFixed(1)}`,
  )
}

function toTsvValue(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}

function buildTsvReport(results, options) {
  const headers = [
    'trial',
    'seed',
    'target',
    'equipment_rule',
    'completed',
    'total_runs',
    'total_exploration_sec',
    'total_exploration_time',
    'party_size',
    'final_avg_level',
    'final_levels',
    'dungeon_id',
    'dungeon_name',
    'attempts',
    'clears',
    'defeats',
    'exploration_sec',
    'exploration_time',
    'first_time_attempts',
    'repeat_time_attempts',
    'first_clear_run',
    'first_clear_total_exploration_sec',
    'first_clear_total_exploration_time',
    'first_clear_party_size',
    'first_clear_levels',
  ]
  const lines = [headers.join('\t')]

  for (const result of results) {
    const finalLevels = result.goblins.slice(0, options.partySize).map(goblin => goblin.level)
    const finalAvgLevel = average(finalLevels).toFixed(1)
    const milestoneByAreaId = new Map(result.milestones.map(milestone => [milestone.areaId, milestone]))

    for (const areaId of DUNGEON_ROUTE) {
      const area = getAreaConfig(areaId)
      const stats = result.areaStats.get(areaId) ?? { attempts: 0, clears: 0, defeats: 0 }
      const milestone = milestoneByAreaId.get(areaId)
      const row = [
        result.trial,
        result.seed,
        options.target,
        EQUIPMENT_RULE_LABEL,
        result.completed ? 'TRUE' : 'FALSE',
        result.totalRuns,
        result.totalExplorationSec,
        formatDuration(result.totalExplorationSec),
        Math.min(result.goblins.length, options.partySize),
        finalAvgLevel,
        finalLevels.join(','),
        areaId,
        area?.name ?? areaId,
        stats.attempts,
        stats.clears,
        stats.defeats,
        stats.explorationSec,
        formatDuration(stats.explorationSec),
        stats.firstTimeAttempts,
        stats.repeatTimeAttempts,
        milestone?.run,
        milestone?.totalExplorationSec,
        milestone ? formatDuration(milestone.totalExplorationSec) : undefined,
        milestone?.partySize,
        milestone?.levels.join(','),
      ]
      lines.push(row.map(toTsvValue).join('\t'))
    }
  }

  return `${lines.join('\n')}\n`
}

function writeOutput(content, outPath) {
  if (!outPath) {
    process.stdout.write(content)
    return
  }
  const resolvedPath = path.resolve(projectRoot, outPath)
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
  fs.writeFileSync(resolvedPath, content, 'utf8')
  console.log(`レポートを書き出しました: ${resolvedPath}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  if (!Number.isInteger(options.seed) || options.seed < 0) throw new Error('--seed は0以上の整数にしてください')
  if (!Number.isInteger(options.trials) || options.trials < 1) throw new Error('--trials は1以上の整数にしてください')
  if (!Number.isInteger(options.maxRuns) || options.maxRuns < 1) throw new Error('--max-runs は1以上の整数にしてください')
  if (!Number.isInteger(options.partySize) || options.partySize < 1) throw new Error('--party-size は1以上の整数にしてください')
  if (!['text', 'tsv'].includes(options.report)) throw new Error('--report は text または tsv を指定してください')

  const results = []
  for (let index = 0; index < options.trials; index++) {
    results.push(await runTrial(options, index))
  }

  if (options.report === 'tsv') {
    writeOutput(buildTsvReport(results, options), options.out)
  } else if (options.trials === 1) {
    printSingleResult(results[0])
  } else {
    printTrialSummary(results)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
