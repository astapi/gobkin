/**
 * SQLite の全データをダンプし、BackupDocument を生成する
 */
import { Platform } from 'react-native'
import { getDatabase } from '../database'
import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  EXPORTABLE_TABLES,
  type BackupDocument,
  type BackupPreferences,
  type ExportableTableName,
  type TableRow,
} from '../../core/usecases/backup/BackupSchema'

const APP_VERSION = '1.0.0'

export interface ExportInput {
  preferences: BackupPreferences
}

export const buildBackupDocument = async (input: ExportInput): Promise<BackupDocument> => {
  const db = await getDatabase()

  const tables = {} as Record<ExportableTableName, TableRow[]>
  for (const table of EXPORTABLE_TABLES) {
    const rows = await db.getAllAsync<TableRow>(`SELECT * FROM ${table}`)
    tables[table] = rows
  }

  const schemaVersion = await getSchemaVersion(tables.app_metadata)
  const tablesJson = JSON.stringify(tables)
  const checksum = computeChecksum(tablesJson)

  return {
    meta: {
      app: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: APP_VERSION,
      schemaVersion,
      exportedAt: new Date().toISOString(),
      platform: resolvePlatform(),
      checksum,
    },
    tables,
    preferences: input.preferences,
  }
}

const getSchemaVersion = async (appMetadataRows: TableRow[]): Promise<number> => {
  const row = appMetadataRows.find(r => r.key === 'schema_version')
  if (!row) return 0
  const parsed = parseInt(String(row.value ?? '0'), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

const resolvePlatform = (): 'ios' | 'android' | 'web' | 'unknown' => {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  if (Platform.OS === 'web') return 'web'
  return 'unknown'
}

/**
 * 破損検知用の軽量チェックサム (FNV-1a 32bit)
 * 暗号学的強度は不要のため、ハッシュライブラリの追加依存を避ける目的で独自実装
 */
export const computeChecksum = (input: string): string => {
  const FNV_OFFSET = 0x811c9dc5
  const FNV_PRIME = 0x01000193
  let hash = FNV_OFFSET
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  const unsigned = hash >>> 0
  return `fnv1a-${unsigned.toString(16).padStart(8, '0')}`
}
