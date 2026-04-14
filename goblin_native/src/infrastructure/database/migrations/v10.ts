import type * as SQLite from 'expo-sqlite'

/**
 * v10: expeditions テーブルに expedition_meta_json カラムを追加
 * 遅延計算用メタデータ（seed, request, departingGoblins, rewardMultipliers）を保持する
 */
export const migrateV10 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(expeditions)')
  if (!columns.some(column => column.name === 'expedition_meta_json')) {
    await database.execAsync('ALTER TABLE expeditions ADD COLUMN expedition_meta_json TEXT')
  }
}
