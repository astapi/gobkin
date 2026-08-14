import type { Dungeon, DungeonTier, Party } from '../types'

export const AUTO_EXPEDITION_DAILY_LIMIT_SEC = 8 * 60 * 60

export interface AutoExpeditionUsage {
  date: string
  usedSec: number
  remainingSec: number
}

export interface AutoExpeditionReservation {
  startTime: Date
  date: string
  usedSec: number
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getNextLocalDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
}

/** 日次上限到達後に自動周回を再開できる、次のローカル日付の0時を返す。 */
export function getAutoExpeditionResumeAt(party: Party): Date | null {
  if (
    !party.autoExpeditionDate ||
    Math.max(0, Math.floor(party.autoExpeditionUsedSec ?? 0)) < AUTO_EXPEDITION_DAILY_LIMIT_SEC
  ) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(party.autoExpeditionDate)
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const day = new Date(Number(yearText), Number(monthText) - 1, Number(dayText))
  if (getLocalDateKey(day) !== party.autoExpeditionDate) return null
  return getNextLocalDayStart(day)
}

function canResumeAutoExpedition(party: Party): boolean {
  return Boolean(
    party.autoExpeditionEnabled &&
    (party.status ?? 'idle') === 'idle' &&
    (party.autoExpeditionSummary?.runCount ?? 0) > 0,
  )
}

export function isAutoExpeditionWaiting(party: Party, now: Date): boolean {
  const resumeAt = getAutoExpeditionResumeAt(party)
  return canResumeAutoExpedition(party) && resumeAt !== null && resumeAt > now
}

export function isAutoExpeditionResumeDue(party: Party, now: Date): boolean {
  const resumeAt = getAutoExpeditionResumeAt(party)
  return canResumeAutoExpedition(party) && resumeAt !== null && resumeAt <= now
}

export function getAutoExpeditionUsage(party: Party, date: Date): AutoExpeditionUsage {
  const dateKey = getLocalDateKey(date)
  const usedSec = party.autoExpeditionDate === dateKey
    ? Math.max(0, Math.floor(party.autoExpeditionUsedSec ?? 0))
    : 0

  return {
    date: dateKey,
    usedSec,
    remainingSec: Math.max(0, AUTO_EXPEDITION_DAILY_LIMIT_SEC - usedSec),
  }
}

export function isAutoExpeditionDungeonCleared(
  dungeon: Dungeon | undefined,
  tier: DungeonTier,
): boolean {
  return Boolean(
    dungeon && ((dungeon.maxClearedTier ?? 0) > tier || (tier === 0 && dungeon.cleared === true)),
  )
}

export function planAutoExpedition(
  party: Party,
  preferredStartTime: Date,
  durationSec: number,
): AutoExpeditionReservation | null {
  if (durationSec <= 0 || durationSec > AUTO_EXPEDITION_DAILY_LIMIT_SEC) return null

  let startTime = preferredStartTime
  let usage = getAutoExpeditionUsage(party, startTime)
  // 開始時点で8時間未満なら、その周が上限をまたいでも帰還まで継続する。
  if (usage.usedSec >= AUTO_EXPEDITION_DAILY_LIMIT_SEC) {
    startTime = getNextLocalDayStart(startTime)
    usage = getAutoExpeditionUsage(party, startTime)
  }

  return {
    startTime,
    date: usage.date,
    usedSec: usage.usedSec + durationSec,
  }
}
