#!/usr/bin/env node

/**
 * 遠征攻略構成の遺伝的探索シミュレータ。
 *
 * 既存シナリオの到達ランク制約を使い、隊列・亜種・ジョブ・装備を探索する。
 * 探索結果は知識ファイルへ保存し、次回実行時の初期集団として再利用する。
 *
 * 使い方:
 *   npm run sim:optimize -- --scenario wolf_grassland_1 --level 30
 *   npm run sim:optimize -- --scenario lizardman_swamp_1 --level 52 --generations 10 --population 30
 */

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
const { EquipmentService } = require('../src/core/services/EquipmentService')
const { applyGoblinJob } = require('../src/shared/data/goblinJobs')
const { applySkillBonusesToEquipmentBonuses } = require('../src/shared/data/characterSkills')
const { getEquipmentTemplates } = require('../src/shared/data/equipmentPoolLoader')
const { getGoblinVariantByFactorId } = require('../src/shared/data/goblinVariants')
const { getCharacterSkill } = require('../src/shared/data/skillCatalog')
const { getLegacyRaceName } = require('../src/shared/types/Race')

console.log = bootConsole.log
console.info = bootConsole.info
console.warn = bootConsole.warn
console.error = bootConsole.error

const SCENARIOS_DIR = path.join(__dirname, 'balance', 'scenarios')
const DEFAULT_KNOWLEDGE_PATH = 'reports/strategy-optimizer-knowledge.json'
const STANDARD_JOBS = ['guard', 'warrior', 'thief', 'mage', 'cleric']
const PARTY_SIZE = 6

const DEFAULT_OPTIONS = {
  scenario: null,
  level: null,
  generations: 20,
  population: 40,
  iterations: 12,
  validationIterations: 200,
  elite: 8,
  top: 5,
  seed: 1,
  out: null,
  knowledge: DEFAULT_KNOWLEDGE_PATH,
  allowRare: false,
  availability: null,
  cleric: 'auto',
  jobs: null,
  variants: null,
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
    if (arg === '--scenario') options.scenario = readValue()
    else if (arg === '--level') options.level = Number(readValue())
    else if (arg === '--generations') options.generations = Number(readValue())
    else if (arg === '--population') options.population = Number(readValue())
    else if (arg === '--iterations') options.iterations = Number(readValue())
    else if (arg === '--validation-iterations') options.validationIterations = Number(readValue())
    else if (arg === '--elite') options.elite = Number(readValue())
    else if (arg === '--top') options.top = Number(readValue())
    else if (arg === '--seed') options.seed = Number(readValue())
    else if (arg === '--out') options.out = readValue()
    else if (arg === '--knowledge') options.knowledge = readValue()
    else if (arg === '--availability') options.availability = readValue()
    else if (arg === '--cleric') options.cleric = readValue()
    else if (arg === '--jobs') options.jobs = readValue().split(',').filter(Boolean)
    else if (arg === '--variants') options.variants = readValue().split(',').filter(Boolean)
    else if (arg === '--allow-rare') options.allowRare = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: npm run sim:optimize -- --scenario <areaId> --level <n> [options]

Options:
  --scenario <areaId>          scripts/balance/scenarios/<id>.json。必須。
  --level <n>                  攻略レベル。必須。
  --generations <n>            世代数。デフォルト: ${DEFAULT_OPTIONS.generations}
  --population <n>             1世代の候補数。デフォルト: ${DEFAULT_OPTIONS.population}
  --iterations <n>             探索中の候補別試行数。デフォルト: ${DEFAULT_OPTIONS.iterations}
  --validation-iterations <n>  上位候補の再検証試行数。デフォルト: ${DEFAULT_OPTIONS.validationIterations}
  --elite <n>                  次世代へ残す上位候補数。デフォルト: ${DEFAULT_OPTIONS.elite}
  --top <n>                    保存する上位候補数。デフォルト: ${DEFAULT_OPTIONS.top}
  --seed <n>                   探索シード。デフォルト: ${DEFAULT_OPTIONS.seed}
  --out <path>                 結果JSON。未指定時は reports/strategy-<areaId>-lv<n>.json。
  --knowledge <path>           次回へ引き継ぐ知識JSON。デフォルト: ${DEFAULT_KNOWLEDGE_PATH}
  --availability <path>        sim:availability の結果JSON。指定時は入手可能装備だけを探索する。
  --cleric <auto|required|optional|forbidden>
                               クレリック制約。auto は Rank2 以降 required。
  --jobs <a,b,...>             探索対象ジョブ。未指定時は guard,warrior,thief,mage,cleric。
  --variants <a,b,...>         探索対象亜種。未指定時は既存シナリオに登場する亜種。
  --allow-rare                 レア装備も候補に含める。
`)
}

function validateOptions(options) {
  if (!options.scenario) throw new Error('--scenario は必須です')
  if (!Number.isInteger(options.level) || options.level < 1) throw new Error('--level は1以上の整数で指定してください')
  for (const key of ['generations', 'population', 'iterations', 'validationIterations', 'elite', 'top']) {
    if (!Number.isInteger(options[key]) || options[key] < 1) throw new Error(`--${key} は1以上の整数で指定してください`)
  }
  if (!['auto', 'required', 'optional', 'forbidden'].includes(options.cleric)) {
    throw new Error('--cleric は auto, required, optional, forbidden のいずれかです')
  }
}

function createSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function pick(random, values) {
  return values[Math.floor(random() * values.length)]
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function loadJson(relativePath, fallback) {
  const resolved = path.resolve(projectRoot, relativePath)
  if (!fs.existsSync(resolved)) return fallback
  return JSON.parse(fs.readFileSync(resolved, 'utf8'))
}

function writeJson(relativePath, value) {
  const resolved = path.resolve(projectRoot, relativePath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return resolved
}

function loadScenario(scenarioId) {
  const filePath = path.join(SCENARIOS_DIR, `${scenarioId}.json`)
  if (!fs.existsSync(filePath)) throw new Error(`シナリオが見つかりません: ${filePath}`)
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadAvailabilityEquipmentIds(filePath) {
  const resolved = path.resolve(projectRoot, filePath)
  if (!fs.existsSync(resolved)) throw new Error(`可用性JSONが見つかりません: ${resolved}`)
  const availability = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  const ids = new Set((availability.availableEquipment ?? [])
    .map((entry) => entry.templateId ?? entry.id)
    .filter(Boolean))
  if (ids.size === 0) throw new Error(`可用性JSONに availableEquipment がありません: ${resolved}`)
  return ids
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

function createBaseGoblin(id, name, level, job, variantFactorId) {
  const birthService = new GoblinBirthService(() => 0)
  const born = birthService.createNewGoblin(id, 1)
  let goblin = {
    ...born,
    id,
    name,
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
    id: `optimizer_${goblin.id}_${slotIndex}`,
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

function buildParty(genome, level) {
  return genome.members.map((member, index) => {
    const base = createBaseGoblin(index, `探索ゴブリン${index + 1}`, level, member.job, member.variantFactorId)
    return applyEquipment(base, member.equipmentTemplateIds)
  })
}

function summarizeReplay(replay) {
  let totalRounds = 0
  let battleCount = 0
  for (const event of replay.events ?? []) {
    if (event.type === 'battle' || event.type === 'boss') {
      totalRounds += event.combat?.rounds ?? 0
      battleCount++
    }
  }
  return {
    success: replay.summary?.success === true,
    totalRounds,
    battleCount,
  }
}

async function runSingleExpedition(areaId, party, seed) {
  const engine = new ExpeditionEngine(seed)
  const originalLog = console.log
  const originalInfo = console.info
  const originalWarn = console.warn
  const originalError = console.error
  console.log = () => undefined
  console.info = () => undefined
  console.warn = () => undefined
  console.error = () => undefined
  try {
    return await engine.generateExpedition(
      {
        partyId: 'strategy-optimizer',
        areaId,
        returnPolicy: 'never',
        clientVersion: 'strategy-optimizer',
      },
      party.map((goblin) => ({ ...goblin, currentHp: undefined })),
    )
  } finally {
    console.log = originalLog
    console.info = originalInfo
    console.warn = originalWarn
    console.error = originalError
  }
}

async function evaluateGenome(context, genome, iterations, seedOffset = 0) {
  const key = `${iterations}:${seedOffset}:${genomeKey(genome)}`
  if (context.cache.has(key)) return context.cache.get(key)
  const party = buildParty(genome, context.options.level)
  let wins = 0
  let totalRounds = 0
  let totalBattles = 0
  for (let index = 0; index < iterations; index++) {
    const replay = await runSingleExpedition(context.scenario.areaId, party, context.options.seed + seedOffset + index * 7919)
    const summary = summarizeReplay(replay)
    if (summary.success) wins++
    totalRounds += summary.totalRounds
    totalBattles += summary.battleCount
  }
  const equipmentCost = genome.members
    .flatMap((member) => member.equipmentTemplateIds)
    .reduce((sum, templateId) => sum + (context.equipmentById.get(templateId)?.price ?? 0), 0)
  const result = {
    wins,
    iterations,
    winRate: wins / iterations,
    avgRoundsPerBattle: totalBattles > 0 ? totalRounds / totalBattles : 0,
    equipmentCost,
  }
  result.score = result.winRate * 1_000_000 - result.avgRoundsPerBattle - equipmentCost / 1_000_000_000
  context.cache.set(key, result)
  return result
}

function genomeKey(genome) {
  return genome.members
    .map((member) => `${member.variantFactorId ?? '-'}:${member.job ?? '-'}:${member.equipmentTemplateIds.join(',')}`)
    .join('|')
}

function getSlotCount(member, level) {
  const goblin = createBaseGoblin(0, 'slot-check', level, member.job, member.variantFactorId)
  return EquipmentService.getAvailableSlots(goblin)
}

function randomEquipmentIds(context, slotCount) {
  return Array.from({ length: slotCount }, () => pick(context.random, context.equipment).id)
}

function randomRole(context) {
  const choices = [
    { job: null, variantFactorId: null },
    ...context.jobs.map((job) => ({ job, variantFactorId: null })),
    ...context.variants.map((variantFactorId) => ({ job: null, variantFactorId })),
  ]
  return clone(pick(context.random, choices))
}

function randomMember(context) {
  const member = { ...randomRole(context), equipmentTemplateIds: [] }
  member.equipmentTemplateIds = randomEquipmentIds(context, getSlotCount(member, context.options.level))
  return member
}

function normalizeMember(context, member) {
  const next = {
    job: member.job ?? null,
    variantFactorId: member.variantFactorId ?? null,
    equipmentTemplateIds: [...(member.equipmentTemplateIds ?? [])],
  }
  if (next.variantFactorId && !context.variants.includes(next.variantFactorId)) next.variantFactorId = null
  if (next.job && !context.jobs.includes(next.job)) next.job = null
  if (next.variantFactorId) next.job = null
  const slots = getSlotCount(next, context.options.level)
  next.equipmentTemplateIds = next.equipmentTemplateIds.filter((id) => context.equipmentById.has(id)).slice(0, slots)
  while (next.equipmentTemplateIds.length < slots) next.equipmentTemplateIds.push(pick(context.random, context.equipment).id)
  return next
}

function hasCleric(genome) {
  return genome.members.some((member) => member.job === 'cleric')
}

function repairGenome(context, genome) {
  const next = { members: [...(genome.members ?? [])].slice(0, PARTY_SIZE).map((member) => normalizeMember(context, member)) }
  while (next.members.length < PARTY_SIZE) next.members.push(randomMember(context))
  if (context.clericMode === 'required' && !hasCleric(next)) {
    next.members[next.members.length - 1] = normalizeMember(context, { job: 'cleric', equipmentTemplateIds: [] })
  }
  if (context.clericMode === 'forbidden') {
    next.members = next.members.map((member) => (
      member.job === 'cleric' ? randomMember(context) : member
    ))
  }
  return next
}

function randomGenome(context) {
  return repairGenome(context, { members: Array.from({ length: PARTY_SIZE }, () => randomMember(context)) })
}

function scenarioLoadoutGenomes(context) {
  return context.scenario.loadouts.map((loadout) => repairGenome(context, {
    members: loadout.party.map((member) => ({
      job: member.job ?? null,
      variantFactorId: member.variantFactorId ?? null,
      equipmentTemplateIds: member.equipmentTemplateIds ?? [],
    })),
  }))
}

function knowledgeGenomes(context, knowledge) {
  return (knowledge.runs ?? [])
    .filter((run) => run.scenario === context.scenario.areaId && run.level === context.options.level)
    .flatMap((run) => run.candidates ?? [])
    .map((candidate) => repairGenome(context, candidate.genome))
}

function mutateGenome(context, genome) {
  const next = clone(genome)
  const mutationCount = 1 + Math.floor(context.random() * 4)
  for (let count = 0; count < mutationCount; count++) {
    const mutation = Math.floor(context.random() * 4)
    const memberIndex = Math.floor(context.random() * next.members.length)
    if (mutation === 0) {
      const otherIndex = Math.floor(context.random() * next.members.length)
      ;[next.members[memberIndex], next.members[otherIndex]] = [next.members[otherIndex], next.members[memberIndex]]
    } else if (mutation === 1) {
      const role = randomRole(context)
      next.members[memberIndex] = { ...next.members[memberIndex], ...role }
    } else {
      const ids = next.members[memberIndex].equipmentTemplateIds
      if (ids.length > 0) ids[Math.floor(context.random() * ids.length)] = pick(context.random, context.equipment).id
    }
  }
  return repairGenome(context, next)
}

function crossover(context, a, b) {
  return repairGenome(context, {
    members: a.members.map((member, index) => clone(context.random() < 0.5 ? member : b.members[index])),
  })
}

function dedupeGenomes(genomes) {
  const unique = new Map()
  for (const genome of genomes) unique.set(genomeKey(genome), genome)
  return [...unique.values()]
}

async function rankGenomes(context, genomes, iterations, seedOffset = 0) {
  const ranked = []
  for (const genome of dedupeGenomes(genomes)) {
    ranked.push({ genome, result: await evaluateGenome(context, genome, iterations, seedOffset) })
  }
  return ranked.sort((a, b) => b.result.score - a.result.score)
}

function buildInsights(candidates) {
  const winners = candidates.filter((candidate) => candidate.result.winRate >= 0.8)
  const source = winners.length > 0 ? winners : candidates.slice(0, 3)
  const count = (values) => Object.entries(values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1])
  return {
    winningCandidateCount: winners.length,
    frequentJobs: count(source.flatMap((candidate) => candidate.genome.members.map((member) => member.job).filter(Boolean))).slice(0, 10),
    frequentVariants: count(source.flatMap((candidate) => candidate.genome.members.map((member) => member.variantFactorId).filter(Boolean))).slice(0, 10),
    frequentEquipment: count(source.flatMap((candidate) => candidate.genome.members.flatMap((member) => member.equipmentTemplateIds))).slice(0, 20),
  }
}

function serializeCandidate(candidate) {
  return {
    result: candidate.result,
    genome: candidate.genome,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  validateOptions(options)
  const scenario = loadScenario(options.scenario)
  const rank = scenario.equipmentFilter?.maxUnlockRank ?? scenario.equipmentFilter?.maxDropRank ?? 1
  const clericMode = options.cleric === 'auto' ? (rank >= 2 ? 'required' : 'optional') : options.cleric
  const jobs = options.jobs ?? STANDARD_JOBS
  if (clericMode === 'required' && !jobs.includes('cleric')) throw new Error('クレリック必須ですが --jobs に cleric が含まれていません')
  const variants = options.variants ?? [...new Set(
    scenario.loadouts.flatMap((loadout) => loadout.party.map((member) => member.variantFactorId).filter(Boolean)),
  )]
  const maxUnlockRank = scenario.equipmentFilter?.maxUnlockRank ?? rank
  const maxDropRank = scenario.equipmentFilter?.maxDropRank ?? rank
  const availabilityEquipmentIds = options.availability ? loadAvailabilityEquipmentIds(options.availability) : null
  const equipment = getEquipmentTemplates().filter((template) => {
    if (!template.id) return false
    if (availabilityEquipmentIds) return availabilityEquipmentIds.has(template.id)
    return (
      (options.allowRare || !template.isRare) &&
      template.unlockRank !== undefined &&
      template.unlockRank <= maxUnlockRank &&
      template.rank !== undefined &&
      template.rank <= maxDropRank
    )
  })
  if (equipment.length === 0) throw new Error('探索可能な装備がありません')

  const knowledge = loadJson(options.knowledge, { version: 1, runs: [] })
  const context = {
    options,
    scenario,
    clericMode,
    jobs,
    variants,
    equipment,
    equipmentById: new Map(equipment.map((template) => [template.id, template])),
    random: createSeededRandom(options.seed),
    cache: new Map(),
  }
  const outputPath = options.out ?? `reports/strategy-${scenario.areaId}-lv${options.level}.json`

  bootConsole.log(`# Strategy Optimizer: ${scenario.areaId} Lv${options.level}`)
  bootConsole.log(`population=${options.population}, generations=${options.generations}, searchIterations=${options.iterations}, validationIterations=${options.validationIterations}`)
  bootConsole.log(`cleric=${clericMode}, jobs=${jobs.join(',')}, variants=${variants.join(',') || '(none)'}, equipment=${equipment.length}, equipmentSource=${options.availability ?? 'scenario-rank'}, rare=${availabilityEquipmentIds ? 'availability' : (options.allowRare ? 'allowed' : 'excluded')}`)

  let population = dedupeGenomes([
    ...scenarioLoadoutGenomes(context),
    ...knowledgeGenomes(context, knowledge),
  ])
  while (population.length < options.population) population.push(randomGenome(context))
  population = population.slice(0, options.population)

  let ranked = []
  for (let generation = 1; generation <= options.generations; generation++) {
    ranked = await rankGenomes(context, population, options.iterations)
    const best = ranked[0]
    bootConsole.log(`generation ${String(generation).padStart(3)}: winRate=${(best.result.winRate * 100).toFixed(1)}% rounds=${best.result.avgRoundsPerBattle.toFixed(2)} cost=${best.result.equipmentCost}`)
    const elites = ranked.slice(0, Math.min(options.elite, ranked.length)).map((candidate) => candidate.genome)
    const next = [...elites]
    while (next.length < options.population) {
      const parentA = pick(context.random, elites)
      const parentB = pick(context.random, elites)
      next.push(mutateGenome(context, crossover(context, parentA, parentB)))
    }
    population = next
  }

  ranked = await rankGenomes(context, population, options.iterations)
  const validationTargets = ranked.slice(0, Math.min(options.top * 2, ranked.length)).map((candidate) => candidate.genome)
  const validated = (await rankGenomes(context, validationTargets, options.validationIterations, 10_000_000)).slice(0, options.top)
  const insights = buildInsights(validated)
  const run = {
    createdAt: new Date().toISOString(),
    scenario: scenario.areaId,
    level: options.level,
    config: {
      generations: options.generations,
      population: options.population,
      iterations: options.iterations,
      validationIterations: options.validationIterations,
      seed: options.seed,
      cleric: clericMode,
      jobs,
      variants,
      maxUnlockRank,
      maxDropRank,
      allowRare: options.allowRare,
      availability: options.availability,
    },
    insights,
    candidates: validated.map(serializeCandidate),
  }
  const resultPath = writeJson(outputPath, run)
  knowledge.runs = [...(knowledge.runs ?? []), run].slice(-100)
  const knowledgePath = writeJson(options.knowledge, knowledge)

  bootConsole.log('')
  bootConsole.log('# 検証済み上位候補')
  validated.forEach((candidate, index) => {
    bootConsole.log(`${index + 1}. winRate=${(candidate.result.winRate * 100).toFixed(1)}% rounds=${candidate.result.avgRoundsPerBattle.toFixed(2)} cost=${candidate.result.equipmentCost}`)
    candidate.genome.members.forEach((member, row) => {
      bootConsole.log(`   ${row + 1}列: variant=${member.variantFactorId ?? '-'} job=${member.job ?? '-'} equipment=${member.equipmentTemplateIds.join(',')}`)
    })
  })
  bootConsole.log('')
  bootConsole.log(`結果を書き出しました: ${resultPath}`)
  bootConsole.log(`知識を更新しました: ${knowledgePath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
