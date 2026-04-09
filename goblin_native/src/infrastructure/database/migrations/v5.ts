import type * as SQLite from 'expo-sqlite'

function removeSpField(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeSpField)
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'sp')
      .map(([key, nestedValue]) => [key, removeSpField(nestedValue)])
    return Object.fromEntries(entries)
  }

  return value
}

async function sanitizeJsonColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  idColumn: string,
  jsonColumn: string
): Promise<void> {
  const rows = await database.getAllAsync<Record<string, string | number | null>>(
    `SELECT ${idColumn}, ${jsonColumn} FROM ${table}`
  )

  for (const row of rows) {
    const rawValue = row[jsonColumn]
    if (typeof rawValue !== 'string' || rawValue.length === 0) continue

    try {
      const parsed = JSON.parse(rawValue)
      const sanitized = removeSpField(parsed)
      const nextValue = JSON.stringify(sanitized)

      if (nextValue === rawValue) continue

      await database.runAsync(
        `UPDATE ${table} SET ${jsonColumn} = ? WHERE ${idColumn} = ?`,
        [nextValue, row[idColumn] as string | number]
      )
    } catch {
      // 既存データが壊れている場合は移行を継続する
    }
  }
}

export const migrateV5 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await sanitizeJsonColumn(database, 'goblins', 'id', 'stats_json')
  await sanitizeJsonColumn(database, 'goblins', 'id', 'effective_stats_json')
  await sanitizeJsonColumn(database, 'pending_goblins', 'id', 'stats_json')
  await sanitizeJsonColumn(database, 'pending_goblins', 'id', 'effective_stats_json')
  await sanitizeJsonColumn(database, 'expeditions', 'id', 'replay_json')
}
