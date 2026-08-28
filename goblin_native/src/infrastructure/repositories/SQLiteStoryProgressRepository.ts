/**
 * SQLiteを使用したストーリー進行状況リポジトリ実装
 */
import type { StoryProgressState } from '../../shared/types/StoryProgress'
import type { IStoryProgressRepository, StoryProgress } from '../../core/repositories/IStoryProgressRepository'
import { getDatabase } from '../database'

// インターフェース／進行状況型は core/repositories へ移動。後方互換のため再エクスポート
export type { IStoryProgressRepository, StoryProgress }

interface StoryProgressRow {
  story_id: string
  unlocked: number
  read: number
  updated_at: string
}

export class SQLiteStoryProgressRepository implements IStoryProgressRepository {
  private static instance: SQLiteStoryProgressRepository | null = null

  static getInstance(): SQLiteStoryProgressRepository {
    if (!SQLiteStoryProgressRepository.instance) {
      SQLiteStoryProgressRepository.instance = new SQLiteStoryProgressRepository()
    }
    return SQLiteStoryProgressRepository.instance
  }

  async getAll(): Promise<StoryProgressState> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<StoryProgressRow>('SELECT * FROM story_progress')

    const result: StoryProgressState = {}
    for (const row of rows) {
      result[row.story_id] = {
        unlocked: row.unlocked === 1,
        read: row.read === 1,
      }
    }
    return result
  }

  async get(storyId: string): Promise<StoryProgress | null> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<StoryProgressRow>(
      'SELECT * FROM story_progress WHERE story_id = ?',
      [storyId]
    )

    if (!row) return null

    return {
      unlocked: row.unlocked === 1,
      read: row.read === 1,
    }
  }

  async save(storyId: string, progress: StoryProgress): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO story_progress
       (story_id, unlocked, read, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [
        storyId,
        progress.unlocked ? 1 : 0,
        progress.read ? 1 : 0,
      ]
    )
  }

  async unlock(storyId: string): Promise<void> {
    // get→save の lost update を避けるため単文の UPSERT で更新する
    const db = await getDatabase()
    await db.runAsync(
      `INSERT INTO story_progress (story_id, unlocked, read, updated_at)
       VALUES (?, 1, 0, datetime('now'))
       ON CONFLICT(story_id) DO UPDATE SET unlocked = 1, updated_at = datetime('now')`,
      [storyId]
    )
  }

  async markRead(storyId: string): Promise<void> {
    // get→save の lost update を避けるため単文の UPSERT で更新する
    const db = await getDatabase()
    await db.runAsync(
      `INSERT INTO story_progress (story_id, unlocked, read, updated_at)
       VALUES (?, 1, 1, datetime('now'))
       ON CONFLICT(story_id) DO UPDATE SET unlocked = 1, read = 1, updated_at = datetime('now')`,
      [storyId]
    )
  }
}
