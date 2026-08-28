import type * as SQLite from 'expo-sqlite'
import { storiesData } from '../../../shared/data/story'

/**
 * v12: story_progress テーブルを追加
 * ストーリーの解放・読了状態を管理
 *
 * 既存ユーザー対応:
 * - プロローグは全ユーザーに unlocked: true で挿入
 * - クリア済みダンジョンに対応するストーリーを unlocked: true で挿入
 */
export const migrateV12 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS story_progress (
      story_id TEXT PRIMARY KEY,
      unlocked INTEGER NOT NULL DEFAULT 0,
      read INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // 既存ユーザー対応: クリア済みダンジョンに対応するストーリーを解放
  const clearedRows = await database.getAllAsync<{ dungeon_id: string }>(
    'SELECT dungeon_id FROM dungeon_progress WHERE cleared = 1'
  )
  const clearedIds = new Set(clearedRows.map(r => r.dungeon_id))

  for (const story of storiesData) {
    const shouldUnlock =
      story.unlockCondition === null ||
      (story.unlockCondition.type === 'dungeon_cleared' && clearedIds.has(story.unlockCondition.dungeonId))

    if (shouldUnlock) {
      await database.runAsync(
        `INSERT OR IGNORE INTO story_progress (story_id, unlocked, read, updated_at)
         VALUES (?, 1, 0, datetime('now'))`,
        [story.id]
      )
    }
  }
}
