import type * as SQLite from 'expo-sqlite'

async function ensureCurrentHpColumn(
  database: SQLite.SQLiteDatabase,
  tableName: 'goblins' | 'pending_goblins',
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`)
  if (!columns.some(column => column.name === 'current_hp')) {
    await database.execAsync(`ALTER TABLE ${tableName} ADD COLUMN current_hp INTEGER`)
  }
}

export const migrateV9 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await ensureCurrentHpColumn(database, 'goblins')
  await ensureCurrentHpColumn(database, 'pending_goblins')
}
