#!/usr/bin/env node

/**
 * 進行段階ごとの availability 作成と optimizer 実行をまとめて行う。
 *
 * まずは allArea.json の並びを攻略順として扱い、指定地点までの各段階を検証する。
 * optimizer は balance/scenarios に同名シナリオがあるエリアだけ実行する。
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const allAreaPath = path.join(projectRoot, 'src', 'shared', 'data', 'expeditionArea', 'allArea.json')
const scenariosDir = path.join(projectRoot, 'scripts', 'balance', 'scenarios')

const DEFAULT_OPTIONS = {
  through: null,
  outDir: null,
  tiers: {},
  defaultTier: 0,
  level: null,
  levelMode: 'scenario-max',
  levelSweep: null,
  generations: 5,
  population: 12,
  iterations: 3,
  validationIterations: 20,
  elite: 4,
  top: 3,
  seed: 1,
  skipOptimize: false,
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS, tiers: {} }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const readValue = () => {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${arg} の値がありません`)
      index++
      return value
    }
    if (arg === '--through') options.through = readValue()
    else if (arg === '--out-dir') options.outDir = readValue()
    else if (arg === '--tiers') options.tiers = parseTierMap(readValue())
    else if (arg === '--default-tier') options.defaultTier = Number(readValue())
    else if (arg === '--level') options.level = Number(readValue())
    else if (arg === '--level-mode') options.levelMode = readValue()
    else if (arg === '--level-sweep') options.levelSweep = parseLevelSweep(readValue())
    else if (arg === '--generations') options.generations = Number(readValue())
    else if (arg === '--population') options.population = Number(readValue())
    else if (arg === '--iterations') options.iterations = Number(readValue())
    else if (arg === '--validation-iterations') options.validationIterations = Number(readValue())
    else if (arg === '--elite') options.elite = Number(readValue())
    else if (arg === '--top') options.top = Number(readValue())
    else if (arg === '--seed') options.seed = Number(readValue())
    else if (arg === '--skip-optimize') options.skipOptimize = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: npm run sim:progression -- --through <areaId> [options]

Options:
  --through <areaId>            指定エリアまで allArea.json の順番で検証する。必須。
  --out-dir <path>              出力先ディレクトリ。既定: reports/progression-<areaId>
  --tiers <area:tier,...>       個別の到達Tier。例: slime_cave:1,goblin_village_1:0
  --default-tier <n>            制圧済みエリアの既定Tier。デフォルト: ${DEFAULT_OPTIONS.defaultTier}
  --level <n>                   optimizer の固定レベル。
  --level-mode <scenario-max|area-level|fixed>
                               レベル決定方法。デフォルト: ${DEFAULT_OPTIONS.levelMode}
  --level-sweep <min:max:step>  レベルを範囲評価する。例: 5:20:1
  --generations <n>             optimizer 世代数。デフォルト: ${DEFAULT_OPTIONS.generations}
  --population <n>              optimizer 候補数。デフォルト: ${DEFAULT_OPTIONS.population}
  --iterations <n>              optimizer 探索中試行数。デフォルト: ${DEFAULT_OPTIONS.iterations}
  --validation-iterations <n>   optimizer 再検証試行数。デフォルト: ${DEFAULT_OPTIONS.validationIterations}
  --elite <n>                   optimizer elite 数。デフォルト: ${DEFAULT_OPTIONS.elite}
  --top <n>                     保存する候補数。デフォルト: ${DEFAULT_OPTIONS.top}
  --seed <n>                    seed。デフォルト: ${DEFAULT_OPTIONS.seed}
  --skip-optimize               availability のみ作成する。
`)
}

function parseTierMap(value) {
  const result = {}
  for (const entry of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    const [areaId, tierText] = entry.split(':')
    if (!areaId || tierText === undefined) throw new Error(`Tier指定が不正です: ${entry}`)
    const tier = Number(tierText)
    if (!Number.isInteger(tier) || tier < 0 || tier > 5) throw new Error(`Tierは0-5で指定してください: ${entry}`)
    result[areaId] = tier
  }
  return result
}

function parseLevelSweep(value) {
  const [minText, maxText, stepText] = value.split(':')
  const min = Number(minText)
  const max = Number(maxText)
  const step = Number(stepText)
  if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(step)) {
    throw new Error(`--level-sweep は min:max:step の整数で指定してください: ${value}`)
  }
  if (min < 1 || max < min || step < 1) {
    throw new Error(`--level-sweep の範囲が不正です: ${value}`)
  }
  return { min, max, step }
}

function validateOptions(options) {
  if (!options.through) throw new Error('--through は必須です')
  if (!['scenario-max', 'area-level', 'fixed'].includes(options.levelMode)) {
    throw new Error('--level-mode は scenario-max, area-level, fixed のいずれかです')
  }
  if (options.levelMode === 'fixed' && (!Number.isInteger(options.level) || options.level < 1)) {
    throw new Error('--level-mode fixed では --level に1以上の整数が必要です')
  }
  if (!Number.isInteger(options.defaultTier) || options.defaultTier < 0) throw new Error('--default-tier は0以上の整数で指定してください')
  if (!Number.isInteger(options.seed) || options.seed < 0) throw new Error('--seed は0以上の整数で指定してください')
  for (const key of ['generations', 'population', 'iterations', 'validationIterations', 'elite', 'top']) {
    if (!Number.isInteger(options[key]) || options[key] < 0) throw new Error(`--${key} は0以上の整数で指定してください`)
  }
  for (const key of ['generations', 'population', 'iterations', 'validationIterations', 'elite', 'top']) {
    if (options[key] < 1) throw new Error(`--${key} は1以上の整数で指定してください`)
  }
  if (options.defaultTier > 5) throw new Error('--default-tier は0-5で指定してください')
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function runNodeScript(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(`${path.basename(scriptPath)} が失敗しました\n${output}`)
  }
  return result.stdout
}

function getMilestones(areas, through) {
  const throughIndex = areas.findIndex((area) => area.id === through)
  if (throughIndex < 0) throw new Error(`エリアが見つかりません: ${through}`)
  return areas.slice(0, throughIndex + 1)
}

function getScenario(areaId) {
  const filePath = path.join(scenariosDir, `${areaId}.json`)
  if (!fs.existsSync(filePath)) return null
  return readJson(filePath)
}

function decideLevel(options, area, scenario) {
  if (options.levelMode === 'fixed') return options.level
  if (options.levelMode === 'area-level') return area.areaLevel ?? scenario?.levelRange?.max ?? 1
  return scenario?.levelRange?.max ?? area.areaLevel ?? 1
}

function getSweepLevels(options, area, scenario) {
  if (options.levelSweep) {
    const levels = []
    for (let level = options.levelSweep.min; level <= options.levelSweep.max; level += options.levelSweep.step) {
      levels.push(level)
    }
    return levels
  }
  return [decideLevel(options, area, scenario)]
}

function collectNewRareEquipment(previous, current) {
  const previousIds = new Set((previous?.availableEquipment ?? []).filter((entry) => entry.isRare).map((entry) => entry.templateId))
  return current.availableEquipment
    .filter((entry) => entry.isRare && !previousIds.has(entry.templateId))
    .map((entry) => ({
      templateId: entry.templateId,
      name: entry.name,
      sources: entry.sources.filter((source) => source.type === 'rareDrop' || source.type === 'tierRareDrop'),
    }))
}

function getBaseRankFromAvailability(availability) {
  return availability?.baseRank ?? 1
}

function getAvailableJobs(beforeAvailability) {
  const baseRank = getBaseRankFromAvailability(beforeAvailability)
  if (baseRank < 2) return []

  const cleared = new Set(beforeAvailability?.state?.clearedDungeons ?? [])
  const jobs = ['guard', 'warrior', 'thief', 'mage']
  if (cleared.has('road_1')) jobs.push('cleric')
  return jobs
}

function getAvailableVariants(beforeAvailability) {
  return (beforeAvailability?.availableFactors ?? [])
    .map((entry) => entry.factorId)
    .filter(Boolean)
}

function summarizeStrategy(strategy) {
  const candidates = strategy?.candidates ?? []
  const best = candidates[0]
  if (!best) return null
  return {
    winRate: best.result?.winRate ?? 0,
    avgRoundsPerBattle: best.result?.avgRoundsPerBattle ?? null,
    equipmentCost: best.result?.equipmentCost ?? null,
    frequentJobs: strategy.insights?.frequentJobs ?? [],
    frequentVariants: strategy.insights?.frequentVariants ?? [],
    frequentEquipment: strategy.insights?.frequentEquipment ?? [],
  }
}

function summarizeLevelSweep(results) {
  const sorted = [...results].sort((a, b) => a.level - b.level)
  const findLevel = (threshold) => sorted.find((entry) => (entry.best?.winRate ?? 0) >= threshold)?.level ?? null
  return {
    results: sorted,
    clearLevel80: findLevel(0.8),
    clearLevel95: findLevel(0.95),
    lowestWinningLevel: findLevel(1),
  }
}

function simplifyCountEntries(entries, limit = 8) {
  return (entries ?? []).slice(0, limit).map(([id, count]) => ({ id, count }))
}

function collectUsedRareEquipment(strategyPath, rareEquipmentIds) {
  if (!strategyPath || !fs.existsSync(strategyPath)) return []
  const strategy = readJson(strategyPath)
  const ids = strategy.candidates?.[0]?.genome?.members?.flatMap((member) => member.equipmentTemplateIds ?? []) ?? []
  return [...new Set(ids.filter((id) => rareEquipmentIds.has(id)))]
}

function buildCompactSummary(summary, rareEquipmentIds) {
  return {
    version: 1,
    createdAt: summary.createdAt,
    through: summary.through,
    config: {
      tiers: summary.config.tiers,
      defaultTier: summary.config.defaultTier,
      levelMode: summary.config.levelMode,
      levelSweep: summary.config.levelSweep,
      generations: summary.config.generations,
      population: summary.config.population,
      iterations: summary.config.iterations,
      validationIterations: summary.config.validationIterations,
    },
    steps: summary.steps.map((step) => {
      const scenario = step.scenario
      const best = scenario?.best
      const levelSweep = scenario?.levelSweep
      return {
        index: step.index,
        areaId: step.areaId,
        areaName: step.areaName,
        baseRank: step.baseRank,
        maxNormalDropRank: step.maxNormalDropRank,
        equipmentCount: step.counts?.equipment ?? 0,
        rareEquipmentCount: step.counts?.rareEquipment ?? 0,
        newRareEquipment: (step.newRareEquipment ?? []).map((entry) => ({
          templateId: entry.templateId,
          name: entry.name,
        })),
        challenge: scenario ? {
          level: scenario.level,
          clearLevel80: levelSweep?.clearLevel80 ?? null,
          clearLevel95: levelSweep?.clearLevel95 ?? null,
          lowestWinningLevel: levelSweep?.lowestWinningLevel ?? null,
          winRate: best?.winRate ?? null,
          avgRoundsPerBattle: best?.avgRoundsPerBattle ?? null,
          usedRareEquipment: collectUsedRareEquipment(scenario.strategyPath, rareEquipmentIds),
          jobs: scenario.jobs ?? [],
          variants: scenario.variants ?? [],
          frequentJobs: simplifyCountEntries(best?.frequentJobs),
          frequentVariants: simplifyCountEntries(best?.frequentVariants),
          frequentEquipment: simplifyCountEntries(best?.frequentEquipment),
          levelSweep: levelSweep ? levelSweep.results.map((entry) => ({
            level: entry.level,
            winRate: entry.best?.winRate ?? null,
            avgRoundsPerBattle: entry.best?.avgRoundsPerBattle ?? null,
          })) : null,
        } : null,
      }
    }),
  }
}

function formatList(values) {
  return values?.length ? values.join(',') : '-'
}

function formatRate(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '-'
}

function buildTextReport(compact) {
  const lines = [
    `progression ${compact.through}`,
    `createdAt ${compact.createdAt}`,
    `levelMode ${compact.config.levelMode}`,
    `levelSweep ${compact.config.levelSweep ? `${compact.config.levelSweep.min}:${compact.config.levelSweep.max}:${compact.config.levelSweep.step}` : '-'}`,
    '',
  ]

  for (const step of compact.steps) {
    lines.push(`step ${step.index} ${step.areaId}`)
    lines.push(`  equipment ${step.equipmentCount} rare ${step.rareEquipmentCount}`)
    lines.push(`  newRare ${formatList(step.newRareEquipment.map((entry) => entry.templateId))}`)
    if (step.challenge) {
      lines.push(`  challenge level ${step.challenge.level ?? '-'}`)
      lines.push(`  clear80 ${step.challenge.clearLevel80 ?? '-'} clear95 ${step.challenge.clearLevel95 ?? '-'} winRate ${formatRate(step.challenge.winRate)}`)
      lines.push(`  usedRare ${formatList(step.challenge.usedRareEquipment)}`)
      lines.push(`  jobs ${formatList(step.challenge.jobs)}`)
      lines.push(`  variants ${formatList(step.challenge.variants)}`)
      lines.push(`  topEquipment ${formatList(step.challenge.frequentEquipment.slice(0, 6).map((entry) => `${entry.id}:${entry.count}`))}`)
    } else {
      lines.push('  challenge -')
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  validateOptions(options)

  const areas = readJson(allAreaPath).areas
  const milestones = getMilestones(areas, options.through)
  const outDir = path.resolve(projectRoot, options.outDir ?? path.join('reports', `progression-${options.through}`))
  const availabilityScript = path.join(projectRoot, 'scripts', 'analyze-progression-availability.js')
  const optimizerScript = path.join(projectRoot, 'scripts', 'optimize-balance-strategy.js')
  const knowledgePath = path.join(outDir, 'strategy-knowledge.json')
  const steps = []
  let previousAvailability = null
  let previousAvailabilityPath = null

  fs.mkdirSync(outDir, { recursive: true })

  console.log(`# Progression Simulation: through=${options.through}`)
  console.log(`outDir=${outDir}`)

  for (let index = 0; index < milestones.length; index++) {
    const area = milestones[index]
    const cleared = milestones.slice(0, index + 1).map((step) => step.id)
    const tiers = cleared
      .map((areaId) => `${areaId}:${options.tiers[areaId] ?? options.defaultTier}`)
      .join(',')
    const stepPrefix = `${String(index + 1).padStart(2, '0')}-${area.id}`
    const availabilityPath = path.join(outDir, `${stepPrefix}-availability.json`)

    runNodeScript(availabilityScript, [
      '--cleared', cleared.join(','),
      '--tiers', tiers,
      '--out', availabilityPath,
      '--json',
    ])

    const availability = readJson(availabilityPath)
    const newRareEquipment = collectNewRareEquipment(previousAvailability, availability)

    const scenario = getScenario(area.id)
    let strategyPath = null
    let strategySummary = null
    let levelSweep = null
    let challengeAvailabilityPath = null
    let jobs = null
    let variants = null
    let level = null
    if (scenario && !options.skipOptimize) {
      challengeAvailabilityPath = previousAvailabilityPath ?? availabilityPath
      jobs = getAvailableJobs(previousAvailability ?? availability)
      variants = getAvailableVariants(previousAvailability ?? availability)
      const sweepResults = []
      for (const sweepLevel of getSweepLevels(options, area, scenario)) {
        level = sweepLevel
        strategyPath = options.levelSweep
          ? path.join(outDir, `${stepPrefix}-strategy-lv${sweepLevel}.json`)
          : path.join(outDir, `${stepPrefix}-strategy.json`)
        runNodeScript(optimizerScript, [
          '--scenario', area.id,
          '--level', String(sweepLevel),
          '--availability', challengeAvailabilityPath,
          '--jobs', jobs.join(','),
          '--variants', variants.join(','),
          '--generations', String(options.generations),
          '--population', String(options.population),
          '--iterations', String(options.iterations),
          '--validation-iterations', String(options.validationIterations),
          '--elite', String(options.elite),
          '--top', String(options.top),
          '--seed', String(options.seed + index + sweepLevel * 1000),
          '--out', strategyPath,
          '--knowledge', knowledgePath,
        ])
        const best = summarizeStrategy(readJson(strategyPath))
        sweepResults.push({
          level: sweepLevel,
          strategyPath,
          best,
        })
        strategySummary = best
      }
      if (options.levelSweep) {
        levelSweep = summarizeLevelSweep(sweepResults)
        const preferred = levelSweep.results.find((entry) => entry.level === levelSweep.clearLevel80) ?? levelSweep.results[levelSweep.results.length - 1]
        level = preferred?.level ?? null
        strategyPath = preferred?.strategyPath ?? null
        strategySummary = preferred?.best ?? null
      }
    }

    const step = {
      index: index + 1,
      areaId: area.id,
      areaName: area.name,
      cleared,
      maxTier: options.tiers[area.id] ?? options.defaultTier,
      availabilityPath,
      counts: availability.counts,
      baseRank: availability.baseRank,
      maxNormalDropRank: availability.maxNormalDropRank,
      newRareEquipment,
      scenario: scenario ? {
        level,
        strategyPath,
        challengeAvailabilityPath,
        jobs,
        variants,
        levelSweep,
        best: strategySummary,
      } : null,
    }
    steps.push(step)

    const winText = levelSweep
      ? ` clear80=${levelSweep.clearLevel80 ?? '-'} clear95=${levelSweep.clearLevel95 ?? '-'}`
      : (strategySummary ? ` winRate=${(strategySummary.winRate * 100).toFixed(1)}%` : ' no-scenario')
    const rareText = newRareEquipment.length > 0
      ? ` newRare=${newRareEquipment.map((entry) => entry.templateId).join(',')}`
      : ' newRare=-'
    console.log(`${String(index + 1).padStart(2, '0')}. ${area.id}: equipment=${availability.counts.equipment} rare=${availability.counts.rareEquipment}${winText}${rareText}`)

    previousAvailability = availability
    previousAvailabilityPath = availabilityPath
  }

  const summary = {
    version: 1,
    createdAt: new Date().toISOString(),
    config: options,
    through: options.through,
    outDir,
    steps,
  }
  const summaryPath = path.join(outDir, 'summary.json')
  writeJson(summaryPath, summary)
  const allRareEquipmentIds = new Set()
  for (const step of steps) {
    const availability = readJson(step.availabilityPath)
    for (const entry of availability.availableEquipment ?? []) {
      if (entry.isRare) allRareEquipmentIds.add(entry.templateId)
    }
  }
  const compact = buildCompactSummary(summary, allRareEquipmentIds)
  const compactPath = path.join(outDir, 'summary.compact.json')
  writeJson(compactPath, compact)
  const reportPath = path.join(outDir, 'summary.report.txt')
  fs.writeFileSync(reportPath, buildTextReport(compact), 'utf8')
  console.log('')
  console.log(`summary=${summaryPath}`)
  console.log(`compact=${compactPath}`)
  console.log(`report=${reportPath}`)
}

main()
