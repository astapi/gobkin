import type { Dungeon, DungeonTier, ExpeditionRecord, Party } from '../types'

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 進行中の自動周回をOFFにし、現在の1周だけが帰還待ちになっているかを返す。 */
export function isAutoExpeditionStopPending(
  party: Party,
  record: ExpeditionRecord | undefined,
): boolean {
  if (
    party.autoExpeditionEnabled ||
    (party.status ?? 'idle') !== 'expedition' ||
    !party.autoExpeditionSessionId ||
    record?.status !== 'ongoing'
  ) {
    return false
  }

  const recordSessionId = record.expeditionMeta?.request.autoExpeditionSessionId
    ?? record.replay?.meta.autoExpeditionSessionId
  return recordSessionId === party.autoExpeditionSessionId
}

/** 自動周回セッションに属する遠征かを返す。 */
export function isAutoExpeditionRecord(record: ExpeditionRecord): boolean {
  return Boolean(
    record.expeditionMeta?.request.autoExpeditionSessionId ??
    record.replay?.meta.autoExpeditionSessionId,
  )
}

/** ローカル日付の0時をまたぐ自動周回かを返す。帰還後は設定を維持して次周を開始しない。 */
export function isAutoExpeditionDayBoundaryRun(record: ExpeditionRecord): boolean {
  return Boolean(
    isAutoExpeditionRecord(record) &&
    record.returnTime &&
    getLocalDateKey(record.startTime) !== getLocalDateKey(record.returnTime),
  )
}

export function isAutoExpeditionDungeonCleared(
  dungeon: Dungeon | undefined,
  tier: DungeonTier,
): boolean {
  return Boolean(
    dungeon && ((dungeon.maxClearedTier ?? 0) > tier || (tier === 0 && dungeon.cleared === true)),
  )
}
