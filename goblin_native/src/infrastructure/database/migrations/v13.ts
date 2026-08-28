import type * as SQLite from 'expo-sqlite'

async function addBattleActionPolicyColumn(database: SQLite.SQLiteDatabase, table: string): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
  if (!columns.some(column => column.name === 'battle_action_policy_json')) {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN battle_action_policy_json TEXT`)
  }
}

/**
 * v13: ゴブリン本体に戦闘行動率設定を追加
 */
export const migrateV13 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await addBattleActionPolicyColumn(database, 'goblins')
  await addBattleActionPolicyColumn(database, 'pending_goblins')
}
