/**
 * セーブデータバックアップ共通の型定義とスキーマ定数
 */

export const BACKUP_APP_ID = 'goblin_kingdom'
export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_SIGNATURE_ALGORITHM = 'HMAC-SHA256'

export const EXPORTABLE_TABLES = [
  'goblins',
  'pending_goblins',
  'parties',
  'expeditions',
  'base_state',
  'dungeon_progress',
  'equipment',
  'story_progress',
  'app_metadata',
] as const

export type ExportableTableName = (typeof EXPORTABLE_TABLES)[number]

export type TableRow = Record<string, unknown>

export interface BackupMeta {
  app: typeof BACKUP_APP_ID
  formatVersion: number
  appVersion: string
  schemaVersion: number
  exportedAt: string
  platform: 'ios' | 'android' | 'web' | 'unknown'
  signatureAlgorithm: typeof BACKUP_SIGNATURE_ALGORITHM
  signature: string
}

export interface BackupPreferences {
  language?: string
  debugSettings?: {
    instantDungeonExploration?: boolean
  }
}

export interface BackupDocument {
  meta: BackupMeta
  tables: Record<ExportableTableName, TableRow[]>
  preferences: BackupPreferences
}
