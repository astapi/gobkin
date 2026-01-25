/**
 * スキーママイグレーション (v2)
 * dungeon_progress に unlock_notified カラムを追加
 */
import type * as SQLite from 'expo-sqlite'

export const migrateV2 = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info('dungeon_progress')"
  )
  const hasUnlockNotified = columns.some(column => column.name === 'unlock_notified')
  if (hasUnlockNotified) return
  await db.execAsync(
    'ALTER TABLE dungeon_progress ADD COLUMN unlock_notified INTEGER NOT NULL DEFAULT 0'
  )
}
