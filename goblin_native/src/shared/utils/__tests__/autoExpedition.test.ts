import type { Dungeon, Party } from '../../types'
import {
  AUTO_EXPEDITION_DAILY_LIMIT_SEC,
  getAutoExpeditionResumeAt,
  getAutoExpeditionUsage,
  getLocalDateKey,
  getNextLocalDayStart,
  isAutoExpeditionDungeonCleared,
  isAutoExpeditionResumeDue,
  isAutoExpeditionWaiting,
  planAutoExpedition,
} from '../autoExpedition'

const party: Party = {
  id: 1,
  name: 'PT1',
  memberIds: [1],
  autoExpeditionDate: '2026-08-12',
  autoExpeditionUsedSec: 3600,
}

describe('autoExpedition', () => {
  it('同じローカル日付の使用量から残り時間を計算する', () => {
    const usage = getAutoExpeditionUsage(party, new Date(2026, 7, 12, 10))

    expect(usage).toEqual({
      date: '2026-08-12',
      usedSec: 3600,
      remainingSec: AUTO_EXPEDITION_DAILY_LIMIT_SEC - 3600,
    })
  })

  it('日付が変わると使用量をリセットする', () => {
    expect(getAutoExpeditionUsage(party, new Date(2026, 7, 13, 0)).usedSec).toBe(0)
  })

  it('翌日のローカル0時を返す', () => {
    const next = getNextLocalDayStart(new Date(2026, 7, 12, 23, 59, 59))

    expect(getLocalDateKey(next)).toBe('2026-08-13')
    expect(next.getHours()).toBe(0)
    expect(next.getMinutes()).toBe(0)
  })

  it('選択ティアまでクリア済みの場合だけ自動周回を許可する', () => {
    const dungeon = { maxClearedTier: 1 } as Dungeon

    expect(isAutoExpeditionDungeonCleared(dungeon, 0)).toBe(true)
    expect(isAutoExpeditionDungeonCleared(dungeon, 1)).toBe(false)
    expect(isAutoExpeditionDungeonCleared({ cleared: true } as Dungeon, 0)).toBe(true)
    expect(isAutoExpeditionDungeonCleared(undefined, 0)).toBe(false)
  })

  it('残り時間に収まる周回を同日に予約する', () => {
    const reservation = planAutoExpedition(party, new Date(2026, 7, 12, 12), 7200)

    expect(reservation?.date).toBe('2026-08-12')
    expect(reservation?.usedSec).toBe(10800)
    expect(reservation?.startTime.getHours()).toBe(12)
  })

  it('開始時点で上限未満なら、その周が8時間を超えても同日に開始する', () => {
    const nearlyFullParty = {
      ...party,
      autoExpeditionUsedSec: AUTO_EXPEDITION_DAILY_LIMIT_SEC - 1800,
    }
    const reservation = planAutoExpedition(nearlyFullParty, new Date(2026, 7, 12, 20), 3600)

    expect(reservation?.date).toBe('2026-08-12')
    expect(reservation?.usedSec).toBe(AUTO_EXPEDITION_DAILY_LIMIT_SEC + 1800)
    expect(reservation?.startTime.getHours()).toBe(20)
  })

  it('開始時点ですでに8時間へ到達していたら翌日0時へ送る', () => {
    const fullParty = {
      ...party,
      autoExpeditionUsedSec: AUTO_EXPEDITION_DAILY_LIMIT_SEC,
    }
    const reservation = planAutoExpedition(fullParty, new Date(2026, 7, 12, 20), 3600)

    expect(reservation?.date).toBe('2026-08-13')
    expect(reservation?.usedSec).toBe(3600)
    expect(reservation?.startTime.getHours()).toBe(0)
  })

  it('上限到達日の翌日0時を再開時刻として返す', () => {
    expect(getAutoExpeditionResumeAt({
      ...party,
      autoExpeditionUsedSec: AUTO_EXPEDITION_DAILY_LIMIT_SEC + 1800,
    })).toEqual(new Date(2026, 7, 13, 0, 0, 0, 0))
  })

  it('上限未到達または日付が不正なら再開時刻を返さない', () => {
    expect(getAutoExpeditionResumeAt(party)).toBeNull()
    expect(getAutoExpeditionResumeAt({
      ...party,
      autoExpeditionDate: 'invalid',
      autoExpeditionUsedSec: AUTO_EXPEDITION_DAILY_LIMIT_SEC,
    })).toBeNull()
  })

  it('上限到達後は翌日0時まで停止中となり、0時以降は再開対象になる', () => {
    const waitingParty: Party = {
      ...party,
      status: 'idle',
      autoExpeditionEnabled: true,
      autoExpeditionUsedSec: AUTO_EXPEDITION_DAILY_LIMIT_SEC,
      autoExpeditionSummary: {
        sessionId: 'session-a',
        runCount: 2,
        xpGained: 10,
        goldGained: 10,
        rewardItems: [],
        factorCount: 0,
        levelUps: [],
      },
    }

    expect(isAutoExpeditionWaiting(waitingParty, new Date(2026, 7, 12, 23, 59))).toBe(true)
    expect(isAutoExpeditionResumeDue(waitingParty, new Date(2026, 7, 12, 23, 59))).toBe(false)
    expect(isAutoExpeditionWaiting(waitingParty, new Date(2026, 7, 13, 0, 0))).toBe(false)
    expect(isAutoExpeditionResumeDue(waitingParty, new Date(2026, 7, 13, 0, 0))).toBe(true)
  })

  it('初回の手動遠征前と進行中は停止中・再開対象にしない', () => {
    const firstRunParty: Party = {
      ...party,
      autoExpeditionEnabled: true,
      autoExpeditionUsedSec: AUTO_EXPEDITION_DAILY_LIMIT_SEC,
      autoExpeditionSummary: {
        sessionId: 'session-a',
        runCount: 0,
        xpGained: 0,
        goldGained: 0,
        rewardItems: [],
        factorCount: 0,
        levelUps: [],
      },
    }

    expect(isAutoExpeditionWaiting(firstRunParty, new Date(2026, 7, 12, 20))).toBe(false)
    expect(isAutoExpeditionResumeDue({
      ...firstRunParty,
      status: 'expedition',
      autoExpeditionSummary: { ...firstRunParty.autoExpeditionSummary!, runCount: 1 },
    }, new Date(2026, 7, 13, 0))).toBe(false)
  })

  it('1周が8時間を超える場合は予約しない', () => {
    expect(planAutoExpedition(
      party,
      new Date(2026, 7, 12, 12),
      AUTO_EXPEDITION_DAILY_LIMIT_SEC + 1,
    )).toBeNull()
  })
})
