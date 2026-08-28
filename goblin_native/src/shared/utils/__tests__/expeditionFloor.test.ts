import { computeCurrentFloor } from '../expeditionFloor'
import type { ExpeditionRecord, ExpeditionReplay, TimelineEvent } from '../../types'

function createReplay(events: TimelineEvent[], durationSec = 600, maxFloorReached = 3): ExpeditionReplay {
  return {
    meta: {
      expeditionId: 'r1',
      areaId: 'test_area',
      areaName: 'テスト',
      floors: 3,
      baseDurationSec: 600,
      party: ['1'],
      partyRewardMultipliers: { gold: 1, rareDrop: 1, title: 1 } as never,
      returnPolicy: 'never',
      seed: 1,
    },
    durationSec,
    events,
    summary: {
      success: true,
      maxFloorReached,
      xpGained: 0,
      goldGained: 0,
      casualties: [],
    },
  }
}

function createRecord(replay: ExpeditionReplay | undefined, startTime: Date, returnTime: Date | null): ExpeditionRecord {
  return {
    id: 'r1',
    userId: 'u1',
    partyId: 1,
    partyName: 'PT',
    dungeonId: 'test_area',
    dungeonName: 'テスト',
    startTime,
    returnTime,
    status: 'ongoing',
    returnPolicy: 'never',
    replay,
    createdAt: startTime,
    updatedAt: startTime,
  }
}

const start = new Date('2026-05-11T12:00:00Z')
const ret = new Date('2026-05-11T12:10:00Z') // 600秒

describe('computeCurrentFloor', () => {
  it('replay が無ければ 1F を返す', () => {
    const record = createRecord(undefined, start, ret)
    expect(computeCurrentFloor(record, start)).toBe(1)
  })

  it('returnTime が null なら 1F を返す', () => {
    const replay = createReplay([{ type: 'floor_up', at: 10, from: 1, to: 2 }])
    const record = createRecord(replay, start, null)
    expect(computeCurrentFloor(record, start)).toBe(1)
  })

  it('開始直後は 1F を返す（イベント未到達）', () => {
    const replay = createReplay([
      { type: 'move_start', at: 0, floor: 1 },
      { type: 'floor_up', at: 200, from: 1, to: 2 },
      { type: 'floor_up', at: 400, from: 2, to: 3 },
    ])
    const record = createRecord(replay, start, ret)
    expect(computeCurrentFloor(record, start)).toBe(1)
  })

  it('経過時間が floor_up の at を越えたら次の階を返す', () => {
    const replay = createReplay([
      { type: 'move_start', at: 0, floor: 1 },
      { type: 'floor_up', at: 200, from: 1, to: 2 },
      { type: 'floor_up', at: 400, from: 2, to: 3 },
    ])
    const record = createRecord(replay, start, ret)
    // 経過時間 5分 (300s) -> cutoff 300 -> 2F
    const now = new Date(start.getTime() + 5 * 60 * 1000)
    expect(computeCurrentFloor(record, now)).toBe(2)
  })

  it('帰還時刻に到達したら最終階層を返す', () => {
    const replay = createReplay([
      { type: 'move_start', at: 0, floor: 1 },
      { type: 'floor_up', at: 200, from: 1, to: 2 },
      { type: 'floor_up', at: 400, from: 2, to: 3 },
    ])
    const record = createRecord(replay, start, ret)
    expect(computeCurrentFloor(record, ret)).toBe(3)
  })

  it('battle / exploring / treasure の floor も反映する', () => {
    const replay = createReplay([
      { type: 'move_start', at: 0, floor: 1 },
      { type: 'exploring', at: 100, floor: 1 },
      { type: 'floor_up', at: 200, from: 1, to: 2 },
      { type: 'battle', at: 250, floor: 2, enemy: { id: 'e', name: 'e', stats: {} as never, gold: 0 } as never, combat: {} as never, xp: 0 },
      { type: 'treasure', at: 350, floor: 2, items: [] },
    ])
    const record = createRecord(replay, start, ret)
    // 4分 (240s) -> 2F (floor_up at 200 が反映)
    expect(computeCurrentFloor(record, new Date(start.getTime() + 4 * 60 * 1000))).toBe(2)
  })

  it('totalMs が 0 以下なら 1F を返す', () => {
    const replay = createReplay([{ type: 'floor_up', at: 0, from: 1, to: 2 }])
    const record = createRecord(replay, start, start) // returnTime === startTime
    expect(computeCurrentFloor(record, start)).toBe(1)
  })
})
