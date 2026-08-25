import type * as SQLite from 'expo-sqlite'

/** v20: 装備のprefix/suffix MODを保存するJSON列を追加 */
export const migrateV20 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(equipment)')
  if (!columns.some((column) => column.name === 'prefix_mod_json')) {
    await database.execAsync('ALTER TABLE equipment ADD COLUMN prefix_mod_json TEXT')
  }
  if (!columns.some((column) => column.name === 'suffix_mod_json')) {
    await database.execAsync('ALTER TABLE equipment ADD COLUMN suffix_mod_json TEXT')
  }
}
