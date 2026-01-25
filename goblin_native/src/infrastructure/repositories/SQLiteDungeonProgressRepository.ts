/**
 * SQLiteを使用したダンジョン進行状況リポジトリ実装
 * 内部キャッシュを使用して同期的なインターフェースを提供
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
  getAll(): DungeonProgressState
  get(dungeonId: string): DungeonProgress | null
  save(dungeonId: string, progress: DungeonProgress): void
  unlock(dungeonId: string): void
  markCleared(dungeonId: string): void
}

export class SQLiteDungeonProgressRepository implements IDungeonProgressRepository {
  private static instance: SQLiteDungeonProgressRepository | null = null
  private cache: Map<string, DungeonProgress> = new Map()
  private initialized = false

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): SQLiteDungeonProgressRepository {
    if (!SQLiteDungeonProgressRepository.instance) {
      SQLiteDungeonProgressRepository.instance = new SQLiteDungeonProgressRepository()
    }
    return SQLiteDungeonProgressRepository.instance
  }

  /**
   * リポジトリを初期化し、DBからデータをロード
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const db = await getDatabase()
    const rows = await db.getAllAsync<DungeonProgressRow>('SELECT * FROM dungeon_progress')

    this.cache.clear()
    for (const row of rows) {
      this.cache.set(row.dungeon_id, {
        unlocked: row.unlocked === 1,
        cleared: row.cleared === 1,
        unlockNotified: row.unlock_notified === 1,
      })
    }

    this.initialized = true
  }

  /**
   * 全ダンジョンの進行状況を取得
   */
  getAll(): DungeonProgressState {
    const result: DungeonProgressState = {}
    this.cache.forEach((progress, dungeonId) => {
      result[dungeonId] = progress
    })
    return result
  }

  /**
   * 指定ダンジョンの進行状況を取得
   */
  get(dungeonId: string): DungeonProgress | null {
    return this.cache.get(dungeonId) ?? null
  }

  /**
   * 進行状況を保存
   */
  save(dungeonId: string, progress: DungeonProgress): void {
    this.cache.set(dungeonId, progress)

    this.saveAsync(dungeonId, progress).catch(err => {
      console.error('[SQLiteDungeonProgressRepository] Failed to save:', err)
    })
  }

  /**
   * ダンジョンを解放済みにする
   */
  unlock(dungeonId: string): void {
    const current = this.cache.get(dungeonId) ?? { unlocked: false, cleared: false, unlockNotified: false }
    this.save(dungeonId, { ...current, unlocked: true })
  }

  /**
   * ダンジョンをクリア済みにする
   */
  markCleared(dungeonId: string): void {
    const current = this.cache.get(dungeonId) ?? { unlocked: true, cleared: false, unlockNotified: false }
    this.save(dungeonId, { ...current, unlocked: true, cleared: true })
  }

  // --- Private methods ---

  private async saveAsync(dungeonId: string, progress: DungeonProgress): Promise<void> {
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
}
