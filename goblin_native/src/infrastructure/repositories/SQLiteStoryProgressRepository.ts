/**
 * SQLiteを使用したストーリー進行状況リポジトリ実装
 */
import type { StoryProgressState } from '../../shared/types/StoryProgress'
import { getDatabase } from '../database'

interface StoryProgressRow {
  story_id: string
  unlocked: number
  read: number
  updated_at: string
}

interface StoryProgress {
  unlocked: boolean
  read: boolean
}

export interface IStoryProgressRepository {
  getAll(): Promise<StoryProgressState>
  get(storyId: string): Promise<StoryProgress | null>
  save(storyId: string, progress: StoryProgress): Promise<void>
  unlock(storyId: string): Promise<void>
  markRead(storyId: string): Promise<void>
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
    const current = await this.get(storyId) ?? { unlocked: false, read: false }
    await this.save(storyId, { ...current, unlocked: true })
  }

  async markRead(storyId: string): Promise<void> {
    const current = await this.get(storyId) ?? { unlocked: true, read: false }
    await this.save(storyId, { ...current, unlocked: true, read: true })
  }
}
