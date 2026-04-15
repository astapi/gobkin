import type * as SQLite from 'expo-sqlite'

/**
 * v11: tickets テーブルを追加
 * 遠征チケット（時短・倍率UP）の残数管理
 */
export const migrateV11 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS tickets (
      ticket_type TEXT PRIMARY KEY,
      quantity INTEGER NOT NULL DEFAULT 0
    )
  `)
}
