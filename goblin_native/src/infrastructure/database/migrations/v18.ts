import type * as SQLite from 'expo-sqlite'

/** v18: 自動周回結果をセッション単位で集計するIDを追加 */
export const migrateV18 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(parties)')
  if (!columns.some(column => column.name === 'auto_expedition_session_id')) {
    await database.execAsync('ALTER TABLE parties ADD COLUMN auto_expedition_session_id TEXT')
  }
  if (!columns.some(column => column.name === 'auto_expedition_summary_json')) {
    await database.execAsync('ALTER TABLE parties ADD COLUMN auto_expedition_summary_json TEXT')
  }
}
