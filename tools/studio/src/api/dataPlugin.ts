import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import vm from 'node:vm'

interface Options {
  appSrc: string
  dataDir: string
  scenariosDir: string
}

interface DungeonSummary {
  areaId: string
  name: string
  areaLevel: number
  floors: number
  baseDurationSec: number
  enemyCount: number
  patternCount: number
}

interface StoryRecord {
  id: string
  title: string
  category: 'main' | 'side'
  order: number
  unlockCondition:
    | { type: 'dungeon_cleared'; dungeonId: string }
    | { type: 'purchase'; entitlementId: string }
    | null
  rewards: unknown[]
  chapters: Array<{ id: string; text: string }>
}

interface StoryFile {
  stories: StoryRecord[]
}

interface TipRecord {
  id: string
  text: string
  enabled: boolean
}

interface TipsFile {
  tips: TipRecord[]
}

interface StorySummary {
  id: string
  title: string
  category: StoryRecord['category']
  order: number
  chapterCount: number
  rewardCount: number
  unlockLabel: string
}

interface GoblinRaceEntry {
  id: string
  label: string
  implies?: string[]
  skillIds?: string[]
  physicalResistancePercent?: number
  penetrationResistancePercent?: number
  criticalResistancePercent?: number
  magicResistancePercent?: number
}

interface GoblinJobSkillSeed {
  unlockLevel?: number
  skillId: string
}

interface GoblinBaseAttributes {
  power: number
  wisdom: number
  spirit: number
  vitality: number
  agility: number
  luck: number
}

interface GoblinFactorEffect {
  type: 'stat_bonus' | 'resistance' | 'skill_unlock'
  target:
    | 'hp'
    | 'atk'
    | 'magicAtk'
    | 'def'
    | 'magicDef'
    | 'attackCount'
    | 'accuracy'
    | 'evasion'
    | 'magicHeal'
  value: number
}

interface GoblinJobSeed {
  id: string
  accentColor: string
  skills: GoblinJobSkillSeed[]
  unlockRequiresClearedArea?: string
  unlockRequiresReadStory?: string
  baseAttributes?: GoblinBaseAttributes
}

interface GoblinVariantSeed {
  factorId: string
  factorName: string
  factorDescription: string
  inheritProbability: number
  factorEffects: GoblinFactorEffect[]
  variantProbability: number
  raceId: string
  raceName: string
  avatar: string
  imageKey: string
  baseAttributes?: GoblinBaseAttributes
  hpCoefficient?: number
  defaultSkillIds?: string[]
}

interface GoblinFactorSeed {
  id: string
  name: string
  description: string
  inheritProbability: number
  effects: GoblinFactorEffect[]
  source?: 'variant' | 'standalone'
}

interface BirthSkillLotteryEntry {
  skillId: string
  probability: number
}

interface FactorSkillInheritanceRule {
  factorId: string
  skills: BirthSkillLotteryEntry[]
}

interface PureGoblinSkillManifestationRule {
  baseRank: number
  skills: BirthSkillLotteryEntry[]
}

interface PureGoblinSeed {
  baseAttributes: GoblinBaseAttributes
  hpCoefficient: number
  defaultSkillIds: string[]
}

interface FounderGoblinSeedStats {
  hp: number
  atk: number
  def: number
  attackCount: number
  accuracy: number
  evasion: number
}

interface FounderGoblinSeed {
  id: number
  name: string
  race: string
  raceId: string
  level: number
  experience: number
  avatar: string
  stats: FounderGoblinSeedStats
  defaultSkillIds: string[]
}

interface GoblinStudioData {
  races: GoblinRaceEntry[]
  factors: GoblinFactorSeed[]
  jobs: GoblinJobSeed[]
  variants: GoblinVariantSeed[]
  factorSkillInheritanceRules: FactorSkillInheritanceRule[]
  pureGoblinSkillManifestationRules: PureGoblinSkillManifestationRule[]
  pureGoblin: PureGoblinSeed
  founder: FounderGoblinSeed
}

export function dataApiPlugin(options: Options): Plugin {
  const areaDir = path.join(options.appSrc, 'shared', 'data', 'expeditionArea')
  const enemyDir = path.join(options.appSrc, 'shared', 'data', 'enemy')
  const storyFile = path.join(options.appSrc, 'shared', 'data', 'story', 'stories.json')
  const tipsFile = path.join(options.appSrc, 'shared', 'data', 'tips.json')
  const racesFile = path.join(options.appSrc, 'shared', 'data', 'races.ts')
  const factorsFile = path.join(options.appSrc, 'shared', 'data', 'factors.ts')
  const jobsFile = path.join(options.appSrc, 'shared', 'data', 'goblinJobs.ts')
  const variantsFile = path.join(options.appSrc, 'shared', 'data', 'goblinVariants.ts')
  const skillBirthRulesFile = path.join(options.appSrc, 'shared', 'data', 'skillBirthRules.ts')
  const founderGoblinFile = path.join(options.appSrc, 'shared', 'data', 'founderGoblin.ts')
  const pureGoblinFile = path.join(options.appSrc, 'shared', 'data', 'pureGoblin.ts')
  const equipmentPoolFile = path.join(options.appSrc, 'shared', 'data', 'equipmentPool.json')
  const presetsFile = path.join(options.dataDir, 'party-presets.json')
  const libraryFile = path.join(options.dataDir, 'character-library.json')
  const scenariosDir = options.scenariosDir

  return {
    name: 'studio-data-api',
    configureServer(server) {
      server.middlewares.use('/api/dungeons', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const segments = url.pathname.split('/').filter(Boolean)

          if (segments.length === 0) {
            if (req.method === 'GET') {
              return json(res, 200, await listDungeons(areaDir, enemyDir))
            }
            return json(res, 405, { error: 'Method not allowed' })
          }

          const areaId = segments[0]
          if (!isSafeId(areaId)) {
            return json(res, 400, { error: 'Invalid areaId' })
          }

          if (req.method === 'GET') {
            return json(res, 200, await readDungeon(areaDir, enemyDir, areaId))
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            return json(res, 200, await writeDungeon(areaDir, enemyDir, areaId, body))
          }
          return json(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          const status = message.startsWith('NOT_FOUND') ? 404 : 500
          return json(res, status, { error: message })
        }
      })

      server.middlewares.use('/api/dungeon-unlocks', async (_req, res) => {
        try {
          return json(res, 200, await readDungeonUnlocks(areaDir))
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return json(res, 500, { error: message })
        }
      })

      server.middlewares.use('/api/character-library', async (req, res) => {
        try {
          if (req.method === 'GET') {
            return json(res, 200, await readLibrary(libraryFile))
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            await writeLibrary(libraryFile, body)
            return json(res, 200, { ok: true })
          }
          if (req.method === 'DELETE') {
            await deleteLibrary(libraryFile)
            return json(res, 200, { ok: true })
          }
          return json(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return json(res, 500, { error: message })
        }
      })

      server.middlewares.use('/api/party-presets', async (req, res) => {
        try {
          if (req.method === 'GET') {
            return json(res, 200, await readPresets(presetsFile))
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            await writePresets(presetsFile, body)
            return json(res, 200, { ok: true })
          }
          return json(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return json(res, 500, { error: message })
        }
      })

      server.middlewares.use('/api/stories', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const segments = url.pathname.split('/').filter(Boolean)

          if (segments.length === 0) {
            if (req.method === 'GET') {
              return json(res, 200, await listStories(storyFile))
            }
            if (req.method === 'POST') {
              const body = await readBody(req)
              return json(res, 200, await createStory(storyFile, body))
            }
            return json(res, 405, { error: 'Method not allowed' })
          }

          const storyId = segments[0]
          if (!isSafeId(storyId)) {
            return json(res, 400, { error: 'Invalid storyId' })
          }

          if (req.method === 'GET') {
            return json(res, 200, await readStory(storyFile, storyId))
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            return json(res, 200, await updateStory(storyFile, storyId, body))
          }
          if (req.method === 'DELETE') {
            return json(res, 200, await deleteStory(storyFile, storyId))
          }
          return json(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          const status = message.startsWith('NOT_FOUND') ? 404 : 500
          return json(res, status, { error: message })
        }
      })

      server.middlewares.use('/api/equipment-pool', async (req, res) => {
        try {
          if (req.method === 'GET') {
            return json(res, 200, await readJson(equipmentPoolFile))
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            await writeEquipmentPool(equipmentPoolFile, body)
            return json(res, 200, { ok: true })
          }
          return json(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return json(res, 500, { error: message })
        }
      })

      server.middlewares.use('/api/tips', async (req, res) => {
        try {
          if (req.method === 'GET') {
            return json(res, 200, await readTipsFile(tipsFile))
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            await writeTipsFile(tipsFile, body)
            return json(res, 200, { ok: true })
          }
          return json(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return json(res, 500, { error: message })
        }
      })

      server.middlewares.use('/api/balance-scenarios', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const segments = url.pathname.split('/').filter(Boolean)

          if (segments.length === 0) {
            if (req.method === 'GET') {
              return json(res, 200, await listBalanceScenarios(scenariosDir))
            }
            return json(res, 405, { error: 'Method not allowed' })
          }

          const scenarioId = segments[0]
          if (!isSafeId(scenarioId)) {
            return json(res, 400, { error: 'Invalid scenarioId' })
          }

          if (req.method === 'GET') {
            return json(res, 200, await readBalanceScenario(scenariosDir, scenarioId))
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            await writeBalanceScenario(scenariosDir, scenarioId, body)
            return json(res, 200, { ok: true })
          }
          return json(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          const status = message.startsWith('NOT_FOUND') ? 404 : 500
          return json(res, status, { error: message })
        }
      })

      server.middlewares.use('/api/goblin-data', async (req, res) => {
        try {
          if (req.method === 'GET') {
            return json(
              res,
              200,
              await readGoblinStudioData({
                racesFile,
                factorsFile,
                jobsFile,
                variantsFile,
                skillBirthRulesFile,
                founderGoblinFile,
                pureGoblinFile,
              }),
            )
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            return json(
              res,
              200,
              await writeGoblinStudioData(
                {
                  racesFile,
                  factorsFile,
                  jobsFile,
                  variantsFile,
                  skillBirthRulesFile,
                  founderGoblinFile,
                  pureGoblinFile,
                },
                body,
              ),
            )
          }
          return json(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return json(res, 500, { error: message })
        }
      })
    },
  }
}

async function readLibrary(filePath: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { goblins: [], equipment: [], parties: [], meta: null }
    }
    throw err
  }
}

async function writeLibrary(filePath: string, body: unknown): Promise<void> {
  if (!body || typeof body !== 'object') {
    throw new Error('Body must be an object')
  }
  const record = body as Record<string, unknown>
  if (
    !Array.isArray(record.goblins) ||
    !Array.isArray(record.equipment) ||
    !Array.isArray(record.parties)
  ) {
    throw new Error('Library must contain goblins, equipment, parties arrays')
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const formatted = `${JSON.stringify(body, null, 2)}\n`
  await fs.writeFile(filePath, formatted, 'utf8')
}

async function deleteLibrary(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
    throw err
  }
}

async function readPresets(filePath: string): Promise<unknown[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray((parsed as { presets?: unknown[] }).presets)) {
      return (parsed as { presets: unknown[] }).presets
    }
    return []
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function writePresets(filePath: string, body: unknown): Promise<void> {
  if (!Array.isArray(body)) {
    throw new Error('Body must be an array of presets')
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const formatted = `${JSON.stringify(body, null, 2)}\n`
  await fs.writeFile(filePath, formatted, 'utf8')
}

async function listDungeons(areaDir: string, enemyDir: string): Promise<DungeonSummary[]> {
  const files = (await fs.readdir(areaDir)).filter((f) => f.endsWith('.json'))
  const summaries = await Promise.all(
    files.map(async (file) => {
      const areaId = file.replace(/\.json$/, '')
      const area = await readJson(path.join(areaDir, file))
      if (!isAreaConfigShape(area)) return null
      const enemyPath = path.join(enemyDir, file)
      let enemyCount = 0
      let patternCount = 0
      try {
        const enemy = await readJson(enemyPath)
        enemyCount = Array.isArray(enemy.enemies) ? enemy.enemies.length : 0
        patternCount = Array.isArray(enemy.patterns) ? enemy.patterns.length : 0
      } catch {
        // 敵DBが無いエリアは無視
      }
      return {
        areaId,
        name: String(area.name ?? areaId),
        areaLevel: Number(area.areaLevel ?? 0),
        floors: Number(area.floors ?? 0),
        baseDurationSec: Number(area.baseDurationSec ?? 0),
        enemyCount,
        patternCount,
      } satisfies DungeonSummary
    }),
  )
  const filtered = summaries.filter((s): s is DungeonSummary => s !== null)
  filtered.sort((a, b) => a.areaLevel - b.areaLevel || a.areaId.localeCompare(b.areaId))
  return filtered
}

async function listStories(storyFile: string): Promise<StorySummary[]> {
  const data = await readStoryFile(storyFile)
  return data.stories
    .map((story) => ({
      id: story.id,
      title: story.title,
      category: story.category,
      order: story.order,
      chapterCount: Array.isArray(story.chapters) ? story.chapters.length : 0,
      rewardCount: Array.isArray(story.rewards) ? story.rewards.length : 0,
      unlockLabel: story.unlockCondition
        ? story.unlockCondition.type === 'dungeon_cleared'
          ? `dungeon_cleared: ${story.unlockCondition.dungeonId}`
          : `purchase: ${story.unlockCondition.entitlementId}`
        : '常時解放',
    }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

async function readDungeonUnlocks(areaDir: string) {
  const allAreaPath = path.join(areaDir, 'allArea.json')
  const raw = await readJson(allAreaPath)
  const areas = Array.isArray((raw as { areas?: unknown[] }).areas)
    ? (raw as { areas: Array<Record<string, unknown>> }).areas
    : []

  return areas
    .filter((area) => typeof area.id === 'string')
    .map((area) => ({
      areaId: String(area.id),
      name: String(area.name ?? area.id),
      areaLevel: Number(area.areaLevel ?? 0),
      unlockRequires:
        typeof area.unlockRequires === 'string' ? area.unlockRequires : undefined,
      unlockNext: typeof area.unlockNext === 'string' ? area.unlockNext : undefined,
      unlockNexts: Array.isArray(area.unlockNexts)
        ? area.unlockNexts.filter((entry): entry is string => typeof entry === 'string')
        : [],
      unlocked: area.unlocked === true,
      isBaseCapture: area.isBaseCapture === true,
    }))
    .sort((a, b) => a.areaLevel - b.areaLevel || a.areaId.localeCompare(b.areaId))
}

function isAreaConfigShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.encounter === 'object'
}

async function readDungeon(areaDir: string, enemyDir: string, areaId: string) {
  const areaPath = path.join(areaDir, `${areaId}.json`)
  const enemyPath = path.join(enemyDir, `${areaId}.json`)
  const [area, enemy] = await Promise.all([
    readJson(areaPath).catch(() => {
      throw new Error(`NOT_FOUND: area ${areaId}`)
    }),
    readJson(enemyPath).catch(() => null),
  ])
  return { areaId, area, enemy }
}

async function readStory(storyFile: string, storyId: string) {
  const data = await readStoryFile(storyFile)
  const story = data.stories.find((entry) => entry.id === storyId)
  if (!story) {
    throw new Error(`NOT_FOUND: story ${storyId}`)
  }
  return story
}

async function writeDungeon(
  areaDir: string,
  enemyDir: string,
  areaId: string,
  body: unknown,
) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid body')
  }
  const { area, enemy } = body as { area?: unknown; enemy?: unknown }
  const writes: Promise<void>[] = []
  if (area !== undefined) {
    writes.push(writeJson(path.join(areaDir, `${areaId}.json`), area))
  }
  if (enemy !== undefined && enemy !== null) {
    writes.push(writeJson(path.join(enemyDir, `${areaId}.json`), enemy))
  }
  await Promise.all(writes)
  return { ok: true }
}

async function createStory(storyFile: string, body: unknown) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid body')
  }
  const { story } = body as { story?: unknown }
  if (!isStoryShape(story)) {
    throw new Error('Invalid story payload')
  }
  const data = await readStoryFile(storyFile)
  if (data.stories.some((entry) => entry.id === story.id)) {
    throw new Error(`Story already exists: ${story.id}`)
  }
  data.stories.push(story)
  sortStories(data.stories)
  await writeJson(storyFile, data)
  return { ok: true, id: story.id }
}

async function updateStory(storyFile: string, storyId: string, body: unknown) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid body')
  }
  const { story } = body as { story?: unknown }
  if (!isStoryShape(story)) {
    throw new Error('Invalid story payload')
  }
  const data = await readStoryFile(storyFile)
  const index = data.stories.findIndex((entry) => entry.id === storyId)
  if (index < 0) {
    throw new Error(`NOT_FOUND: story ${storyId}`)
  }
  const duplicate = data.stories.findIndex(
    (entry, entryIndex) => entry.id === story.id && entryIndex !== index,
  )
  if (duplicate >= 0) {
    throw new Error(`Story already exists: ${story.id}`)
  }
  data.stories[index] = story
  sortStories(data.stories)
  await writeJson(storyFile, data)
  return { ok: true, id: story.id }
}

async function deleteStory(storyFile: string, storyId: string) {
  const data = await readStoryFile(storyFile)
  const nextStories = data.stories.filter((entry) => entry.id !== storyId)
  if (nextStories.length === data.stories.length) {
    throw new Error(`NOT_FOUND: story ${storyId}`)
  }
  await writeJson(storyFile, { stories: nextStories })
  return { ok: true }
}

async function writeEquipmentPool(filePath: string, body: unknown): Promise<void> {
  if (!body || typeof body !== 'object') {
    throw new Error('Body must be an object')
  }
  const record = body as Record<string, unknown>
  if (typeof record.version !== 'string' || !Array.isArray(record.templates)) {
    throw new Error('equipment pool must contain version (string) and templates (array)')
  }
  const ids = new Set<string>()
  for (const entry of record.templates as unknown[]) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Each template entry must be an object')
    }
    const e = entry as Record<string, unknown>
    if (typeof e._comment === 'string') continue
    if (typeof e.id !== 'string' || e.id === '') {
      throw new Error('Template entry missing id')
    }
    if (ids.has(e.id)) {
      throw new Error(`Duplicate template id: ${e.id}`)
    }
    ids.add(e.id)
    if (typeof e.name !== 'string' || typeof e.category !== 'string') {
      throw new Error(`Template ${e.id} missing required fields (name/category)`)
    }
    if (!Array.isArray(e.statBonuses)) {
      throw new Error(`Template ${e.id} statBonuses must be an array`)
    }
    if (typeof e.price !== 'number') {
      throw new Error(`Template ${e.id} price must be a number`)
    }
  }
  await writeJson(filePath, body)
}

async function readTipsFile(filePath: string): Promise<TipsFile> {
  const raw = await readJson(filePath)
  if (!isTipsFileShape(raw)) {
    throw new Error('Invalid tips file')
  }
  return raw
}

async function writeTipsFile(filePath: string, body: unknown): Promise<void> {
  if (!isTipsFileShape(body)) {
    throw new Error('Tips file must contain tips array with id/text/enabled')
  }
  const ids = new Set<string>()
  for (const tip of body.tips) {
    if (tip.id.trim() === '') {
      throw new Error('Tip id must not be empty')
    }
    if (tip.text.trim() === '') {
      throw new Error(`Tip ${tip.id} text must not be empty`)
    }
    if (ids.has(tip.id)) {
      throw new Error(`Duplicate tip id: ${tip.id}`)
    }
    ids.add(tip.id)
  }
  await writeJson(filePath, body)
}

async function readJson(filePath: string): Promise<any> {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

interface BalanceScenarioSummary {
  scenarioId: string
  areaId: string
  description?: string
  iterations?: number
  levelRange?: { min: number; max: number; step?: number }
  loadoutCount: number
}

async function listBalanceScenarios(scenariosDir: string): Promise<BalanceScenarioSummary[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(scenariosDir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const summaries: BalanceScenarioSummary[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    const scenarioId = entry.slice(0, -'.json'.length)
    try {
      const raw = await readJson(path.join(scenariosDir, entry))
      summaries.push({
        scenarioId,
        areaId: typeof raw?.areaId === 'string' ? raw.areaId : scenarioId,
        description: typeof raw?.description === 'string' ? raw.description : undefined,
        iterations: typeof raw?.iterations === 'number' ? raw.iterations : undefined,
        levelRange:
          raw?.levelRange && typeof raw.levelRange === 'object'
            ? raw.levelRange
            : undefined,
        loadoutCount: Array.isArray(raw?.loadouts) ? raw.loadouts.length : 0,
      })
    } catch {
      // skip broken files silently
    }
  }
  summaries.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId))
  return summaries
}

async function readBalanceScenario(scenariosDir: string, scenarioId: string): Promise<unknown> {
  const filePath = path.join(scenariosDir, `${scenarioId}.json`)
  try {
    return await readJson(filePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`NOT_FOUND: scenario ${scenarioId}`)
    }
    throw err
  }
}

async function writeBalanceScenario(
  scenariosDir: string,
  scenarioId: string,
  body: unknown,
): Promise<void> {
  if (!body || typeof body !== 'object') {
    throw new Error('Body must be an object')
  }
  const record = body as Record<string, unknown>
  if (typeof record.areaId !== 'string') {
    throw new Error('Scenario must have areaId (string)')
  }
  if (!Array.isArray(record.loadouts)) {
    throw new Error('Scenario must have loadouts (array)')
  }
  await fs.mkdir(scenariosDir, { recursive: true })
  await writeJson(path.join(scenariosDir, `${scenarioId}.json`), body)
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  const formatted = `${JSON.stringify(value, null, 2)}\n`
  await fs.writeFile(filePath, formatted, 'utf8')
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.length === 0 ? undefined : JSON.parse(raw)
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function isSafeId(id: string): boolean {
  return /^[a-z0-9_]+$/.test(id)
}

async function readStoryFile(filePath: string): Promise<StoryFile> {
  const raw = await readJson(filePath)
  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray((raw as { stories?: unknown[] }).stories)
  ) {
    throw new Error('Invalid story file')
  }
  return raw as StoryFile
}

function isStoryShape(value: unknown): value is StoryRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    (record.category === 'main' || record.category === 'side') &&
    typeof record.order === 'number' &&
    Array.isArray(record.rewards) &&
    Array.isArray(record.chapters)
  )
}

function isTipsFileShape(value: unknown): value is TipsFile {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.tips) &&
    record.tips.every((tip) => {
      if (!tip || typeof tip !== 'object') return false
      const tipRecord = tip as Record<string, unknown>
      return (
        typeof tipRecord.id === 'string' &&
        typeof tipRecord.text === 'string' &&
        typeof tipRecord.enabled === 'boolean'
      )
    })
  )
}

function sortStories(stories: StoryRecord[]) {
  stories.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

async function readGoblinStudioData(paths: {
  racesFile: string
  factorsFile: string
  jobsFile: string
  variantsFile: string
  skillBirthRulesFile: string
  founderGoblinFile: string
  pureGoblinFile: string
}): Promise<GoblinStudioData> {
  const [
    racesSource,
    factorsSource,
    jobsSource,
    variantsSource,
    skillBirthRulesSource,
    founderGoblinSource,
    pureGoblinSource,
  ] = await Promise.all([
    fs.readFile(paths.racesFile, 'utf8'),
    fs.readFile(paths.factorsFile, 'utf8'),
    fs.readFile(paths.jobsFile, 'utf8'),
    fs.readFile(paths.variantsFile, 'utf8'),
    fs.readFile(paths.skillBirthRulesFile, 'utf8'),
    fs.readFile(paths.founderGoblinFile, 'utf8'),
    fs.readFile(paths.pureGoblinFile, 'utf8'),
  ])

  const racesObject = evaluateObjectLiteral<
    Record<
      string,
      {
        label: string
        implies?: string[]
        skillIds?: string[]
        physicalResistancePercent?: number
        penetrationResistancePercent?: number
        criticalResistancePercent?: number
        magicResistancePercent?: number
      }
    >
  >(
    extractConstObjectLiteral(racesSource, 'races'),
  )
  const jobsObject = evaluateObjectLiteral<Record<string, GoblinJobSeed>>(
    extractConstObjectLiteral(jobsSource, 'GOBLIN_JOB_DEFINITION_SEEDS'),
  )
  const variantsObject = evaluateObjectLiteral<Record<string, GoblinVariantSeed>>(
    extractConstObjectLiteral(variantsSource, 'goblinVariantDefinitions'),
  )
  const standaloneFactorsObject = evaluateObjectLiteral<Record<string, GoblinFactorSeed>>(
    extractConstObjectLiteral(factorsSource, 'standaloneFactorDatabase'),
  )
  const factorSkillInheritanceRulesObject = evaluateObjectLiteral<Record<string, FactorSkillInheritanceRule>>(
    extractConstObjectLiteral(skillBirthRulesSource, 'factorSkillInheritanceRules'),
  )
  const pureGoblinSkillManifestationRules = evaluateObjectLiteral<PureGoblinSkillManifestationRule[]>(
    extractConstArrayLiteral(skillBirthRulesSource, 'pureGoblinSkillManifestationRules'),
  )
  const founder = evaluateObjectLiteral<FounderGoblinSeed>(
    extractConstObjectLiteral(founderGoblinSource, 'founderGoblinSeed'),
  )
  const pureGoblin = evaluateObjectLiteral<PureGoblinSeed>(
    extractConstObjectLiteral(pureGoblinSource, 'pureGoblinSeed'),
  )
  const variantFactors: GoblinFactorSeed[] = Object.values(variantsObject).map((variant) => ({
    id: variant.factorId,
    name: variant.factorName,
    description: variant.factorDescription,
    inheritProbability: variant.inheritProbability,
    effects: variant.factorEffects,
    source: 'variant',
  }))
  const standaloneFactors: GoblinFactorSeed[] = Object.values(standaloneFactorsObject).map((factor) => ({
    id: factor.id,
    name: factor.name,
    description: factor.description,
    inheritProbability: factor.inheritProbability,
    effects: factor.effects,
    source: 'standalone',
  }))

  return {
    races: Object.entries(racesObject).map(([id, value]) => ({
      id,
      label: value.label,
      implies: Array.isArray(value.implies) ? value.implies : undefined,
      skillIds: Array.isArray(value.skillIds) ? value.skillIds : undefined,
      physicalResistancePercent: value.physicalResistancePercent,
      penetrationResistancePercent: value.penetrationResistancePercent,
      criticalResistancePercent: value.criticalResistancePercent,
      magicResistancePercent: value.magicResistancePercent,
    })),
    factors: [...variantFactors, ...standaloneFactors],
    jobs: Object.values(jobsObject),
    variants: Object.values(variantsObject),
    factorSkillInheritanceRules: Object.values(factorSkillInheritanceRulesObject),
    pureGoblinSkillManifestationRules,
    pureGoblin,
    founder,
  }
}

async function writeGoblinStudioData(
  paths: {
    racesFile: string
    factorsFile: string
    jobsFile: string
    variantsFile: string
    skillBirthRulesFile: string
    founderGoblinFile: string
    pureGoblinFile: string
  },
  body: unknown,
) {
  if (!isGoblinStudioDataShape(body)) {
    throw new Error('Invalid goblin data payload')
  }

  const [
    racesSource,
    factorsSource,
    jobsSource,
    variantsSource,
    skillBirthRulesSource,
    founderGoblinSource,
    pureGoblinSource,
  ] = await Promise.all([
    fs.readFile(paths.racesFile, 'utf8'),
    fs.readFile(paths.factorsFile, 'utf8'),
    fs.readFile(paths.jobsFile, 'utf8'),
    fs.readFile(paths.variantsFile, 'utf8'),
    fs.readFile(paths.skillBirthRulesFile, 'utf8'),
    fs.readFile(paths.founderGoblinFile, 'utf8'),
    fs.readFile(paths.pureGoblinFile, 'utf8'),
  ])

  const racesObject = Object.fromEntries(
    body.races.map((race) => [
      race.id,
      {
        label: race.label,
        ...(race.implies && race.implies.length > 0 ? { implies: race.implies } : {}),
        ...(race.skillIds && race.skillIds.length > 0 ? { skillIds: race.skillIds } : {}),
        ...(race.physicalResistancePercent !== undefined ? { physicalResistancePercent: race.physicalResistancePercent } : {}),
        ...(race.penetrationResistancePercent !== undefined ? { penetrationResistancePercent: race.penetrationResistancePercent } : {}),
        ...(race.criticalResistancePercent !== undefined ? { criticalResistancePercent: race.criticalResistancePercent } : {}),
        ...(race.magicResistancePercent !== undefined ? { magicResistancePercent: race.magicResistancePercent } : {}),
      },
    ]),
  )
  const factorsById = new Map(body.factors.map((factor) => [factor.id, factor]))
  const jobsObject = Object.fromEntries(body.jobs.map((job) => [job.id, job]))
  const variantsObject = Object.fromEntries(
    body.variants.map((variant) => {
      const factor = factorsById.get(variant.factorId)
      return [
        variant.factorId,
        factor
          ? {
              ...variant,
              factorName: factor.name,
              factorDescription: factor.description,
              inheritProbability: factor.inheritProbability,
              factorEffects: factor.effects,
            }
          : variant,
      ]
    }),
  )
  const variantFactorIds = new Set(body.variants.map((variant) => variant.factorId))
  const standaloneFactorsObject = Object.fromEntries(
    body.factors
      .filter((factor) => !variantFactorIds.has(factor.id))
      .map((factor) => [
        factor.id,
        {
          id: factor.id,
          name: factor.name,
          description: factor.description,
          inheritProbability: factor.inheritProbability,
          effects: factor.effects,
        },
      ]),
  )
  const factorSkillInheritanceRulesObject = Object.fromEntries(
    body.factorSkillInheritanceRules.map((rule) => [rule.factorId, rule]),
  )

  const nextRaces = replaceConstObjectLiteral(
    racesSource,
    'races',
    formatJsValue(racesObject, 0),
  )
  const nextJobs = replaceConstObjectLiteral(
    jobsSource,
    'GOBLIN_JOB_DEFINITION_SEEDS',
    formatJsValue(jobsObject, 0),
  )
  const nextFactors = replaceConstObjectLiteral(
    factorsSource,
    'standaloneFactorDatabase',
    formatJsValue(standaloneFactorsObject, 0),
  )
  const nextVariants = replaceConstObjectLiteral(
    variantsSource,
    'goblinVariantDefinitions',
    formatJsValue(variantsObject, 0),
  )
  const nextSkillBirthRules = replaceConstArrayLiteral(
    replaceConstObjectLiteral(
      skillBirthRulesSource,
      'factorSkillInheritanceRules',
      formatJsValue(factorSkillInheritanceRulesObject, 0),
    ),
    'pureGoblinSkillManifestationRules',
    formatJsValue(body.pureGoblinSkillManifestationRules, 0),
  )
  const nextFounderGoblin = replaceConstObjectLiteral(
    founderGoblinSource,
    'founderGoblinSeed',
    formatJsValue(body.founder, 0),
  )
  const nextPureGoblin = replaceConstObjectLiteral(
    pureGoblinSource,
    'pureGoblinSeed',
    formatJsValue(body.pureGoblin, 0),
  )

  await Promise.all([
    fs.writeFile(paths.racesFile, nextRaces, 'utf8'),
    fs.writeFile(paths.factorsFile, nextFactors, 'utf8'),
    fs.writeFile(paths.jobsFile, nextJobs, 'utf8'),
    fs.writeFile(paths.variantsFile, nextVariants, 'utf8'),
    fs.writeFile(paths.skillBirthRulesFile, nextSkillBirthRules, 'utf8'),
    fs.writeFile(paths.founderGoblinFile, nextFounderGoblin, 'utf8'),
    fs.writeFile(paths.pureGoblinFile, nextPureGoblin, 'utf8'),
  ])

  return { ok: true }
}

function extractConstObjectLiteral(source: string, constName: string): string {
  return extractConstLiteral(source, constName, '{', '}')
}

function extractConstArrayLiteral(source: string, constName: string): string {
  return extractConstLiteral(source, constName, '[', ']')
}

function extractConstLiteral(source: string, constName: string, open: '{' | '[', close: '}' | ']'): string {
  const marker = `const ${constName}`
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error(`Const not found: ${constName}`)
  }
  const eqIndex = source.indexOf('=', markerIndex)
  if (eqIndex < 0) {
    throw new Error(`Assignment not found: ${constName}`)
  }
  const start = source.indexOf(open, eqIndex)
  if (start < 0) {
    throw new Error(`Literal not found: ${constName}`)
  }
  const end = findMatchingDelimiter(source, start, open, close)
  return source.slice(start, end + 1)
}

function replaceConstObjectLiteral(source: string, constName: string, nextObjectLiteral: string): string {
  return replaceConstLiteral(source, constName, nextObjectLiteral, '{', '}')
}

function replaceConstArrayLiteral(source: string, constName: string, nextArrayLiteral: string): string {
  return replaceConstLiteral(source, constName, nextArrayLiteral, '[', ']')
}

function replaceConstLiteral(
  source: string,
  constName: string,
  nextLiteral: string,
  open: '{' | '[',
  close: '}' | ']',
): string {
  const marker = `const ${constName}`
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error(`Const not found: ${constName}`)
  }
  const eqIndex = source.indexOf('=', markerIndex)
  if (eqIndex < 0) {
    throw new Error(`Assignment not found: ${constName}`)
  }
  const start = source.indexOf(open, eqIndex)
  if (start < 0) {
    throw new Error(`Literal not found: ${constName}`)
  }
  const end = findMatchingDelimiter(source, start, open, close)
  return `${source.slice(0, start)}${nextLiteral}${source.slice(end + 1)}`
}

function findMatchingDelimiter(
  source: string,
  start: number,
  open: '{' | '[' = '{',
  close: '}' | ']' = '}',
): number {
  let depth = 0
  let quote: '"' | "'" | '`' | null = null
  let escape = false
  let lineComment = false
  let blockComment = false

  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    const next = source[i + 1]

    if (lineComment) {
      if (ch === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === quote) {
        quote = null
      }
      continue
    }
    if (ch === '/' && next === '/') {
      lineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      blockComment = true
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === open) {
      depth++
      continue
    }
    if (ch === close) {
      depth--
      if (depth === 0) return i
    }
  }

  throw new Error('Matching brace not found')
}

function evaluateObjectLiteral<T>(literal: string): T {
  return vm.runInNewContext(`(${literal})`) as T
}

function formatJsValue(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  const childPad = '  '.repeat(indent + 1)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[\n${value
      .map((item) => `${childPad}${formatJsValue(item, indent + 1)}`)
      .join(',\n')}\n${pad}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    return `{\n${entries
      .map(([key, entryValue]) => `${childPad}${formatKey(key)}: ${formatJsValue(entryValue, indent + 1)}`)
      .join(',\n')}\n${pad}}`
  }

  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  throw new Error(`Unsupported value type: ${typeof value}`)
}

function formatKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

function isGoblinStudioDataShape(value: unknown): value is GoblinStudioData {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.races) &&
    Array.isArray(record.factors) &&
    Array.isArray(record.jobs) &&
    Array.isArray(record.variants) &&
    Array.isArray(record.factorSkillInheritanceRules) &&
    Array.isArray(record.pureGoblinSkillManifestationRules) &&
    isFounderGoblinSeedShape(record.founder) &&
    isPureGoblinSeedShape(record.pureGoblin)
  )
}

function isPureGoblinSeedShape(value: unknown): value is PureGoblinSeed {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.hpCoefficient !== 'number') return false
  if (
    !Array.isArray(record.defaultSkillIds) ||
    !record.defaultSkillIds.every((id) => typeof id === 'string')
  ) {
    return false
  }
  const attrs = record.baseAttributes as Record<string, unknown> | undefined
  if (!attrs || typeof attrs !== 'object') return false
  return (
    typeof attrs.power === 'number' &&
    typeof attrs.wisdom === 'number' &&
    typeof attrs.spirit === 'number' &&
    typeof attrs.vitality === 'number' &&
    typeof attrs.agility === 'number' &&
    typeof attrs.luck === 'number'
  )
}

function isFounderGoblinSeedShape(value: unknown): value is FounderGoblinSeed {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'number' ||
    typeof record.name !== 'string' ||
    typeof record.race !== 'string' ||
    typeof record.raceId !== 'string' ||
    typeof record.level !== 'number' ||
    typeof record.experience !== 'number' ||
    typeof record.avatar !== 'string'
  ) {
    return false
  }
  const stats = record.stats as Record<string, unknown> | undefined
  if (!stats || typeof stats !== 'object') return false
  if (
    !(
      typeof stats.hp === 'number' &&
      typeof stats.atk === 'number' &&
      typeof stats.def === 'number' &&
      typeof stats.attackCount === 'number' &&
      typeof stats.accuracy === 'number' &&
      typeof stats.evasion === 'number'
    )
  ) {
    return false
  }
  return (
    Array.isArray(record.defaultSkillIds) &&
    record.defaultSkillIds.every((id) => typeof id === 'string')
  )
}
