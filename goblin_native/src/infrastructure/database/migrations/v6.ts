import type * as SQLite from 'expo-sqlite'

/**
 * v6: 全ゴブリンのaccuracyを×8にスケールアップ
 * 命中率計算式とaccuracy値のスケール不一致を修正
 */
export const migrateV6 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  // goblinsテーブルの全レコードを取得してaccuracyを×8
  const goblins = await database.getAllAsync<{ id: number; stats_json: string }>(
    'SELECT id, stats_json FROM goblins'
  )

  for (const goblin of goblins) {
    const stats = JSON.parse(goblin.stats_json)
    if (stats.accuracy !== undefined && stats.accuracy < 100) {
      stats.accuracy = stats.accuracy * 8
      await database.runAsync(
        'UPDATE goblins SET stats_json = ? WHERE id = ?',
        [JSON.stringify(stats), goblin.id]
      )
    }
  }

  // pending_goblinsテーブルも同様に更新
  const pendingGoblins = await database.getAllAsync<{ id: number; stats_json: string }>(
    'SELECT id, stats_json FROM pending_goblins'
  )

  for (const goblin of pendingGoblins) {
    const stats = JSON.parse(goblin.stats_json)
    if (stats.accuracy !== undefined && stats.accuracy < 100) {
      stats.accuracy = stats.accuracy * 8
      await database.runAsync(
        'UPDATE pending_goblins SET stats_json = ? WHERE id = ?',
        [JSON.stringify(stats), goblin.id]
      )
    }
  }
}
