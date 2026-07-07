/**
 * SQLite の全データをダンプし、BackupDocument を生成する
 */
import { Platform } from 'react-native'
import { getDatabase } from '../database'
import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  BACKUP_SIGNATURE_ALGORITHM,
  EXPORTABLE_TABLES,
  type BackupDocument,
  type BackupMeta,
  type BackupPreferences,
  type ExportableTableName,
  type TableRow,
} from '../../core/usecases/backup/BackupSchema'
import { buildSignablePayload, signBackup } from './BackupSignature'

// TODO: ネイティブアプリバージョンを動的取得する。
// expo-application / expo-constants は現状 package.json の直接依存ではないため、
// 依存に追加した上で expo-application の nativeApplicationVersion 等へ差し替える。
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

  const metaWithoutSignature: Omit<BackupMeta, 'signature'> = {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: APP_VERSION,
    schemaVersion,
    exportedAt: new Date().toISOString(),
    platform: resolvePlatform(),
    signatureAlgorithm: BACKUP_SIGNATURE_ALGORITHM,
  }

  const payload = buildSignablePayload(metaWithoutSignature, tables, input.preferences)
  const signature = signBackup(payload)

  return {
    meta: { ...metaWithoutSignature, signature },
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
