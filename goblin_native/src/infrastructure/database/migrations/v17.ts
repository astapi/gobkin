import type * as SQLite from 'expo-sqlite'

/** v17: PTごとの自動周回設定と日次使用時間を追加 */
export const migrateV17 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(parties)')

  if (!columns.some(column => column.name === 'auto_expedition_enabled')) {
    await database.execAsync(
      'ALTER TABLE parties ADD COLUMN auto_expedition_enabled INTEGER NOT NULL DEFAULT 0',
    )
  }
  if (!columns.some(column => column.name === 'auto_expedition_date')) {
    await database.execAsync('ALTER TABLE parties ADD COLUMN auto_expedition_date TEXT')
  }
  if (!columns.some(column => column.name === 'auto_expedition_used_sec')) {
    await database.execAsync(
      'ALTER TABLE parties ADD COLUMN auto_expedition_used_sec INTEGER NOT NULL DEFAULT 0',
    )
  }
}
