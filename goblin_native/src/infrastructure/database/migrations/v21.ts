import type * as SQLite from 'expo-sqlite'

/** v21: 「群れを増やす」の継続誕生枠を追加 */
export const migrateV21 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS goblin_birth_slots (
      slot_index INTEGER PRIMARY KEY CHECK (slot_index >= 1),
      source_goblin_id INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      cycle_started_at TEXT,
      next_birth_at TEXT,
      source_snapshots_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}
