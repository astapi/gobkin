/**
 * 初期スキーママイグレーション (v1)
 * 全テーブルの作成と初期データの挿入
 */
import type * as SQLite from 'expo-sqlite'
import { SCHEMA } from '../schema'

export const migrateV1 = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  // テーブル作成
  await db.execAsync(SCHEMA.goblins)
  await db.execAsync(SCHEMA.goblinsIndexes)
  await db.execAsync(SCHEMA.pendingGoblins)
  await db.execAsync(SCHEMA.parties)
  await db.execAsync(SCHEMA.partiesIndex)
  await db.execAsync(SCHEMA.expeditions)
  await db.execAsync(SCHEMA.expeditionsIndexes)
  await db.execAsync(SCHEMA.baseState)
  await db.execAsync(SCHEMA.baseStateInit)
  await db.execAsync(SCHEMA.dungeonProgress)
  await db.execAsync(SCHEMA.appMetadata)
  await db.execAsync(SCHEMA.appMetadataInit)

  // 初期ゴブリンを拠点メンバーとして登録
  await db.execAsync(SCHEMA.goblinsInit)
}
