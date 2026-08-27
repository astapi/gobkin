import type * as SQLite from 'expo-sqlite'

/** v24: 待機枠満杯中の誕生進行を停止できるようにする。 */
export const migrateV24 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(goblin_birth_slots)')
  if (!columns.some((column) => column.name === 'capacity_paused_at')) {
    await database.execAsync('ALTER TABLE goblin_birth_slots ADD COLUMN capacity_paused_at TEXT')
  }
}
