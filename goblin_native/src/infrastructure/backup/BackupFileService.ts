/**
 * バックアップファイルの書き出しと OS 共有シート起動を扱うサービス
 */
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const BACKUP_EXTENSION = 'gkbackup.json'

export class BackupSharingUnavailableError extends Error {
  constructor() {
    super('Sharing is not available on this device')
    this.name = 'BackupSharingUnavailableError'
  }
}

const formatTimestamp = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}` +
    `-` +
    `${pad(date.getHours())}` +
    `${pad(date.getMinutes())}` +
    `${pad(date.getSeconds())}`
  )
}

export const buildBackupFileName = (date: Date = new Date()): string => {
  return `goblin-kingdom_${formatTimestamp(date)}.${BACKUP_EXTENSION}`
}

/**
 * JSON 文字列をキャッシュディレクトリへ一時ファイルとして書き出し、共有シートを開く
 * 共有完了後はファイルを削除する（失敗時も best-effort で削除）
 */
export const shareBackupJson = async (json: string, fileName: string): Promise<void> => {
  const available = await Sharing.isAvailableAsync()
  if (!available) {
    throw new BackupSharingUnavailableError()
  }

  const file = new File(Paths.cache, fileName)
  if (file.exists) {
    file.delete()
  }
  file.create({ overwrite: true })
  file.write(json)

  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: fileName,
    })
  } finally {
    try {
      if (file.exists) file.delete()
    } catch {
      // キャッシュファイル削除失敗は致命的ではないので握り潰す
    }
  }
}
