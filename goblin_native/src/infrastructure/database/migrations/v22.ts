import type * as SQLite from 'expo-sqlite'

/** v22: 稼働中の誕生枠を10分間隔へ補正 */
export const migrateV22 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    UPDATE goblin_birth_slots
    SET
      next_birth_at = strftime('%Y-%m-%dT%H:%M:%fZ', cycle_started_at, '+10 minutes'),
      updated_at = datetime('now')
    WHERE is_active = 1
      AND cycle_started_at IS NOT NULL
  `)
}
