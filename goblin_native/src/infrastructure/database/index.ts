/**
 * SQLiteデータベース初期化モジュール
 * expo-sqlite を使用したDB接続とマイグレーション管理
 */
import * as SQLite from 'expo-sqlite'
import { migrateV1 } from './migrations/v1'
import { migrateV2 } from './migrations/v2'
import { migrateV3 } from './migrations/v3'

const DB_NAME = 'goblin_kingdom.db'
const CURRENT_SCHEMA_VERSION = 3

let db: SQLite.SQLiteDatabase | null = null
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null

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
 */
export const ensureMigrations = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const currentVersion = await getSchemaVersion(database)

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    console.log(`[DB] Schema outdated (v${currentVersion}), running migrations to v${CURRENT_SCHEMA_VERSION}...`)
    await runMigrations(database)
  }
}

/**
 * データベースの初期化
 */
const initializeDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  const database = await SQLite.openDatabaseAsync(DB_NAME)
  db = database
  await runMigrations(database)
  return database
}

/**
 * マイグレーション実行
 */
const runMigrations = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const currentVersion = await getSchemaVersion(database)

  if (currentVersion < 1) {
    console.log('[DB] Running migration v1...')
    await migrateV1(database)
    await setSchemaVersion(database, 1)
    console.log('[DB] Migration v1 completed')
  }

  if (currentVersion < 2) {
    console.log('[DB] Running migration v2...')
    await migrateV2(database)
    await setSchemaVersion(database, 2)
    console.log('[DB] Migration v2 completed')
  }

  if (currentVersion < 3) {
    console.log('[DB] Running migration v3...')
    await migrateV3(database)
    await setSchemaVersion(database, 3)
    console.log('[DB] Migration v3 completed')
  }
}

/**
 * 現在のスキーマバージョンを取得
 */
const getSchemaVersion = async (database: SQLite.SQLiteDatabase): Promise<number> => {
  try {
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
  } catch {
    return 0
  }
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
  await SQLite.deleteDatabaseAsync(DB_NAME)
  await initializeDatabase()
}
