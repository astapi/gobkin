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
    return { getItem: async () => null, setItem: async () => undefined }
  }
  if (request === 'expo-localization') {
    return { getLocales: () => [{ languageCode: 'ja' }] }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, path.join(srcRoot, request.slice(2)), parent, isMain, options)
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

const bootConsole = { ...console }
console.log = () => undefined
console.info = () => undefined
console.warn = () => undefined
console.error = () => undefined

const { ExpeditionEngine } = require('../src/core/services/ExpeditionEngine')
const { GoblinBirthService } = require('../src/core/services/GoblinBirthService')
const { EquipmentService } = require('../src/core/services/EquipmentService')
const { applyGoblinJob } = require('../src/shared/data/goblinJobs')
const { applySkillBonusesToEquipmentBonuses } = require('../src/shared/data/characterSkills')
const { getGoblinVariantByFactorId } = require('../src/shared/data/goblinVariants')
const { getCharacterSkill } = require('../src/shared/data/skillCatalog')
const { getLegacyRaceName } = require('../src/shared/types/Race')

console.log = bootConsole.log
console.info = bootConsole.info
console.warn = bootConsole.warn
console.error = bootConsole.error

function parseArgs(argv) {
  const options = {
    strategy: null,
    area: null,
    trials: 100,
    seed: 1,
    targets: [1, 2, null],
  }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const readValue = () => {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${arg} の値がありません`)
      index++
      return value
    }
    if (arg === '--strategy') options.strategy = readValue()
    else if (arg === '--area') options.area = readValue()
    else if (arg === '--trials') options.trials = Number(readValue())
    else if (arg === '--seed') options.seed = Number(readValue())
    else if (arg === '--targets') {
      options.targets = readValue().split(',').map((value) => {
        const trimmed = value.trim()
        return trimmed === 'all' || trimmed === 'deepest' ? null : Number(trimmed)
      })
    } else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: node scripts/check-strategy-floor-gates.js --strategy <path> --area <areaId> [options]

Options:
  --strategy <path>  sim:optimize の結果JSON。必須。
  --area <areaId>    検証対象ダンジョン。必須。
  --targets <list>   例: 1,2,all。デフォルト: 1,2,all
  --trials <number>  試行回数。デフォルト: 100
  --seed <number>    初期シード。デフォルト: 1
`)
}

function applyVariant(goblin, variantFactorId) {
  if (!variantFactorId) return goblin
  const def = getGoblinVariantByFactorId(variantFactorId)
  if (!def) return goblin
  const extraSkills = (def.defaultSkillIds || []).map((id) => getCharacterSkill(id))
  return {
    ...goblin,
    raceId: def.raceId,
    race: getLegacyRaceName(def.raceId),
    variantFactorId: def.factorId,
    factors: [def.factorId],
    skills: [...(goblin.skills || []), ...extraSkills],
    baseAttributes: def.baseAttributes ?? goblin.baseAttributes,
    effectiveStats: undefined,
  }
}

function createBaseGoblin(id, level, job, variantFactorId) {
  const birthService = new GoblinBirthService(() => 0)
  const born = birthService.createNewGoblin(id, 1)
  let goblin = {
    ...born,
    id,
    name: `検証ゴブリン${id + 1}`,
    level,
    experience: 0,
    effectiveStats: undefined,
    factors: [],
    skills: born.skills ?? [],
  }
  goblin = applyVariant(goblin, variantFactorId)
  goblin = applyGoblinJob(goblin, job || undefined)
  return { ...goblin, effectiveStats: undefined }
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

function applyEquipment(goblin, equipmentTemplateIds) {
  const slotCount = Math.min(EquipmentService.getAvailableSlots(goblin), equipmentTemplateIds.length)
  const equippedItems = Array.from({ length: slotCount }, (_, slotIndex) => ({
    id: `gate_${goblin.id}_${slotIndex}`,
    templateId: equipmentTemplateIds[slotIndex],
    slotIndex,
    goblinId: goblin.id,
  }))
  const equipmentBonuses = applySkillBonusesToEquipmentBonuses(
    goblin.skills ?? [],
    EquipmentService.calculateEquipmentBonuses(equippedItems),
  )
  return {
    ...goblin,
    stats: applyEquipmentFlatBonuses(goblin.stats, equipmentBonuses),
    baseAttributes: undefined,
    effectiveStats: undefined,
    skills: [...(goblin.skills ?? []), ...EquipmentService.collectGrantedSkills(equippedItems)],
  }
}

function buildParty(strategy) {
  const level = strategy.level
  const members = strategy.candidates?.[0]?.genome?.members
  if (!Number.isInteger(level) || !Array.isArray(members)) {
    throw new Error('strategy JSON に level または candidates[0].genome.members がありません')
  }
  return members.map((member, index) => {
    const base = createBaseGoblin(index, level, member.job, member.variantFactorId)
    return applyEquipment(base, member.equipmentTemplateIds ?? [])
  })
}

function summarizeReplay(replay) {
  const battles = replay.events.filter((event) => event.type === 'battle' || event.type === 'boss')
  const wins = battles.filter((event) => event.combat?.outcome === 'win').length
  const returnEvent = [...replay.events].reverse().find((event) => event.type === 'return')
  return {
    success: replay.summary.success === true,
    reason: returnEvent?.reason ?? (replay.summary.success ? 'completed' : 'unknown'),
    maxFloor: replay.summary.maxFloorReached,
    battles: battles.length,
    wins,
  }
}

async function evaluateTarget(options, party, targetFloor) {
  const totals = {
    success: 0,
    completed: 0,
    defeated: 0,
    policyReturn: 0,
    maxFloor: 0,
    battles: 0,
    battleWins: 0,
  }

  const originalLog = console.log
  const originalInfo = console.info
  const originalWarn = console.warn
  const originalError = console.error
  console.log = () => undefined
  console.info = () => undefined
  console.warn = () => undefined
  console.error = () => undefined
  try {
    for (let index = 0; index < options.trials; index++) {
      const engine = new ExpeditionEngine(options.seed + index * 7919 + (targetFloor ?? 999) * 101)
      const replay = await engine.generateExpedition(
        {
          partyId: 'strategy-floor-gate',
          areaId: options.area,
          targetFloor,
          returnPolicy: 'never',
          clientVersion: 'strategy-floor-gate',
        },
        party.map((goblin) => ({ ...goblin, currentHp: undefined })),
      )
      const summary = summarizeReplay(replay)
      if (summary.success) totals.success++
      if (summary.reason === 'completed') totals.completed++
      else if (summary.reason === 'defeated') totals.defeated++
      else if (summary.reason === 'policy_return') totals.policyReturn++
      totals.maxFloor += summary.maxFloor
      totals.battles += summary.battles
      totals.battleWins += summary.wins
    }
  } finally {
    console.log = originalLog
    console.info = originalInfo
    console.warn = originalWarn
    console.error = originalError
  }

  const avg = (value) => Math.round((value / options.trials) * 10) / 10
  return {
    area: options.area,
    targetFloor: targetFloor ?? 'deepest',
    trials: options.trials,
    successRate: `${Math.round((totals.success / options.trials) * 100)}%`,
    completed: totals.completed,
    defeated: totals.defeated,
    policyReturn: totals.policyReturn,
    avgMaxFloor: avg(totals.maxFloor),
    avgBattles: avg(totals.battles),
    avgBattleWins: avg(totals.battleWins),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  if (!options.strategy) throw new Error('--strategy は必須です')
  if (!options.area) throw new Error('--area は必須です')

  const strategyPath = path.resolve(projectRoot, options.strategy)
  const strategy = JSON.parse(fs.readFileSync(strategyPath, 'utf8'))
  const party = buildParty(strategy)
  const rows = []
  for (const target of options.targets) {
    rows.push(await evaluateTarget(options, party, target))
  }
  console.log(`strategy=${strategyPath}`)
  console.log(`sourceScenario=${strategy.scenario} level=${strategy.level}`)
  console.table(rows)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
