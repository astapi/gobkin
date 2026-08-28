import type * as SQLite from 'expo-sqlite'

async function addPartyMultiplierColumn(
  database: SQLite.SQLiteDatabase,
  columnName: string
): Promise<void> {
  try {
    await database.execAsync(
      `ALTER TABLE parties ADD COLUMN ${columnName} REAL NOT NULL DEFAULT 1.0`
    )
  } catch {
    // 既に列がある場合は何もしない
  }
}

export const migrateV4 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await addPartyMultiplierColumn(database, 'gold_multiplier')
  await addPartyMultiplierColumn(database, 'rare_multiplier')
  await addPartyMultiplierColumn(database, 'title_multiplier')

  await database.runAsync(
    `UPDATE parties
     SET gold_multiplier = COALESCE(gold_multiplier, 1.0),
         rare_multiplier = COALESCE(rare_multiplier, 1.0),
         title_multiplier = COALESCE(title_multiplier, 1.0)`
  )
}
