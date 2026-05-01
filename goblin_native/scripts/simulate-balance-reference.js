#!/usr/bin/env node

/**
 * バランス基準シナリオ シミュレータ
 *
 * 各エリアに対し、レベル × ロードアウト の組み合わせで
 * `ExpeditionEngine` を回して勝率・平均ターン・HP残を集計する。
 *
 * 使い方:
 *   npm run sim:balance:reference -- --scenario goblin_village_3
 *   npm run sim:balance:reference -- --scenario goblin_village_3 --iterations 100
 *   npm run sim:balance:reference -- --scenario goblin_village_3 --report tsv --out reports/gv3.tsv
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

function shouldHideLog(args) {
  if (typeof args[0] === 'string' && args[0].includes('i18next is made possible')) return true
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

const SCENARIOS_DIR = path.join(__dirname, 'balance', 'scenarios')

const DEFAULT_OPTIONS = {
  scenario: null,
  iterations: null, // null → JSONの値を使う
  seed: 1,
  report: 'text',
  out: null,
  levelMin: null,
  levelMax: null,
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
    else if (arg === '--iterations') options.iterations = Number(readValue())
    else if (arg === '--seed') options.seed = Number(readValue())
    else if (arg === '--report') options.report = readValue()
    else if (arg === '--out') options.out = readValue()
    else if (arg === '--level-min') options.levelMin = Number(readValue())
    else if (arg === '--level-max') options.levelMax = Number(readValue())
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: npm run sim:balance:reference -- --scenario <areaId> [options]

Options:
  --scenario <areaId>  シナリオJSON名(scripts/balance/scenarios/<id>.json)。必須。
  --iterations <n>     試行回数の上書き。未指定ならJSONの値。
  --seed <n>           シード。デフォルト: ${DEFAULT_OPTIONS.seed}
  --level-min <n>      レベル範囲の下限を上書き
  --level-max <n>      レベル範囲の上限を上書き
  --report <text|tsv>  出力形式。
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

function loadScenario(scenarioId) {
  const filePath = path.join(SCENARIOS_DIR, `${scenarioId}.json`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`シナリオが見つかりません: ${filePath}`)
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
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
    mods: [],
    factors: [],
    skills: born.skills ?? [],
  }
  goblin = applyVariant(goblin, variantFactorId)
  // applyGoblinJob は job=undefined でも syncGoblinDerivedStats を走らせ、
  // レベルに応じた baseAttributes / 派生ステータスを正規化するので必ず呼ぶ。
  goblin = applyGoblinJob(goblin, job || undefined)
  return { ...goblin, effectiveStats: undefined, mods: [] }
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

function applyLoadoutEquipment(goblin, equipmentTemplateIds) {
  const slotCount = Math.min(EquipmentService.getAvailableSlots(goblin), equipmentTemplateIds.length)
  const equippedItems = Array.from({ length: slotCount }, (_, slotIndex) => ({
    id: `sim_${goblin.id}_${slotIndex}`,
    templateId: equipmentTemplateIds[slotIndex],
    slotIndex,
    goblinId: goblin.id,
  }))

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

function buildParty(loadout, level) {
  return loadout.party.map((member, index) => {
    const base = createBaseGoblin(
      index,
      member.name,
      level,
      member.job,
      member.variantFactorId,
    )
    return applyLoadoutEquipment(base, member.equipmentTemplateIds || [])
  })
}

async function runSingleExpedition(areaId, party, seed) {
  const engine = new ExpeditionEngine(seed)
  return suppressEngineLogs(() =>
    engine.generateExpedition(
      {
        partyId: 'balance-reference',
        areaId,
        returnPolicy: 'never',
        clientVersion: 'balance-reference',
      },
      party.map(g => ({ ...g, currentHp: undefined })),
    ),
  )
}

function summarizeReplay(replay) {
  const success = replay.summary?.success === true
  // ターン数: 全戦闘イベントの rounds の合計
  let totalRounds = 0
  let battleCount = 0
  for (const event of replay.events ?? []) {
    if (event.type === 'battle' || event.type === 'boss') {
      totalRounds += event.combat?.rounds ?? 0
      battleCount++
    }
  }
  return { success, totalRounds, battleCount }
}

async function runIterations(areaId, loadout, level, iterations, seedBase) {
  const party = buildParty(loadout, level)
  let wins = 0
  let totalRounds = 0
  let totalBattles = 0
  for (let i = 0; i < iterations; i++) {
    const seed = (seedBase + i * 7919) | 0
    const replay = await runSingleExpedition(areaId, party, seed)
    const summary = summarizeReplay(replay)
    if (summary.success) wins++
    totalRounds += summary.totalRounds
    totalBattles += summary.battleCount
  }
  return {
    iterations,
    wins,
    winRate: wins / iterations,
    avgRoundsPerBattle: totalBattles > 0 ? totalRounds / totalBattles : 0,
  }
}

function range(min, max, step) {
  const out = []
  for (let v = min; v <= max; v += step) out.push(v)
  return out
}

function findThreshold(rows, loadoutName, threshold) {
  const sorted = [...rows].sort((a, b) => a.level - b.level)
  for (const row of sorted) {
    const cell = row.loadouts[loadoutName]
    if (cell && cell.winRate >= threshold) return row.level
  }
  return null
}

function formatPercent(value) {
  return `${(value * 100).toFixed(0).padStart(3)}%`
}

function printTextReport(scenario, rows, options) {
  const loadoutNames = scenario.loadouts.map(l => l.name)
  bootConsole.log(`# Balance Reference: ${scenario.areaId}`)
  bootConsole.log(`description: ${scenario.description ?? '(none)'}`)
  bootConsole.log(`iterations: ${rows[0]?.loadouts[loadoutNames[0]]?.iterations ?? '?'}, seed: ${options.seed}`)
  bootConsole.log('')

  // 勝率マトリクス
  const header = ['Lv', ...loadoutNames].map(s => s.padStart(16)).join('')
  bootConsole.log(header)
  for (const row of rows) {
    const cells = [String(row.level).padStart(16)]
    for (const name of loadoutNames) {
      const cell = row.loadouts[name]
      cells.push(formatPercent(cell.winRate).padStart(16))
    }
    bootConsole.log(cells.join(''))
  }

  bootConsole.log('')
  bootConsole.log('# 80%勝率に到達した最低レベル')
  for (const name of loadoutNames) {
    const lv = findThreshold(rows, name, 0.8)
    bootConsole.log(`  ${name.padEnd(20)} → ${lv === null ? '範囲内で未達成' : `Lv${lv}`}`)
  }
  bootConsole.log('')
  bootConsole.log('# 50%勝率に到達した最低レベル')
  for (const name of loadoutNames) {
    const lv = findThreshold(rows, name, 0.5)
    bootConsole.log(`  ${name.padEnd(20)} → ${lv === null ? '範囲内で未達成' : `Lv${lv}`}`)
  }
}

function buildTsvReport(scenario, rows) {
  const loadoutNames = scenario.loadouts.map(l => l.name)
  const headers = ['areaId', 'level', ...loadoutNames.flatMap(n => [`${n}_winRate`, `${n}_avgRounds`])]
  const lines = [headers.join('\t')]
  for (const row of rows) {
    const cols = [scenario.areaId, row.level]
    for (const name of loadoutNames) {
      const cell = row.loadouts[name]
      cols.push((cell.winRate * 100).toFixed(1))
      cols.push(cell.avgRoundsPerBattle.toFixed(2))
    }
    lines.push(cols.join('\t'))
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
  bootConsole.log(`レポートを書き出しました: ${resolvedPath}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help || !options.scenario) {
    printHelp()
    return
  }
  if (!['text', 'tsv'].includes(options.report)) throw new Error('--report は text または tsv を指定してください')

  const scenario = loadScenario(options.scenario)
  const iterations = options.iterations ?? scenario.iterations ?? 100
  const levelMin = options.levelMin ?? scenario.levelRange?.min ?? 1
  const levelMax = options.levelMax ?? scenario.levelRange?.max ?? 30
  const step = scenario.levelRange?.step ?? 1
  const levels = range(levelMin, levelMax, step)

  bootConsole.log(`シナリオ: ${scenario.areaId} / iterations=${iterations} / lv ${levelMin}-${levelMax}`)
  bootConsole.log(`ロードアウト: ${scenario.loadouts.map(l => l.name).join(', ')}`)
  bootConsole.log('実行中…')

  const rows = []
  for (const level of levels) {
    const loadoutResults = {}
    for (const loadout of scenario.loadouts) {
      const seedBase = options.seed + level * 1009 + loadout.name.length * 17
      const result = await runIterations(scenario.areaId, loadout, level, iterations, seedBase)
      loadoutResults[loadout.name] = result
      bootConsole.log(`  Lv${level} ${loadout.name}: ${formatPercent(result.winRate)} (${result.wins}/${result.iterations})`)
    }
    rows.push({ level, loadouts: loadoutResults })
  }

  bootConsole.log('')
  if (options.report === 'tsv') {
    writeOutput(buildTsvReport(scenario, rows), options.out)
  } else {
    // テキストは標準出力に直書き
    if (options.out) {
      const buffer = []
      const original = bootConsole.log
      bootConsole.log = (...args) => buffer.push(args.map(String).join(' '))
      printTextReport(scenario, rows, options)
      bootConsole.log = original
      writeOutput(`${buffer.join('\n')}\n`, options.out)
    } else {
      printTextReport(scenario, rows, options)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
