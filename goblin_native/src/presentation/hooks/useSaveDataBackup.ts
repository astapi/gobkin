/**
 * セーブデータ Export / Import の UI 向けフック
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildBackupFileName,
  pickBackupJson,
  shareBackupJson,
  BackupSharingUnavailableError,
} from '@/infrastructure/backup/BackupFileService'
import { buildBackupDocument } from '@/infrastructure/backup/SaveDataExporter'
import {
  BackupImportError,
  importBackup,
  type ImportErrorKind,
  type ImportResult,
} from '@/infrastructure/backup/SaveDataImporter'
import { CURRENT_SCHEMA_VERSION } from '@/infrastructure/database'
import { useDebugSettingsStore } from '@/presentation/stores/useDebugSettingsStore'
import { useReset } from '@/presentation/contexts/ResetContext'
import { getCurrentLanguage, setAppLanguage } from '@/shared/i18n'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/shared/i18n/keys'
import type { BackupPreferences } from '@/core/usecases/backup/BackupSchema'

export type BackupErrorKind = 'sharingUnavailable' | 'generic' | ImportErrorKind

export interface BackupError {
  kind: BackupErrorKind
  message: string
}

export interface ImportPreview {
  fileName: string
  exportedAt: string
  schemaVersion: number
}

export interface UseSaveDataBackup {
  isExporting: boolean
  isImporting: boolean
  lastError: BackupError | null
  exportSaveData: () => Promise<boolean>
  importSaveData: () => Promise<ImportPreview | null>
  clearError: () => void
}

export const useSaveDataBackup = (): UseSaveDataBackup => {
  const { t, i18n } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [lastError, setLastError] = useState<BackupError | null>(null)
  const instantDungeonExploration = useDebugSettingsStore(
    (state) => state.instantDungeonExploration,
  )
  const setInstantDungeonExploration = useDebugSettingsStore(
    (state) => state.setInstantDungeonExploration,
  )
  const { reloadAfterImport } = useReset()

  const exportSaveData = useCallback(async (): Promise<boolean> => {
    if (isExporting) return false
    setIsExporting(true)
    setLastError(null)

    try {
      const preferences: BackupPreferences = {
        language: i18n.resolvedLanguage ?? i18n.language ?? getCurrentLanguage(),
        debugSettings: { instantDungeonExploration },
      }

      const document = await buildBackupDocument({ preferences })
      const json = JSON.stringify(document)
      const fileName = buildBackupFileName(new Date(document.meta.exportedAt))

      await shareBackupJson(json, fileName)
      return true
    } catch (error) {
      if (error instanceof BackupSharingUnavailableError) {
        setLastError({
          kind: 'sharingUnavailable',
          message: t('ui.settings.backup.errorSharingUnavailable'),
        })
      } else {
        console.error('[useSaveDataBackup] export failed:', error)
        setLastError({
          kind: 'generic',
          message: t('ui.settings.backup.errorExport'),
        })
      }
      return false
    } finally {
      setIsExporting(false)
    }
  }, [i18n.language, i18n.resolvedLanguage, instantDungeonExploration, isExporting, t])

  const importSaveData = useCallback(async (): Promise<ImportPreview | null> => {
    if (isImporting) return null
    setIsImporting(true)
    setLastError(null)

    try {
      const picked = await pickBackupJson()
      if (!picked) return null

      const result = await importBackup(picked.json, CURRENT_SCHEMA_VERSION)
      await applyImportedPreferences(result, setInstantDungeonExploration)
      await reloadAfterImport()

      return {
        fileName: picked.fileName,
        exportedAt: result.exportedAt,
        schemaVersion: result.schemaVersion,
      }
    } catch (error) {
      if (error instanceof BackupImportError) {
        setLastError({
          kind: error.kind,
          message: t(messageKeyForImportError(error.kind)),
        })
      } else {
        console.error('[useSaveDataBackup] import failed:', error)
        setLastError({
          kind: 'generic',
          message: t('ui.settings.backup.errorImport'),
        })
      }
      return null
    } finally {
      setIsImporting(false)
    }
  }, [isImporting, reloadAfterImport, setInstantDungeonExploration, t])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  return {
    isExporting,
    isImporting,
    lastError,
    exportSaveData,
    importSaveData,
    clearError,
  }
}

const applyImportedPreferences = async (
  result: ImportResult,
  setInstantDungeonExploration: (enabled: boolean) => Promise<void>,
): Promise<void> => {
  const language = result.preferences.language
  if (typeof language === 'string' && isSupportedLanguage(language)) {
    await setAppLanguage(language)
  }

  const flag = result.preferences.debugSettings?.instantDungeonExploration
  if (typeof flag === 'boolean') {
    await setInstantDungeonExploration(flag)
  }
}

const isSupportedLanguage = (value: string): value is SupportedLanguage => {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

const messageKeyForImportError = (kind: ImportErrorKind): string => {
  switch (kind) {
    case 'invalidJson':
    case 'invalidStructure':
      return 'ui.settings.backup.errorImportInvalid'
    case 'unsupportedApp':
      return 'ui.settings.backup.errorImportUnsupportedApp'
    case 'unsupportedFormat':
    case 'unsupportedSchema':
      return 'ui.settings.backup.errorImportVersionMismatch'
    case 'tampered':
      return 'ui.settings.backup.errorImportTampered'
    case 'restoreFailed':
    default:
      return 'ui.settings.backup.errorImport'
  }
}
