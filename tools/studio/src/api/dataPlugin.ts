import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import vm from 'node:vm'

interface Options {
  appSrc: string
  dataDir: string
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
  unlockCondition: { type: 'dungeon_cleared'; dungeonId: string } | null
  rewards: unknown[]
  chapters: Array<{ id: string; text: string }>
}

interface StoryFile {
  stories: StoryRecord[]
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

interface GoblinCombatStats {
  attackCount: number
  accuracy: number
  evasion: number
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
  additionalEffects: GoblinFactorEffect[]
  baseAttributes?: GoblinBaseAttributes
  hpCoefficient?: number
  combatStats?: GoblinCombatStats
  defaultSkillIds?: string[]
}

interface GoblinStudioData {
  races: GoblinRaceEntry[]
  jobs: GoblinJobSeed[]
  variants: GoblinVariantSeed[]
}

export function dataApiPlugin(options: Options): Plugin {
  const areaDir = path.join(options.appSrc, 'shared', 'data', 'expeditionArea')
  const enemyDir = path.join(options.appSrc, 'shared', 'data', 'enemy')
  const storyFile = path.join(options.appSrc, 'shared', 'data', 'story', 'stories.json')
  const racesFile = path.join(options.appSrc, 'shared', 'data', 'races.ts')
  const jobsFile = path.join(options.appSrc, 'shared', 'data', 'goblinJobs.ts')
  const variantsFile = path.join(options.appSrc, 'shared', 'data', 'goblinVariants.ts')
  const presetsFile = path.join(options.dataDir, 'party-presets.json')

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

      server.middlewares.use('/api/goblin-data', async (req, res) => {
        try {
          if (req.method === 'GET') {
            return json(
              res,
              200,
              await readGoblinStudioData({ racesFile, jobsFile, variantsFile }),
            )
          }
          if (req.method === 'PUT') {
            const body = await readBody(req)
            return json(
              res,
              200,
              await writeGoblinStudioData(
                { racesFile, jobsFile, variantsFile },
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
        ? `dungeon_cleared: ${story.unlockCondition.dungeonId}`
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

async function readJson(filePath: string): Promise<any> {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
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

function sortStories(stories: StoryRecord[]) {
  stories.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

async function readGoblinStudioData(paths: {
  racesFile: string
  jobsFile: string
  variantsFile: string
}): Promise<GoblinStudioData> {
  const [racesSource, jobsSource, variantsSource] = await Promise.all([
    fs.readFile(paths.racesFile, 'utf8'),
    fs.readFile(paths.jobsFile, 'utf8'),
    fs.readFile(paths.variantsFile, 'utf8'),
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
    jobs: Object.values(jobsObject),
    variants: Object.values(variantsObject),
  }
}

async function writeGoblinStudioData(
  paths: {
    racesFile: string
    jobsFile: string
    variantsFile: string
  },
  body: unknown,
) {
  if (!isGoblinStudioDataShape(body)) {
    throw new Error('Invalid goblin data payload')
  }

  const [racesSource, jobsSource, variantsSource] = await Promise.all([
    fs.readFile(paths.racesFile, 'utf8'),
    fs.readFile(paths.jobsFile, 'utf8'),
    fs.readFile(paths.variantsFile, 'utf8'),
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
  const jobsObject = Object.fromEntries(body.jobs.map((job) => [job.id, job]))
  const variantsObject = Object.fromEntries(
    body.variants.map((variant) => [variant.factorId, variant]),
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
  const nextVariants = replaceConstObjectLiteral(
    variantsSource,
    'goblinVariantDefinitions',
    formatJsValue(variantsObject, 0),
  )

  await Promise.all([
    fs.writeFile(paths.racesFile, nextRaces, 'utf8'),
    fs.writeFile(paths.jobsFile, nextJobs, 'utf8'),
    fs.writeFile(paths.variantsFile, nextVariants, 'utf8'),
  ])

  return { ok: true }
}

function extractConstObjectLiteral(source: string, constName: string): string {
  const marker = `const ${constName}`
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error(`Const not found: ${constName}`)
  }
  const eqIndex = source.indexOf('=', markerIndex)
  if (eqIndex < 0) {
    throw new Error(`Assignment not found: ${constName}`)
  }
  const start = source.indexOf('{', eqIndex)
  if (start < 0) {
    throw new Error(`Object literal not found: ${constName}`)
  }
  const end = findMatchingBrace(source, start)
  return source.slice(start, end + 1)
}

function replaceConstObjectLiteral(source: string, constName: string, nextObjectLiteral: string): string {
  const marker = `const ${constName}`
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error(`Const not found: ${constName}`)
  }
  const eqIndex = source.indexOf('=', markerIndex)
  if (eqIndex < 0) {
    throw new Error(`Assignment not found: ${constName}`)
  }
  const start = source.indexOf('{', eqIndex)
  if (start < 0) {
    throw new Error(`Object literal not found: ${constName}`)
  }
  const end = findMatchingBrace(source, start)
  return `${source.slice(0, start)}${nextObjectLiteral}${source.slice(end + 1)}`
}

function findMatchingBrace(source: string, start: number): number {
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
    if (ch === '{') {
      depth++
      continue
    }
    if (ch === '}') {
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
    Array.isArray(record.jobs) &&
    Array.isArray(record.variants)
  )
}
