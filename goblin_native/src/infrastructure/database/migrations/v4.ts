import type * as SQLite from 'expo-sqlite'

/**
 * v4マイグレーション: 装備テーブルの追加
 */
export const migrateV4 = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL DEFAULT -1,
      goblin_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (goblin_id) REFERENCES goblins(id) ON DELETE SET NULL
    )
  `)

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_equipment_goblin_id ON equipment(goblin_id)
  `)
}
