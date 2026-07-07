import type { Goblin } from '../../../shared/types'
import { GoblinEntity } from '../../domain'
import { GoblinStatCalculator } from '../GoblinStatCalculator'
import { getExpForNextLevel } from '../ExperienceSystem'

function createPlainGoblin(overrides: Partial<Goblin> = {}): Goblin {
  return {
    id: 1,
    name: 'テストゴブリン',
    race: 'ゴブリン',
    level: 1,
    experience: 0,
    avatar: '/test.png',
    stats: { hp: 60, atk: 12, magicAtk: 5, def: 10, magicDef: 4, attackCount: 2, accuracy: 20, evasion: 15, magicHeal: 10, criticalRate: 0 },
    skills: [],
    factors: [],
    ...overrides,
  }
}

describe('GoblinEntity レベルアップ時の派生ステータス再計算', () => {
  it('レベルアップ後の全派生ステータスが GoblinStatCalculator.calculate と一致する', () => {
    const entity = new GoblinEntity(createPlainGoblin())

    // 数レベル分の経験値を付与してレベルアップさせる
    const expToGain = getExpForNextLevel(1) + getExpForNextLevel(2) + getExpForNextLevel(3) + 10
    const result = entity.gainExperience(expToGain)
    expect(result.didLevelUp).toBe(true)
    expect(result.newLevel).toBeGreaterThan(1)

    const snapshot = entity.toSnapshot()
    const expected = GoblinStatCalculator.calculate(snapshot)

    // magicAtk / magicDef / criticalRate を含む全キーが再計算されて一致する
    expect(snapshot.stats.hp).toBe(expected.hp)
    expect(snapshot.stats.atk).toBe(expected.atk)
    expect(snapshot.stats.magicAtk).toBe(expected.magicAtk)
    expect(snapshot.stats.def).toBe(expected.def)
    expect(snapshot.stats.magicDef).toBe(expected.magicDef)
    expect(snapshot.stats.attackCount).toBe(expected.attackCount)
    expect(snapshot.stats.accuracy).toBe(expected.accuracy)
    expect(snapshot.stats.evasion).toBe(expected.evasion)
    expect(snapshot.stats.magicHeal).toBe(expected.magicHeal)
    expect(snapshot.stats.criticalRate).toBe(expected.criticalRate)
  })
})
