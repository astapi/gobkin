#!/usr/bin/env node

/**
 * 進行状態から、現在入手可能な装備・因子を集計する。
 *
 * レアドロップは敵JSONの rareEquipmentDrops / tierRareEquipmentDrops を参照し、
 * 制圧済みダンジョンと到達済みTierだけを farmable として扱う。
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const areaPath = path.join(projectRoot, 'src', 'shared', 'data', 'expeditionArea', 'allArea.json')
const enemyDir = path.join(projectRoot, 'src', 'shared', 'data', 'enemy')
const equipmentPath = path.join(projectRoot, 'src', 'shared', 'data', 'equipmentPool.json')

const DUNGEON_TIERS = [0, 1, 2, 3, 4, 5]
const DUNGEON_TIER_LEVEL_BONUS = [0, 1, 3, 6, 11, 24]
const DROP_RANK_LEVELS = [
  { level: 500, rank: 7 },
  { level: 300, rank: 7 },
  { level: 200, rank: 6 },
  { level: 150, rank: 6 },
  { level: 120, rank: 5 },
  { level: 99, rank: 5 },
  { level: 70, rank: 4 },
  { level: 58, rank: 4 },
  { level: 40, rank: 3 },
  { level: 30, rank: 3 },
  { level: 20, rank: 2 },
  { level: 12, rank: 1 },
  { level: 4, rank: 1 },
  { level: 1, rank: 0 },
]

const DEFAULT_OPTIONS = {
  state: null,
  cleared: [],
  tiers: {},
  allClearedThrough: null,
  includeUnlocked: false,
  out: null,
  json: false,
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS, cleared: [], tiers: {} }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const readValue = () => {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${arg} の値がありません`)
      index++
      return value
    }
    if (arg === '--state') options.state = readValue()
    else if (arg === '--cleared') options.cleared = parseCsv(readValue())
    else if (arg === '--tiers') options.tiers = parseTierMap(readValue())
    else if (arg === '--all-cleared-through') options.allClearedThrough = readValue()
    else if (arg === '--include-unlocked') options.includeUnlocked = true
    else if (arg === '--out') options.out = readValue()
    else if (arg === '--json') options.json = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: npm run sim:availability -- [options]

Options:
  --state <path>                 進行状態JSON。clearedDungeons/maxTierByDungeon を読む。
  --cleared <a,b,...>            制圧済みダンジョンID。
  --tiers <area:tier,...>        各ダンジョンの到達済み最大Tier。例: slime_cave:1,goblin_village_1:0
  --all-cleared-through <area>   allArea.json の並びで指定ダンジョンまで制圧済みとして扱う。
  --include-unlocked             未制圧だが解放済みのダンジョンもTier0で候補に含める。
  --out <path>                   結果JSONの出力先。
  --json                         標準出力もJSONにする。
`)
}

function parseCsv(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function parseTierMap(value) {
  const result = {}
  for (const entry of parseCsv(value)) {
    const [areaId, tierText] = entry.split(':')
    if (!areaId || tierText === undefined) throw new Error(`Tier指定が不正です: ${entry}`)
    const tier = Number(tierText)
    if (!DUNGEON_TIERS.includes(tier)) throw new Error(`Tierは0-5で指定してください: ${entry}`)
    result[areaId] = tier
  }
  return result
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(relativeOrAbsolutePath, value) {
  const resolved = path.resolve(projectRoot, relativeOrAbsolutePath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return resolved
}

function loadState(options, areas) {
  const state = options.state ? readJson(path.resolve(projectRoot, options.state)) : {}
  const cleared = new Set(state.clearedDungeons ?? [])
  const maxTierByDungeon = { ...(state.maxTierByDungeon ?? {}) }

  for (const areaId of options.cleared) cleared.add(areaId)
  Object.assign(maxTierByDungeon, options.tiers)

  if (options.allClearedThrough) {
    const index = areas.findIndex((area) => area.id === options.allClearedThrough)
    if (index < 0) throw new Error(`--all-cleared-through のエリアが見つかりません: ${options.allClearedThrough}`)
    for (const area of areas.slice(0, index + 1)) {
      cleared.add(area.id)
      if (maxTierByDungeon[area.id] === undefined) maxTierByDungeon[area.id] = 0
    }
  }

  for (const areaId of cleared) {
    if (maxTierByDungeon[areaId] === undefined) maxTierByDungeon[areaId] = 0
  }

  return { clearedDungeons: [...cleared], maxTierByDungeon }
}

function loadEnemyDatabases() {
  const databases = new Map()
  for (const fileName of fs.readdirSync(enemyDir)) {
    if (!fileName.endsWith('.json')) continue
    const areaId = fileName.replace(/\.json$/, '')
    databases.set(areaId, readJson(path.join(enemyDir, fileName)))
  }
  return databases
}

function getTemplates() {
  return readJson(equipmentPath).templates.filter((template) => template.id)
}

function computeBaseRank(areas, clearedSet) {
  return areas.reduce((rank, area) => (
    clearedSet.has(area.id) && Number.isFinite(area.rankUpTarget)
      ? Math.max(rank, area.rankUpTarget)
      : rank
  ), 1)
}

function computeUnlockedAreas(areas, clearedSet) {
  const unlocked = new Set(areas.filter((area) => area.unlocked).map((area) => area.id))
  for (const area of areas) {
    if (area.unlockRequires && clearedSet.has(area.unlockRequires)) unlocked.add(area.id)
    if (!clearedSet.has(area.id)) continue
    if (area.unlockNext) unlocked.add(area.unlockNext)
    for (const next of area.unlockNexts ?? []) unlocked.add(next)
  }
  return [...unlocked].filter((areaId) => areas.some((area) => area.id === areaId))
}

function flattenEnemyIds(value) {
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return []
  return value.flatMap(flattenEnemyIds)
}

function isPatternAvailable(pattern, tier) {
  return (
    (pattern.minTier === undefined || tier >= pattern.minTier) &&
    (pattern.maxTier === undefined || tier <= pattern.maxTier)
  )
}

function enemyAppearsInTier(db, enemyId, tier) {
  const patterns = db.patterns ?? []
  if (patterns.length === 0) return true
  return patterns.some((pattern) => (
    isPatternAvailable(pattern, tier) &&
    flattenEnemyIds(pattern.enemies).includes(enemyId)
  ))
}

function getMaxDropRank(level) {
  const threshold = DROP_RANK_LEVELS.find((entry) => level >= entry.level)
  return threshold?.rank ?? 0
}

function addSource(map, template, source) {
  if (!template?.id) return
  const current = map.get(template.id) ?? {
    templateId: template.id,
    name: template.name,
    category: template.category,
    subCategory: template.subCategory,
    rank: template.rank,
    unlockRank: template.unlockRank,
    isRare: template.isRare === true,
    sources: [],
  }
  current.sources.push(source)
  map.set(template.id, current)
}

function addFactorSource(map, factorId, source) {
  const current = map.get(factorId) ?? { factorId, sources: [] }
  current.sources.push(source)
  map.set(factorId, current)
}

function buildFarmableAreas(areas, state, unlockedAreaIds, includeUnlocked) {
  const clearedSet = new Set(state.clearedDungeons)
  const unlockedSet = new Set(unlockedAreaIds)
  return areas
    .filter((area) => clearedSet.has(area.id) || (includeUnlocked && unlockedSet.has(area.id)))
    .map((area) => ({
      areaId: area.id,
      name: area.name,
      cleared: clearedSet.has(area.id),
      maxTier: clearedSet.has(area.id) ? (state.maxTierByDungeon[area.id] ?? 0) : 0,
    }))
}

function analyzeAvailability(options) {
  const areas = readJson(areaPath).areas
  const state = loadState(options, areas)
  const clearedSet = new Set(state.clearedDungeons)
  const unlockedAreaIds = computeUnlockedAreas(areas, clearedSet)
  const baseRank = computeBaseRank(areas, clearedSet)
  const farmableAreas = buildFarmableAreas(areas, state, unlockedAreaIds, options.includeUnlocked)
  const enemyDatabases = loadEnemyDatabases()
  const templates = getTemplates()
  const templateById = new Map(templates.map((template) => [template.id, template]))
  const equipmentById = new Map()
  const factorsById = new Map()

  for (const template of templates) {
    if (template.unlockRank !== undefined && template.unlockRank <= baseRank && !template.isRare) {
      addSource(equipmentById, template, { type: 'shop', baseRank })
    }
  }

  let maxNormalDropRank = 0
  for (const farmable of farmableAreas) {
    const db = enemyDatabases.get(farmable.areaId)
    if (!db) continue
    for (let tier = 0; tier <= farmable.maxTier; tier++) {
      for (const enemy of db.enemies ?? []) {
        if (!enemyAppearsInTier(db, enemy.id, tier)) continue
        const effectiveLevel = (enemy.level ?? 1) + (DUNGEON_TIER_LEVEL_BONUS[tier] ?? 0)
        const rank = getMaxDropRank(effectiveLevel)
        maxNormalDropRank = Math.max(maxNormalDropRank, rank)

        for (const drop of enemy.rareEquipmentDrops ?? []) {
          addSource(equipmentById, templateById.get(drop.templateId), {
            type: 'rareDrop',
            areaId: farmable.areaId,
            tier,
            enemyId: enemy.id,
            probability: drop.probability,
          })
        }

        for (const tierDrops of enemy.tierRareEquipmentDrops ?? []) {
          if (tierDrops.tier > tier) continue
          for (const drop of tierDrops.drops ?? []) {
            addSource(equipmentById, templateById.get(drop.templateId), {
              type: 'tierRareDrop',
              areaId: farmable.areaId,
              tier,
              requiredTier: tierDrops.tier,
              enemyId: enemy.id,
              probability: drop.probability,
            })
          }
        }

        for (const drop of enemy.factorDrops ?? []) {
          const minTier = drop.minDungeonTier ?? 0
          if (tier < minTier) continue
          addFactorSource(factorsById, drop.factorId, {
            type: 'factorDrop',
            areaId: farmable.areaId,
            tier,
            enemyId: enemy.id,
            probability: drop.probability,
            minDungeonTier: drop.minDungeonTier,
          })
        }
      }
    }
  }

  for (const template of templates) {
    if (template.rank !== undefined && template.rank <= maxNormalDropRank && !template.isRare) {
      addSource(equipmentById, template, { type: 'normalDropRank', maxNormalDropRank })
    }
  }

  const availableEquipment = [...equipmentById.values()]
    .map((entry) => ({
      ...entry,
      sources: dedupeSources(entry.sources),
    }))
    .sort((a, b) => {
      const rareOrder = Number(a.isRare) - Number(b.isRare)
      if (rareOrder !== 0) return rareOrder
      return String(a.templateId).localeCompare(String(b.templateId))
    })

  const availableFactors = [...factorsById.values()]
    .map((entry) => ({ ...entry, sources: dedupeSources(entry.sources) }))
    .sort((a, b) => a.factorId.localeCompare(b.factorId))

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    state,
    baseRank,
    unlockedAreaIds,
    farmableAreas,
    maxNormalDropRank,
    counts: {
      equipment: availableEquipment.length,
      rareEquipment: availableEquipment.filter((entry) => entry.isRare).length,
      factors: availableFactors.length,
    },
    availableEquipment,
    availableFactors,
  }
}

function dedupeSources(sources) {
  const seen = new Set()
  const result = []
  for (const source of sources) {
    const key = JSON.stringify(source)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(source)
  }
  return result
}

function printSummary(result) {
  console.log('# Progression Availability')
  console.log(`baseRank=${result.baseRank}, maxNormalDropRank=${result.maxNormalDropRank}`)
  console.log(`cleared=${result.state.clearedDungeons.join(',') || '(none)'}`)
  console.log(`unlocked=${result.unlockedAreaIds.join(',') || '(none)'}`)
  console.log(`farmable=${result.farmableAreas.map((area) => `${area.areaId}:T${area.maxTier}`).join(',') || '(none)'}`)
  console.log(`equipment=${result.counts.equipment}, rare=${result.counts.rareEquipment}, factors=${result.counts.factors}`)

  const rare = result.availableEquipment.filter((entry) => entry.isRare)
  if (rare.length > 0) {
    console.log('')
    console.log('# Rare Equipment')
    for (const entry of rare) {
      const sources = entry.sources
        .filter((source) => source.type === 'rareDrop' || source.type === 'tierRareDrop')
        .map((source) => `${source.areaId}:T${source.tier}:${source.enemyId}`)
        .join(', ')
      console.log(`${entry.templateId} (${entry.name}) <- ${sources}`)
    }
  }

  if (result.availableFactors.length > 0) {
    console.log('')
    console.log('# Factors')
    for (const entry of result.availableFactors) {
      const sources = entry.sources.map((source) => `${source.areaId}:T${source.tier}:${source.enemyId}`).join(', ')
      console.log(`${entry.factorId} <- ${sources}`)
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const result = analyzeAvailability(options)
  if (options.out) {
    const outputPath = writeJson(options.out, result)
    console.log(`結果を書き出しました: ${outputPath}`)
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printSummary(result)
  }
}

main()
