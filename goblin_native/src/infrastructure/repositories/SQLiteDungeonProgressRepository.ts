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
  updated_at: string
}

interface DungeonProgress {
  unlocked: boolean
  cleared: boolean
  unlockNotified: boolean
}

export interface IDungeonProgressRepository {
  getAll(): Promise<DungeonProgressState>
  get(dungeonId: string): Promise<DungeonProgress | null>
  save(dungeonId: string, progress: DungeonProgress): Promise<void>
  unlock(dungeonId: string): Promise<void>
  markCleared(dungeonId: string): Promise<void>
}

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
    }
  }

  async save(dungeonId: string, progress: DungeonProgress): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO dungeon_progress
       (dungeon_id, unlocked, cleared, unlock_notified, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [
        dungeonId,
        progress.unlocked ? 1 : 0,
        progress.cleared ? 1 : 0,
        progress.unlockNotified ? 1 : 0,
      ]
    )
  }

  async unlock(dungeonId: string): Promise<void> {
    const current = await this.get(dungeonId) ?? { unlocked: false, cleared: false, unlockNotified: false }
    await this.save(dungeonId, { ...current, unlocked: true })
  }

  async markCleared(dungeonId: string): Promise<void> {
    const current = await this.get(dungeonId) ?? { unlocked: true, cleared: false, unlockNotified: false }
    await this.save(dungeonId, { ...current, unlocked: true, cleared: true })
  }
}
