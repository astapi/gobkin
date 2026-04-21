/**
 * バックアップ JSON を検証し、SQLite を置き換えるインポーター
 */
import { getDatabase } from '../database'
import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  EXPORTABLE_TABLES,
  type BackupDocument,
  type ExportableTableName,
  type TableRow,
} from '../../core/usecases/backup/BackupSchema'
import { buildPayloadFromDocument, looksLikeBackupDocument, verifyBackupSignature } from './BackupSignature'

export type ImportErrorKind =
  | 'invalidJson'
  | 'invalidStructure'
  | 'unsupportedApp'
  | 'unsupportedFormat'
  | 'unsupportedSchema'
  | 'tampered'
  | 'restoreFailed'

export class BackupImportError extends Error {
  readonly kind: ImportErrorKind
  constructor(kind: ImportErrorKind, message: string) {
    super(message)
    this.name = 'BackupImportError'
    this.kind = kind
  }
}

export interface ImportResult {
  schemaVersion: number
  exportedAt: string
  preferences: BackupDocument['preferences']
}

/**
 * 1. JSON を parse
 * 2. 形式と互換性を検証
 * 3. HMAC 署名を検証
 * 4. SQLite を transaction でクリア → INSERT
 * 5. 適用された preferences を返す（呼び出し側で AsyncStorage 等へ反映）
 */
export const importBackup = async (
  rawJson: string,
  expectedSchemaVersion: number,
): Promise<ImportResult> => {
  const document = parseBackupJson(rawJson)
  validateCompatibility(document, expectedSchemaVersion)
  verifySignatureOrThrow(document)
  await replaceAllTables(document.tables)

  return {
    schemaVersion: document.meta.schemaVersion,
    exportedAt: document.meta.exportedAt,
    preferences: document.preferences,
  }
}

const parseBackupJson = (rawJson: string): BackupDocument => {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new BackupImportError('invalidJson', 'Backup file is not valid JSON')
  }
  if (!looksLikeBackupDocument(parsed)) {
    throw new BackupImportError('invalidStructure', 'Backup file is missing required fields')
  }
  return parsed
}

const validateCompatibility = (document: BackupDocument, expectedSchemaVersion: number): void => {
  const { meta, tables } = document

  if (meta.app !== BACKUP_APP_ID) {
    throw new BackupImportError('unsupportedApp', `Unsupported app id: ${String(meta.app)}`)
  }
  if (meta.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupImportError(
      'unsupportedFormat',
      `Unsupported format version: ${meta.formatVersion}`,
    )
  }
  if (meta.schemaVersion !== expectedSchemaVersion) {
    throw new BackupImportError(
      'unsupportedSchema',
      `Schema version mismatch: file=${meta.schemaVersion}, current=${expectedSchemaVersion}`,
    )
  }

  for (const table of EXPORTABLE_TABLES) {
    if (!Array.isArray(tables[table])) {
      throw new BackupImportError(
        'invalidStructure',
        `Backup is missing table data: ${table}`,
      )
    }
  }
}

const verifySignatureOrThrow = (document: BackupDocument): void => {
  const payload = buildPayloadFromDocument(document)
  if (!verifyBackupSignature(payload, document.meta.signature)) {
    throw new BackupImportError('tampered', 'Backup signature does not match')
  }
}

/**
 * 既存データを transaction 内で全消去し、バックアップの内容で置き換える
 * - DELETE は FK 依存の逆順
 * - INSERT は EXPORTABLE_TABLES の順（goblins → equipment 等の依存順）
 * - INSERT 列はテーブルの現行スキーマと突き合わせ、未知列は無視する
 */
const replaceAllTables = async (
  tables: Record<ExportableTableName, TableRow[]>,
): Promise<void> => {
  const db = await getDatabase()
  const tableColumns = await loadTableColumns()

  try {
    await db.withTransactionAsync(async () => {
      for (const table of [...EXPORTABLE_TABLES].reverse()) {
        await db.runAsync(`DELETE FROM ${table}`)
      }
      for (const table of EXPORTABLE_TABLES) {
        const allowedColumns = tableColumns[table]
        for (const row of tables[table]) {
          await insertRow(table, row, allowedColumns)
        }
      }
    })
  } catch (error) {
    throw new BackupImportError(
      'restoreFailed',
      error instanceof Error ? error.message : 'DB restore failed',
    )
  }
}

const insertRow = async (
  table: ExportableTableName,
  row: TableRow,
  allowedColumns: ReadonlySet<string>,
): Promise<void> => {
  const columns: string[] = []
  const values: (string | number | null)[] = []
  for (const [key, value] of Object.entries(row)) {
    if (!allowedColumns.has(key)) continue
    columns.push(key)
    values.push(normalizeValue(value))
  }
  if (columns.length === 0) return

  const db = await getDatabase()
  const placeholders = columns.map(() => '?').join(', ')
  const columnList = columns.map(c => `"${c}"`).join(', ')
  await db.runAsync(`INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`, values)
}

const normalizeValue = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return JSON.stringify(value)
}

const loadTableColumns = async (): Promise<Record<ExportableTableName, ReadonlySet<string>>> => {
  const db = await getDatabase()
  const result = {} as Record<ExportableTableName, ReadonlySet<string>>
  for (const table of EXPORTABLE_TABLES) {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
    result[table] = new Set(rows.map(r => r.name))
  }
  return result
}
