import type * as SQLite from 'expo-sqlite'

export const migrateV8 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  // dungeon_progress に max_cleared_tier カラムを追加
  const dpColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(dungeon_progress)')
  if (!dpColumns.some(c => c.name === 'max_cleared_tier')) {
    await database.execAsync('ALTER TABLE dungeon_progress ADD COLUMN max_cleared_tier INTEGER NOT NULL DEFAULT 0')
    // 既存の cleared=1 レコードを max_cleared_tier=1 に変換
    await database.runAsync('UPDATE dungeon_progress SET max_cleared_tier = 1 WHERE cleared = 1')
  }

  // parties に dungeon_tier カラムを追加
  const partyColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(parties)')
  if (!partyColumns.some(c => c.name === 'dungeon_tier')) {
    await database.execAsync('ALTER TABLE parties ADD COLUMN dungeon_tier INTEGER NOT NULL DEFAULT 0')
  }
}
