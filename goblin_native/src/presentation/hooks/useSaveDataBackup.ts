/**
 * セーブデータ Export / Import の UI 向けフック
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildBackupFileName,
  shareBackupJson,
  BackupSharingUnavailableError,
} from '@/infrastructure/backup/BackupFileService'
import { buildBackupDocument } from '@/infrastructure/backup/SaveDataExporter'
import { useDebugSettingsStore } from '@/presentation/stores/useDebugSettingsStore'
import { getCurrentLanguage } from '@/shared/i18n'
import type { BackupPreferences } from '@/core/usecases/backup/BackupSchema'

export type BackupErrorKind = 'sharingUnavailable' | 'generic'

export interface BackupError {
  kind: BackupErrorKind
  message: string
}

export interface UseSaveDataBackup {
  isExporting: boolean
  lastError: BackupError | null
  exportSaveData: () => Promise<boolean>
  clearError: () => void
}

export const useSaveDataBackup = (): UseSaveDataBackup => {
  const { t, i18n } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)
  const [lastError, setLastError] = useState<BackupError | null>(null)
  const instantDungeonExploration = useDebugSettingsStore(
    (state) => state.instantDungeonExploration,
  )

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

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  return {
    isExporting,
    lastError,
    exportSaveData,
    clearError,
  }
}
