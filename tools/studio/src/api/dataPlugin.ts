import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

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

export function dataApiPlugin(options: Options): Plugin {
  const areaDir = path.join(options.appSrc, 'shared', 'data', 'expeditionArea')
  const enemyDir = path.join(options.appSrc, 'shared', 'data', 'enemy')
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
