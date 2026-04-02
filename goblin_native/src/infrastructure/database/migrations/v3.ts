/**
 * スキーママイグレーション (v3)
 * base_state に拠点ランクシステム用のカラムを追加
 */
import type * as SQLite from 'expo-sqlite'

export const migrateV3 = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info('base_state')"
  )

  // 各カラムが存在するかチェック
  const hasCapturedDungeons = columns.some(column => column.name === 'captured_dungeons_json')
  const hasCurrentMaxParties = columns.some(column => column.name === 'current_max_parties')
  const hasCurrentMaxGoblins = columns.some(column => column.name === 'current_max_goblins')
  const hasCurrentIVBonus = columns.some(column => column.name === 'current_iv_bonus')

  // カラムを追加（存在しない場合のみ）
  if (!hasCapturedDungeons) {
    await db.execAsync(
      "ALTER TABLE base_state ADD COLUMN captured_dungeons_json TEXT NOT NULL DEFAULT '[]'"
    )
  }

  if (!hasCurrentMaxParties) {
    await db.execAsync(
      'ALTER TABLE base_state ADD COLUMN current_max_parties INTEGER NOT NULL DEFAULT 1'
    )
  }

  if (!hasCurrentMaxGoblins) {
    await db.execAsync(
      'ALTER TABLE base_state ADD COLUMN current_max_goblins INTEGER NOT NULL DEFAULT 10'
    )
  }

  if (!hasCurrentIVBonus) {
    await db.execAsync(
      'ALTER TABLE base_state ADD COLUMN current_iv_bonus INTEGER NOT NULL DEFAULT 0'
    )
  }

  // goldカラムを追加
  const hasGold = columns.some(column => column.name === 'gold')
  if (!hasGold) {
    await db.execAsync(
      'ALTER TABLE base_state ADD COLUMN gold INTEGER NOT NULL DEFAULT 0'
    )
  }

  console.log('[Migration v3] Base state table migration completed')
}
