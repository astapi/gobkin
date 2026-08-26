import type * as SQLite from 'expo-sqlite'

async function addPlusValueColumn(
  database: SQLite.SQLiteDatabase,
  tableName: 'goblins' | 'pending_goblins',
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`)
  if (!columns.some((column) => column.name === 'plus_value')) {
    await database.execAsync(
      `ALTER TABLE ${tableName} ADD COLUMN plus_value INTEGER NOT NULL DEFAULT 0`,
    )
  }
}

async function migrateBirthSlotSourceColumn(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(goblin_birth_slots)')
  if (columns.some((column) => column.name === 'source_goblin_id')) return

  await database.execAsync(`
    CREATE TABLE goblin_birth_slots_v23 (
      slot_index INTEGER PRIMARY KEY CHECK (slot_index >= 1),
      source_goblin_id INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      cycle_started_at TEXT,
      next_birth_at TEXT,
      source_snapshots_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO goblin_birth_slots_v23 (
      slot_index, source_goblin_id, is_active, cycle_started_at,
      next_birth_at, source_snapshots_json, updated_at
    )
    SELECT
      slot_index, source_goblin_1_id, is_active, cycle_started_at,
      next_birth_at, source_snapshots_json, updated_at
    FROM goblin_birth_slots;
    DROP TABLE goblin_birth_slots;
    ALTER TABLE goblin_birth_slots_v23 RENAME TO goblin_birth_slots;
  `)
}

/** v23: 個体値に代わる血統＋値を追加 */
export const migrateV23 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await addPlusValueColumn(database, 'goblins')
  await addPlusValueColumn(database, 'pending_goblins')
  await migrateBirthSlotSourceColumn(database)
}
