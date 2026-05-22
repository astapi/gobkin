/**
 * SQLiteを使用したダンジョン進行状況リポジトリ実装
 * DBから直接読み書きする設計
 */
import type { DungeonProgressState } from '../../shared/types'
import { getDatabase } from '../database'

interface DungeonProgressRow {
  dungeon_id: string
  unlocked: number
  cleared: number
  unlock_notified: number
  max_cleared_tier: number
  cleared_floors_json: string | null
  updated_at: string
}

interface DungeonProgress {
  unlocked: boolean
  cleared: boolean
  unlockNotified: boolean
  maxClearedTier: number
  maxClearedFloorsByTier: Record<number, number>
}

export interface IDungeonProgressRepository {
  getAll(): Promise<DungeonProgressState>
  get(dungeonId: string): Promise<DungeonProgress | null>
  save(dungeonId: string, progress: DungeonProgress): Promise<void>
  unlock(dungeonId: string): Promise<void>
  markCleared(dungeonId: string, tier?: number): Promise<void>
}

const parseClearedFloors = (value: string | null | undefined): Record<number, number> => {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([tier, floor]) => [Number(tier), Number(floor)] as const)
        .filter(([tier, floor]) => Number.isInteger(tier) && Number.isFinite(floor) && floor > 0),
    )
  } catch {
    return {}
  }
}

const defaultProgress = (): DungeonProgress => ({
  unlocked: false,
  cleared: false,
  unlockNotified: false,
  maxClearedTier: 0,
  maxClearedFloorsByTier: {},
})

export class SQLiteDungeonProgressRepository implements IDungeonProgressRepository {
  private static instance: SQLiteDungeonProgressRepository | null = null

  static getInstance(): SQLiteDungeonProgressRepository {
    if (!SQLiteDungeonProgressRepository.instance) {
      SQLiteDungeonProgressRepository.instance = new SQLiteDungeonProgressRepository()
    }
    return SQLiteDungeonProgressRepository.instance
  }

  async getAll(): Promise<DungeonProgressState> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<DungeonProgressRow>('SELECT * FROM dungeon_progress')

    const result: DungeonProgressState = {}
    for (const row of rows) {
      result[row.dungeon_id] = {
        unlocked: row.unlocked === 1,
        cleared: row.cleared === 1,
        unlockNotified: row.unlock_notified === 1,
        maxClearedTier: row.max_cleared_tier ?? 0,
        maxClearedFloorsByTier: parseClearedFloors(row.cleared_floors_json),
      }
    }
    return result
  }

  async get(dungeonId: string): Promise<DungeonProgress | null> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<DungeonProgressRow>(
      'SELECT * FROM dungeon_progress WHERE dungeon_id = ?',
      [dungeonId]
    )

    if (!row) return null

    return {
      unlocked: row.unlocked === 1,
      cleared: row.cleared === 1,
      unlockNotified: row.unlock_notified === 1,
      maxClearedTier: row.max_cleared_tier ?? 0,
      maxClearedFloorsByTier: parseClearedFloors(row.cleared_floors_json),
    }
  }

  async save(dungeonId: string, progress: DungeonProgress): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO dungeon_progress
       (dungeon_id, unlocked, cleared, unlock_notified, max_cleared_tier, cleared_floors_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        dungeonId,
        progress.unlocked ? 1 : 0,
        progress.cleared ? 1 : 0,
        progress.unlockNotified ? 1 : 0,
        progress.maxClearedTier,
        JSON.stringify(progress.maxClearedFloorsByTier ?? {}),
      ]
    )
  }

  async unlock(dungeonId: string): Promise<void> {
    const current = await this.get(dungeonId) ?? defaultProgress()
    await this.save(dungeonId, { ...current, unlocked: true })
  }

  async markCleared(dungeonId: string, tier?: number): Promise<void> {
    const current = await this.get(dungeonId) ?? { ...defaultProgress(), unlocked: true }
    const clearedTierValue = tier !== undefined ? tier + 1 : 1
    const newMaxClearedTier = Math.max(current.maxClearedTier, clearedTierValue)
    await this.save(dungeonId, {
      ...current,
      unlocked: true,
      cleared: true,
      maxClearedTier: newMaxClearedTier,
    })
  }
}
