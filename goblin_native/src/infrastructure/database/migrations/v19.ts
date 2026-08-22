import type * as SQLite from 'expo-sqlite'
import { areasData } from '../../../shared/data'

/**
 * v19: イベントダンジョン追加に伴う遡及解放
 *
 * 解放グラフ再配線(平原会戦/奪還防衛戦/王都平原会戦/約束の履行イベント、
 * 丘陵村チェーン、トロル峡谷の分岐辺修復)で追加された解放先を、
 * すでに親エリアをクリア済みの既存ユーザーにも解放する。
 *
 * クリア済みの全エリアについて unlockNext / unlockNexts の対象を
 * unlocked=1 で upsert する(冪等)。
 */
export const migrateV19 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const clearedRows = await database.getAllAsync<{ dungeon_id: string }>(
    'SELECT dungeon_id FROM dungeon_progress WHERE cleared = 1'
  )
  const clearedIds = new Set(clearedRows.map(row => row.dungeon_id))

  for (const area of areasData) {
    if (!clearedIds.has(area.id)) continue

    const unlockTargets = [
      ...(area.unlockNext ? [area.unlockNext] : []),
      ...(area.unlockNexts ?? []),
    ]

    for (const targetId of unlockTargets) {
      await database.runAsync(
        `INSERT INTO dungeon_progress (dungeon_id, unlocked)
         VALUES (?, 1)
         ON CONFLICT(dungeon_id) DO UPDATE SET unlocked = 1, updated_at = datetime('now')`,
        [targetId]
      )
    }
  }
}
