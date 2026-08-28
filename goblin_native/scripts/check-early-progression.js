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
const { GoblinStatCalculator } = require('../src/core/services/GoblinStatCalculator')
const { GoblinEntity } = require('../src/core/domain/GoblinEntity')
const { FactorService } = require('../src/core/services/FactorService')
const { founderGoblinSeed } = require('../src/shared/data/founderGoblin')
const { getCharacterSkill } = require('../src/shared/data/skillCatalog')
const {
  getExpBonusPercentFromSkills,
  getExpMultiplierFromSkills,
} = require('../src/shared/data/characterSkills')
const { isDungeonCompleted } = require('../src/shared/utils/expeditionClear')

console.log = bootConsole.log
console.info = bootConsole.info
console.warn = bootConsole.warn
console.error = bootConsole.error

const DEFAULT_TRIALS = 100
const DEFAULT_SEED = 1

function createSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function parseArgs(argv) {
  const options = {
    trials: DEFAULT_TRIALS,
    seed: DEFAULT_SEED,
  }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const readValue = () => {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${arg} の値がありません`)
      index++
      return value
    }
    if (arg === '--trials') options.trials = Number(readValue())
    else if (arg === '--seed') options.seed = Number(readValue())
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: npm run sim:early-progression-check -- [options]

Options:
  --trials <number>  試行回数。デフォルト: ${DEFAULT_TRIALS}
  --seed <number>    初期シード。デフォルト: ${DEFAULT_SEED}
`)
}

function createMarku() {
  const goblin = {
    ...founderGoblinSeed,
    stats: {
      hp: founderGoblinSeed.stats.hp,
      atk: founderGoblinSeed.stats.atk,
      magicAtk: 0,
      def: founderGoblinSeed.stats.def,
      magicDef: 0,
      attackCount: founderGoblinSeed.stats.attackCount,
      accuracy: founderGoblinSeed.stats.accuracy,
      evasion: founderGoblinSeed.stats.evasion,
      magicHeal: 0,
      criticalRate: 0,
    },
    skills: founderGoblinSeed.defaultSkillIds.map((skillId) => getCharacterSkill(skillId)),
    factors: [],
  }
  goblin.effectiveStats = GoblinStatCalculator.calculate(goblin)
  return goblin
}

function createNewborn(id) {
  const birth = new GoblinBirthService(() => 0.5)
  return birth.createNewGoblin(id, 1)
}

function buildParty(kind) {
  if (kind === 'marku') return [createMarku()]
  if (kind === 'marku_plus_1') return [createMarku(), createNewborn(1)]
  if (kind === 'marku_plus_2') return [createMarku(), createNewborn(1), createNewborn(2)]
  throw new Error(`Unknown party kind: ${kind}`)
}

function applyExpFromReplay(party, replay) {
  const goblinById = new Map(party.map((goblin) => [goblin.id, goblin]))
  const partyIds = replay.meta.party.map((id) => Number.parseInt(id, 10))
  const currentHP = partyIds.map((id) => {
    const goblin = goblinById.get(id)
    return goblin?.currentHp === 0 ? 0 : (goblin?.effectiveStats ?? goblin?.stats)?.hp ?? 0
  })
  const perGoblinExp = new Map(party.map((goblin) => [goblin.id, 0]))

  for (const event of replay.events) {
    if (event.type !== 'battle' && event.type !== 'boss') continue

    const aliveIndices = []
    for (let index = 0; index < partyIds.length; index++) {
      if (currentHP[index] > 0) aliveIndices.push(index)
    }

    if (event.combat.outcome === 'win' && aliveIndices.length > 0 && event.xp > 0) {
      const xpPerMember = Math.floor(event.xp / aliveIndices.length)
      for (const index of aliveIndices) {
        const goblinId = partyIds[index]
        perGoblinExp.set(goblinId, (perGoblinExp.get(goblinId) ?? 0) + xpPerMember)
      }
    }

    event.combat.allyHPDelta.forEach((delta, index) => {
      if (index < currentHP.length) {
        currentHP[index] = Math.max(0, currentHP[index] + delta)
      }
    })
  }

  return party.map((goblin) => {
    const baseExp = perGoblinExp.get(goblin.id) ?? 0
    const expBonusPercent = getExpBonusPercentFromSkills(goblin.skills)
    const expMultiplier = getExpMultiplierFromSkills(goblin.skills)
    const expToGain = Math.max(0, Math.floor(baseExp * (1 + Math.max(0, expBonusPercent) / 100) * expMultiplier))
    if (expToGain <= 0) return goblin

    const entity = new GoblinEntity(goblin)
    entity.gainExperience(expToGain)
    return entity.toSnapshot()
  })
}

function applyFirstSlimeClearFactor(party, replay) {
  if (!isDungeonCompleted(replay)) return party
  return party.map((goblin) => FactorService.addFactors(goblin, ['slime']))
}

async function buildPartyAfterSlimeClear(seed) {
  const initialParty = [createMarku()]
  const engine = new ExpeditionEngine(seed)
  const replay = await engine.generateExpedition(
    {
      partyId: 'setup_slime_cave_clear',
      areaId: 'slime_cave',
      returnPolicy: 'never',
      clientVersion: 'early-progression-check',
    },
    initialParty.map((goblin) => ({ ...goblin, currentHp: undefined })),
  )

  if (!isDungeonCompleted(replay)) {
    return { party: initialParty, slimeCleared: false, slimeReplay: replay }
  }

  const leveledParty = applyFirstSlimeClearFactor(applyExpFromReplay(initialParty, replay), replay)
  const birth = new GoblinBirthService(createSeededRandom(seed + 1701))
  const newborn = birth.createNewGoblin(
    1,
    undefined,
    leveledParty,
    replay.meta.effectiveAreaLevel ?? replay.meta.areaLevel ?? 1,
    1,
  )
  return {
    party: [...leveledParty, newborn],
    slimeCleared: true,
    slimeReplay: replay,
  }
}

function summarizeReplay(replay) {
  const battles = replay.events.filter((event) => event.type === 'battle' || event.type === 'boss')
  const battleWins = battles.filter((event) => event.combat?.outcome === 'win').length
  const returnEvent = replay.events.findLast?.((event) => event.type === 'return')
    ?? [...replay.events].reverse().find((event) => event.type === 'return')
  return {
    success: replay.summary.success === true,
    reason: returnEvent?.reason ?? (replay.summary.success ? 'completed' : 'unknown'),
    maxFloor: replay.summary.maxFloorReached,
    xp: replay.summary.xpGained,
    gold: replay.summary.goldGained,
    battles: battles.length,
    battleWins,
  }
}

async function runScenario(scenario, options) {
  const totals = {
    success: 0,
    completed: 0,
    defeated: 0,
    policyReturn: 0,
    unknown: 0,
    slimeCleared: 0,
    slimeXp: 0,
    partySize: 0,
    markuLevel: 0,
    newbornLevel: 0,
    maxFloor: 0,
    xp: 0,
    gold: 0,
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
      const trialSeed = options.seed + index * 7919 + scenario.seedOffset
      const setup = scenario.setup === 'after_slime_clear'
        ? await buildPartyAfterSlimeClear(trialSeed)
        : { party: buildParty(scenario.party), slimeCleared: true }
      const engine = new ExpeditionEngine(trialSeed + 313)
      const replay = await engine.generateExpedition(
        {
          partyId: scenario.id,
          areaId: scenario.areaId,
          targetFloor: scenario.targetFloor,
          returnPolicy: 'never',
          clientVersion: 'early-progression-check',
        },
        setup.party.map((goblin) => ({ ...goblin, currentHp: undefined })),
      )
      const summary = summarizeReplay(replay)
      if (summary.success) totals.success++
      if (summary.reason === 'completed') totals.completed++
      else if (summary.reason === 'defeated') totals.defeated++
      else if (summary.reason === 'policy_return') totals.policyReturn++
      else totals.unknown++
      if (scenario.setup === 'after_slime_clear' && setup.slimeCleared) {
        totals.slimeCleared++
        totals.slimeXp += setup.slimeReplay?.summary?.xpGained ?? 0
      }
      totals.partySize += setup.party.length
      totals.markuLevel += setup.party[0]?.level ?? 0
      totals.newbornLevel += setup.party[1]?.level ?? 0
      totals.maxFloor += summary.maxFloor
      totals.xp += summary.xp
      totals.gold += summary.gold
      totals.battles += summary.battles
      totals.battleWins += summary.battleWins
    }
  } finally {
    console.log = originalLog
    console.info = originalInfo
    console.warn = originalWarn
    console.error = originalError
  }

  const divide = (value) => Math.round((value / options.trials) * 10) / 10
  return {
    id: scenario.id,
    areaId: scenario.areaId,
    targetFloor: scenario.targetFloor ?? 'deepest',
    setup: scenario.setup ?? 'initial',
    party: scenario.party,
    trials: options.trials,
    successRate: `${Math.round((totals.success / options.trials) * 100)}%`,
    completed: totals.completed,
    defeated: totals.defeated,
    policyReturn: totals.policyReturn,
    unknown: totals.unknown,
    slimeCleared: scenario.setup === 'after_slime_clear'
      ? `${Math.round((totals.slimeCleared / options.trials) * 100)}%`
      : '-',
    avgSlimeXp: scenario.setup === 'after_slime_clear' ? divide(totals.slimeXp) : '-',
    avgPartySize: divide(totals.partySize),
    avgMarkuLevel: divide(totals.markuLevel),
    avgNewbornLevel: divide(totals.newbornLevel),
    avgMaxFloor: divide(totals.maxFloor),
    avgXp: divide(totals.xp),
    avgGold: divide(totals.gold),
    avgBattles: divide(totals.battles),
    avgBattleWins: divide(totals.battleWins),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const scenarios = [
    { id: 'slime_cave_marku_solo_clear', areaId: 'slime_cave', targetFloor: null, party: 'marku', seedOffset: 0 },
    { id: 'forest_1f_marku_solo_return', areaId: 'forest_outskirts', targetFloor: 1, party: 'marku', seedOffset: 100000 },
    { id: 'forest_2f_marku_solo_pressure', areaId: 'forest_outskirts', targetFloor: 2, party: 'marku', seedOffset: 200000 },
    { id: 'after_slime_forest_1f_return', areaId: 'forest_outskirts', targetFloor: 1, party: 'progressed', setup: 'after_slime_clear', seedOffset: 300000 },
    { id: 'after_slime_forest_2f_pressure', areaId: 'forest_outskirts', targetFloor: 2, party: 'progressed', setup: 'after_slime_clear', seedOffset: 400000 },
  ]

  const rows = []
  for (const scenario of scenarios) {
    rows.push(await runScenario(scenario, options))
  }

  console.table(rows)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
