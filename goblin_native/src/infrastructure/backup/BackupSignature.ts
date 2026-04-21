/**
 * バックアップファイルの改ざん検知用 HMAC-SHA256 署名
 *
 * 用途: シングルプレイ向けのカジュアルチート抑止。
 * 鍵はアプリバンドルから抽出可能なので暗号学的な秘匿性は持たないが、
 * JSON を手で書き換えただけのインポートは確実に弾ける。
 */
import { sha256 } from 'js-sha256'
import {
  BACKUP_APP_ID,
  type BackupDocument,
  type BackupMeta,
  type BackupPreferences,
  type ExportableTableName,
  type TableRow,
} from '../../core/usecases/backup/BackupSchema'

const BACKUP_SECRET = 'gkbk-7f3a9c4d-2e8b-4a5d-9f1c-6e3b8d2a0c5e'

/**
 * 署名対象の決定的な文字列を生成する
 * - meta.signature 自身は対象外
 * - JSON のキー順差で署名値が揺れないよう、キーを再帰的にソートする
 */
export const buildSignablePayload = (
  meta: Omit<BackupMeta, 'signature'>,
  tables: Record<ExportableTableName, TableRow[]>,
  preferences: BackupPreferences,
): string => {
  return canonicalStringify({ meta, tables, preferences })
}

export const signBackup = (payload: string): string => {
  return sha256.hmac(BACKUP_SECRET, payload)
}

export const verifyBackupSignature = (payload: string, signature: string): boolean => {
  const expected = signBackup(payload)
  return timingSafeEqual(expected, signature)
}

/**
 * 既知の BackupDocument から署名対象ペイロードを取り出すヘルパ
 * meta から signature を除外したうえで canonical 化する
 */
export const buildPayloadFromDocument = (doc: BackupDocument): string => {
  const { signature: _signature, ...metaWithoutSig } = doc.meta
  return buildSignablePayload(metaWithoutSig, doc.tables, doc.preferences)
}

/**
 * Backup ドキュメントが現アプリで作成されたものか緩く判定する
 * (app id が一致するかだけを確認 — 厳密な検証は signature が担う)
 */
export const looksLikeBackupDocument = (value: unknown): value is BackupDocument => {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!v.meta || typeof v.meta !== 'object') return false
  const meta = v.meta as Record<string, unknown>
  if (meta.app !== BACKUP_APP_ID) return false
  if (typeof meta.signature !== 'string') return false
  if (!v.tables || typeof v.tables !== 'object') return false
  if (!v.preferences || typeof v.preferences !== 'object') return false
  return true
}

const canonicalStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const body = keys
    .map(key => JSON.stringify(key) + ':' + canonicalStringify(obj[key]))
    .join(',')
  return '{' + body + '}'
}

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
