import type * as SQLite from 'expo-sqlite'

const LEGACY_RACE_TO_ID: Record<string, string> = {
  ゴブリン: 'goblin',
  スライムゴブリン: 'slime',
  ウルフゴブリン: 'wolf',
  オークゴブリン: 'orc',
  アンデッドゴブリン: 'undead',
  ホブゴブリン: 'hobgoblin',
  ドワーフゴブリン: 'dwarf',
  エルフゴブリン: 'elf',
  スケイルゴブリン: 'lizardman',
  トロルゴブリン: 'troll',
}

async function ensureRaceIdColumn(
  database: SQLite.SQLiteDatabase,
  tableName: 'goblins' | 'pending_goblins',
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`)
  if (!columns.some((column) => column.name === 'race_id')) {
    await database.execAsync(`ALTER TABLE ${tableName} ADD COLUMN race_id TEXT`)
  }

  const rows = await database.getAllAsync<{ id: number; race: string; race_id: string | null }>(
    `SELECT id, race, race_id FROM ${tableName}`,
  )

  for (const row of rows) {
    const normalizedRaceId = row.race_id ?? LEGACY_RACE_TO_ID[row.race] ?? 'goblin'
    await database.runAsync(
      `UPDATE ${tableName} SET race_id = ? WHERE id = ?`,
      [normalizedRaceId, row.id],
    )
  }
}

export const migrateV7 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await ensureRaceIdColumn(database, 'goblins')
  await ensureRaceIdColumn(database, 'pending_goblins')
}
