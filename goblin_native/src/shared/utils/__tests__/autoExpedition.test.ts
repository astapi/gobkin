import type { Dungeon, ExpeditionRecord, Party } from '../../types'
import {
  isAutoExpeditionDayBoundaryRun,
  isAutoExpeditionDungeonCleared,
  isAutoExpeditionRecord,
  isAutoExpeditionStopPending,
} from '../autoExpedition'

const party: Party = {
  id: 1,
  name: 'PT1',
  memberIds: [1],
}

function createExpeditionRecord(autoExpeditionSessionId?: string): ExpeditionRecord {
  return {
    id: 'exp-1',
    userId: '',
    partyId: 1,
    partyName: 'PT1',
    dungeonId: 'slime_cave',
    dungeonName: 'スライムの洞窟',
    startTime: new Date(2026, 7, 12, 10),
    returnTime: new Date(2026, 7, 12, 11),
    status: 'ongoing',
    returnPolicy: 'never',
    expeditionMeta: {
      seed: 1,
      request: {
        partyId: '1',
        areaId: 'slime_cave',
        returnPolicy: 'never',
        clientVersion: 'native',
        autoExpeditionSessionId,
      },
      departingGoblins: [],
      rewardMultipliers: { gold: 1, rare: 1, title: 1 },
    },
    createdAt: new Date(2026, 7, 12, 10),
    updatedAt: new Date(2026, 7, 12, 10),
  }
}

describe('autoExpedition', () => {
  it('選択ティアまでクリア済みの場合だけ自動周回を許可する', () => {
    const dungeon = { maxClearedTier: 1 } as Dungeon

    expect(isAutoExpeditionDungeonCleared(dungeon, 0)).toBe(true)
    expect(isAutoExpeditionDungeonCleared(dungeon, 1)).toBe(false)
    expect(isAutoExpeditionDungeonCleared({ cleared: true } as Dungeon, 0)).toBe(true)
    expect(isAutoExpeditionDungeonCleared(undefined, 0)).toBe(false)
  })

  it('同じローカル日付内で帰還する周回は継続対象にする', () => {
    const record = createExpeditionRecord('session-a')

    expect(isAutoExpeditionDayBoundaryRun(record)).toBe(false)
  })

  it('帰還予定時刻が翌日0時になる周回を最終周と判定する', () => {
    const record = createExpeditionRecord('session-a')
    record.startTime = new Date(2026, 7, 12, 23, 0)
    record.returnTime = new Date(2026, 7, 13, 0, 0)

    expect(isAutoExpeditionDayBoundaryRun(record)).toBe(true)
  })

  it('翌日までかかる長時間遠征も最終周と判定する', () => {
    const record = createExpeditionRecord('session-a')
    record.startTime = new Date(2026, 7, 12, 20, 0)
    record.returnTime = new Date(2026, 7, 14, 1, 0)

    expect(isAutoExpeditionDayBoundaryRun(record)).toBe(true)
  })

  it('通常遠征は日付をまたいでも自動周回の最終周にしない', () => {
    const record = createExpeditionRecord()
    record.startTime = new Date(2026, 7, 12, 23, 0)
    record.returnTime = new Date(2026, 7, 13, 0, 0)

    expect(isAutoExpeditionDayBoundaryRun(record)).toBe(false)
  })

  it('自動周回由来の遠征中にOFFへ変更した場合だけ停止待ちにする', () => {
    const stoppedParty: Party = {
      ...party,
      status: 'expedition',
      autoExpeditionEnabled: false,
      autoExpeditionSessionId: 'session-a',
    }

    expect(isAutoExpeditionStopPending(
      stoppedParty,
      createExpeditionRecord('session-a'),
    )).toBe(true)
  })

  it('過去の自動周回セッションIDが残っていても通常遠征は停止待ちにしない', () => {
    const manualExpeditionParty: Party = {
      ...party,
      status: 'expedition',
      autoExpeditionEnabled: false,
      autoExpeditionSessionId: 'session-a',
    }

    expect(isAutoExpeditionStopPending(
      manualExpeditionParty,
      createExpeditionRecord(),
    )).toBe(false)
  })

  it('自動周回セッションID付きの遠征を判定する', () => {
    expect(isAutoExpeditionRecord(createExpeditionRecord('session-a'))).toBe(true)
    expect(isAutoExpeditionRecord(createExpeditionRecord())).toBe(false)
  })

})
