import type * as SQLite from 'expo-sqlite'
import { areasData } from '../../../shared/data'

/**
 * v16: ダンジョン進行状況に tier 別の最大クリア済みフロアを追加
 */
export const migrateV16 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(dungeon_progress)')
  if (!columns.some(column => column.name === 'cleared_floors_json')) {
    await database.execAsync("ALTER TABLE dungeon_progress ADD COLUMN cleared_floors_json TEXT NOT NULL DEFAULT '{}'")
  }

  const rows = await database.getAllAsync<{
    dungeon_id: string
    cleared: number
    max_cleared_tier: number
    cleared_floors_json: string | null
  }>('SELECT dungeon_id, cleared, max_cleared_tier, cleared_floors_json FROM dungeon_progress')

  for (const row of rows) {
    if (row.cleared_floors_json && row.cleared_floors_json !== '{}') continue
    if (row.cleared !== 1) continue

    const dungeon = areasData.find(area => area.id === row.dungeon_id)
    if (!dungeon) continue

    const maxClearedTier = Math.max(1, row.max_cleared_tier ?? 1)
    const maxClearedFloorsByTier: Record<number, number> = {}
    for (let tier = 0; tier < maxClearedTier; tier++) {
      maxClearedFloorsByTier[tier] = dungeon.floors
    }

    await database.runAsync(
      'UPDATE dungeon_progress SET cleared_floors_json = ? WHERE dungeon_id = ?',
      [JSON.stringify(maxClearedFloorsByTier), row.dungeon_id],
    )
  }
}
