/**
 * Composition Root（セーブデータ バックアップ）
 *
 * presentation / app 層が infrastructure を直接 import しないよう、
 * バックアップ関連のサービスをここから提供する。
 */
export {
  buildBackupFileName,
  pickBackupJson,
  shareBackupJson,
  BackupSharingUnavailableError,
} from '@/infrastructure/backup/BackupFileService'
export { buildBackupDocument } from '@/infrastructure/backup/SaveDataExporter'
export {
  BackupImportError,
  importBackup,
  type ImportErrorKind,
  type ImportResult,
} from '@/infrastructure/backup/SaveDataImporter'
