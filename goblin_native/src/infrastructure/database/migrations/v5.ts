import type * as SQLite from 'expo-sqlite'

/**
 * v5: base_state に next_goblin_id カラムを追加
 * キャッシュ削除後もアトミックなID採番を行うため
 */
export const migrateV5 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  // next_goblin_id カラムが既に存在するかチェック（v1スキーマに含まれている場合はスキップ）
  const columns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(base_state)"
  )
  const hasColumn = columns.some(col => col.name === 'next_goblin_id')

  if (!hasColumn) {
    await database.execAsync(`
      ALTER TABLE base_state ADD COLUMN next_goblin_id INTEGER NOT NULL DEFAULT 1
    `)
  }

  // 現在の MAX(id)+1 で初期化
  const goblinMax = await database.getFirstAsync<{ max_id: number | null }>(
    'SELECT MAX(id) as max_id FROM goblins'
  )
  const pendingMax = await database.getFirstAsync<{ max_id: number | null }>(
    'SELECT MAX(id) as max_id FROM pending_goblins'
  )

  const maxGoblin = goblinMax?.max_id ?? 0
  const maxPending = pendingMax?.max_id ?? 0
  const nextId = Math.max(maxGoblin, maxPending) + 1

  await database.runAsync(
    'UPDATE base_state SET next_goblin_id = ? WHERE id = 1',
    [nextId]
  )
}
