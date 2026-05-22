import type { ExpeditionReplay } from '../../types'
import { getMaxClearedFloorFromReplay } from '../expeditionClear'

const baseReplay = (events: ExpeditionReplay['events']): ExpeditionReplay => ({
  meta: {
    expeditionId: 'test',
    areaId: 'test_area',
    areaName: 'テスト',
    floors: 3,
    baseDurationSec: 300,
    party: ['1'],
    partyRewardMultipliers: { gold: 1, rare: 1, title: 1 },
    returnPolicy: 'never',
    seed: 1,
  },
  durationSec: 300,
  events,
  summary: {
    success: true,
    maxFloorReached: 1,
    xpGained: 0,
    goldGained: 0,
    casualties: [],
  },
})

describe('getMaxClearedFloorFromReplay', () => {
  it('階末戦に勝って目標フロア帰還したフロアをクリア扱いにする', () => {
    const replay = baseReplay([
      { type: 'move_start', at: 0, floor: 1 },
      { type: 'floor_end', at: 100, floor: 1 },
      {
        type: 'battle',
        at: 100,
        floor: 1,
        enemy: { id: 'e1', name: '敵', lvl: 1, count: 1, gold: 0 },
        combat: { rounds: 1, outcome: 'win', allyHPDelta: [0], enemyDefeated: 1 },
        xp: 1,
      },
      { type: 'return', at: 100, reason: 'policy_return' },
    ])

    expect(getMaxClearedFloorFromReplay(replay)).toBe(1)
  })

  it('階末戦で敗北したフロアはクリア扱いにしない', () => {
    const replay = baseReplay([
      { type: 'move_start', at: 0, floor: 1 },
      { type: 'floor_end', at: 100, floor: 1 },
      {
        type: 'battle',
        at: 100,
        floor: 1,
        enemy: { id: 'e1', name: '敵', lvl: 1, count: 1, gold: 0 },
        combat: { rounds: 1, outcome: 'lose', allyHPDelta: [-10], enemyDefeated: 0 },
        xp: 0,
      },
      { type: 'return', at: 100, reason: 'defeated' },
    ])

    expect(getMaxClearedFloorFromReplay(replay)).toBe(0)
  })

  it('踏破時は全フロアをクリア扱いにする', () => {
    const replay = baseReplay([
      { type: 'move_start', at: 0, floor: 1 },
      { type: 'return', at: 300, reason: 'completed' },
    ])

    expect(getMaxClearedFloorFromReplay(replay)).toBe(3)
  })
})
