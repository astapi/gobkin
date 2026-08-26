import {
  GOBLIN_BIRTH_DURATION_MS,
  calculateBirthPlusValue,
  collectBirthSourceFactorIds,
  createGoblinBirthSourceSnapshot,
  getMaxGoblinBirthSlots,
  hasGoblinBirthSourceConflict,
  selectRandomBirthPartner,
} from '../GoblinBirthCycleSystem'
import type { Goblin, GoblinBirthSlot } from '../../../shared/types'

const createGoblin = (id: number, plusValue: number, factors: string[] = []): Goblin => ({
  id,
  name: `ゴブリン${id}`,
  race: 'ゴブリン',
  raceId: 'goblin',
  level: 1,
  experience: 0,
  avatar: '',
  stats: { hp: 1, atk: 1, magicAtk: 1, def: 1, magicDef: 1, attackCount: 1, accuracy: 1, evasion: 1, magicHeal: 1, criticalRate: 0 },
  skills: [],
  factors,
  plusValue,
})

describe('GoblinBirthCycleSystem', () => {
  it('誕生間隔は10分', () => {
    expect(GOBLIN_BIRTH_DURATION_MS).toBe(10 * 60 * 1000)
  })

  it('拠点ランクと同じ数の誕生枠を返す', () => {
    expect(getMaxGoblinBirthSlots(1)).toBe(1)
    expect(getMaxGoblinBirthSlots(7)).toBe(7)
  })

  it('2体の大きい＋値に1を加える', () => {
    const snapshots = [
      createGoblinBirthSourceSnapshot(createGoblin(1, 20)),
      createGoblinBirthSourceSnapshot(createGoblin(2, 31)),
    ]
    expect(calculateBirthPlusValue(snapshots)).toBe(32)
  })

  it('マルク単独ならマルクの＋値に1を加える', () => {
    expect(calculateBirthPlusValue([])).toBe(1)
    expect(calculateBirthPlusValue([{ goblinId: 0, plusValue: 7, factors: [] }])).toBe(8)
  })

  it('設定個体の因子を重複なしで収集する', () => {
    const snapshots = [
      createGoblinBirthSourceSnapshot(createGoblin(1, 10, ['slime', 'wolf'])),
      createGoblinBirthSourceSnapshot(createGoblin(2, 20, ['slime', 'orc'])),
    ]
    expect(collectBirthSourceFactorIds(snapshots)).toEqual(['slime', 'wolf', 'orc'])
  })

  it('別の誕生枠に設定済みのゴブリンを検出する', () => {
    const slots: GoblinBirthSlot[] = [
      { slotIndex: 1, sourceGoblinId: 1, isActive: false, sourceSnapshots: [] },
      { slotIndex: 2, sourceGoblinId: 3, isActive: true, sourceSnapshots: [] },
    ]

    expect(hasGoblinBirthSourceConflict(slots, 2, [1, 5])).toBe(true)
    expect(hasGoblinBirthSourceConflict(slots, 2, [3, 5])).toBe(false)
    expect(hasGoblinBirthSourceConflict(slots, 3, [5, 6])).toBe(false)
  })

  it('継承元を除いた拠点メンバーからランダム選出する', () => {
    const goblins = [createGoblin(0, 0), createGoblin(1, 3), createGoblin(2, 7)]
    expect(selectRandomBirthPartner(goblins, 0, () => 0)?.id).toBe(1)
    expect(selectRandomBirthPartner(goblins, 0, () => 0.999)?.id).toBe(2)
    expect(selectRandomBirthPartner([goblins[0]], 0, () => 0)).toBeUndefined()
  })
})
