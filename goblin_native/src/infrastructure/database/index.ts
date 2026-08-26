/**
 * SQLiteデータベース初期化モジュール
 * expo-sqlite を使用したDB接続とマイグレーション管理
 */
import * as SQLite from 'expo-sqlite'
import { migrateV1 } from './migrations/v1'
import { migrateV2 } from './migrations/v2'
import { migrateV3 } from './migrations/v3'
import { migrateV4 } from './migrations/v4'
import { migrateV5 } from './migrations/v5'
import { migrateV6 } from './migrations/v6'
import { migrateV7 } from './migrations/v7'
import { migrateV8 } from './migrations/v8'
import { migrateV9 } from './migrations/v9'
import { migrateV10 } from './migrations/v10'
import { migrateV11 } from './migrations/v11'
import { migrateV12 } from './migrations/v12'
import { migrateV13 } from './migrations/v13'
import { migrateV14 } from './migrations/v14'
import { migrateV15 } from './migrations/v15'
import { migrateV16 } from './migrations/v16'
import { migrateV17 } from './migrations/v17'
import { migrateV18 } from './migrations/v18'
import { migrateV19 } from './migrations/v19'
import { migrateV20 } from './migrations/v20'
import { migrateV21 } from './migrations/v21'
import { migrateV22 } from './migrations/v22'
import { migrateV23 } from './migrations/v23'

const DB_NAME = 'goblin_kingdom.db'
export const CURRENT_SCHEMA_VERSION = 23

/**
 * マイグレーション一覧（バージョン昇順）
 * 各エントリは対象バージョンと適用関数を持つ
 */
const MIGRATIONS: ReadonlyArray<{
  version: number
  migrate: (database: SQLite.SQLiteDatabase) => Promise<void>
}> = [
  { version: 1, migrate: migrateV1 },
  { version: 2, migrate: migrateV2 },
  { version: 3, migrate: migrateV3 },
  { version: 4, migrate: migrateV4 },
  { version: 5, migrate: migrateV5 },
  { version: 6, migrate: migrateV6 },
  { version: 7, migrate: migrateV7 },
  { version: 8, migrate: migrateV8 },
  { version: 9, migrate: migrateV9 },
  { version: 10, migrate: migrateV10 },
  { version: 11, migrate: migrateV11 },
  { version: 12, migrate: migrateV12 },
  { version: 13, migrate: migrateV13 },
  { version: 14, migrate: migrateV14 },
  { version: 15, migrate: migrateV15 },
  { version: 16, migrate: migrateV16 },
  { version: 17, migrate: migrateV17 },
  { version: 18, migrate: migrateV18 },
  { version: 19, migrate: migrateV19 },
  { version: 20, migrate: migrateV20 },
  { version: 21, migrate: migrateV21 },
  { version: 22, migrate: migrateV22 },
  { version: 23, migrate: migrateV23 },
]

let db: SQLite.SQLiteDatabase | null = null
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null
// 進行中のマイグレーションを直列化するための in-flight Promise
let migrationPromise: Promise<void> | null = null

/**
 * データベース接続を取得
 * シングルトンパターンで同一インスタンスを返す
 * 初期化失敗時は再試行可能
 *
 * IMPORTANT: アプリアップデート後も正しくマイグレーションを実行するため、
 * 既存の接続がある場合でもスキーマバージョンをチェックします
 */
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  // 既に接続がある場合、スキーマバージョンをチェック
  if (db) {
    await ensureMigrations(db)
    return db
  }

  // 初期化中の場合は同じPromiseを返す（重複初期化防止）
  if (initializationPromise) {
    return initializationPromise
  }

  // 初期化失敗時にPromiseをリセットして再試行可能にする
  initializationPromise = initializeDatabase().catch(error => {
    initializationPromise = null
    throw error
  })

  return initializationPromise
}

/**
 * マイグレーションが必要かチェックし、必要なら実行
 * アプリアップデート後にプロセスが生き続けている場合でも対応
 *
 * 進行中のマイグレーションがある場合は同じ Promise を待ち、
 * 並行呼び出しによる二重実行を防ぐ
 */
export const ensureMigrations = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  if (migrationPromise) {
    await migrationPromise
    return
  }
  migrationPromise = runMigrations(database).finally(() => {
    migrationPromise = null
  })
  await migrationPromise
}

/**
 * データベースの初期化
 */
const initializeDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  const database = await SQLite.openDatabaseAsync(DB_NAME)
  await runMigrations(database)
  // FK 制約を有効化（equipment の ON DELETE SET NULL を機能させる）
  await database.execAsync('PRAGMA foreign_keys = ON')
  // マイグレーション完了後に公開し、並行 getDatabase() による二重初期化を防ぐ
  db = database
  return database
}

/**
 * マイグレーション実行
 * 各マイグレーションと schema_version 更新を 1 つのトランザクションで
 * 原子的に適用し、途中クラッシュによるテーブル消失を防ぐ
 */
const runMigrations = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const currentVersion = await getSchemaVersion(database)
  if (currentVersion >= CURRENT_SCHEMA_VERSION) return

  console.log(`[DB] Schema outdated (v${currentVersion}), running migrations to v${CURRENT_SCHEMA_VERSION}...`)

  // マイグレーション中は FK 制約を無効化し、意図しない連鎖削除を防ぐ。
  // （FK ON のまま v15 の DROP TABLE goblins を行うと暗黙 DELETE により
  //   equipment.goblin_id が ON DELETE SET NULL で NULL 化してしまう）
  // withExclusiveTransactionAsync は別コネクションで実行され、そちらは既定で FK OFF だが、
  // メインコネクション側も明示的に OFF にしておき、FK は全マイグレーション完了後に有効化する。
  await database.execAsync('PRAGMA foreign_keys = OFF')
  try {
    for (const { version, migrate } of MIGRATIONS) {
      if (currentVersion < version) {
        console.log(`[DB] Running migration v${version}...`)
        await database.withExclusiveTransactionAsync(async (txn) => {
          await migrate(txn)
          await setSchemaVersion(txn, version)
        })
        console.log(`[DB] Migration v${version} completed`)
      }
    }
  } finally {
    // マイグレーション完了後に FK 制約を有効化する
    await database.execAsync('PRAGMA foreign_keys = ON')
  }
}

/**
 * 現在のスキーマバージョンを取得
 * テーブル/行が存在しない場合のみ 0 を返し、それ以外の DB エラーはそのまま伝播させる
 * （一時的なエラーで 0 を返すと全マイグレーションが再実行されてしまうため）
 */
const getSchemaVersion = async (database: SQLite.SQLiteDatabase): Promise<number> => {
  // app_metadata テーブルが存在するか確認
  const tableExists = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='app_metadata'"
  )

  if (!tableExists) {
    return 0
  }

  const result = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'schema_version'"
  )

  return result ? parseInt(result.value, 10) : 0
}

/**
 * スキーマバージョンを設定
 */
const setSchemaVersion = async (
  database: SQLite.SQLiteDatabase,
  version: number
): Promise<void> => {
  await database.runAsync(
    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('schema_version', ?)",
    [version.toString()]
  )
}

/**
 * データベースをクローズ（主にテスト用）
 */
export const closeDatabase = async (): Promise<void> => {
  // 初期化中のPromiseがあれば完了を待つ
  if (initializationPromise) {
    try {
      await initializationPromise
    } catch {
      // 初期化失敗は無視
    }
  }
  if (db) {
    await db.closeAsync()
    db = null
  }
  initializationPromise = null
  migrationPromise = null
}

/**
 * データベースをリセット（削除→再初期化）
 */
export const resetDatabase = async (): Promise<void> => {
  if (initializationPromise) {
    try {
      const database = await initializationPromise
      await database.closeAsync()
    } catch {
      // 初期化失敗は無視
    }
  } else if (db) {
    await db.closeAsync()
  }
  db = null
  initializationPromise = null
  migrationPromise = null
  await SQLite.deleteDatabaseAsync(DB_NAME)
  await initializeDatabase()
}
