import type * as SQLite from 'expo-sqlite'

async function addJobColumn(database: SQLite.SQLiteDatabase, table: string): Promise<void> {
  try {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN job_id TEXT`)
  } catch {
    // 既に列がある場合は何もしない
  }
}

export const migrateV3 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await addJobColumn(database, 'goblins')
  await addJobColumn(database, 'pending_goblins')
}
