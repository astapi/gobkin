import { calculateHealingCost } from '../healing'
import type { Goblin } from '../../types'

function createGoblin(level: number, race = 'ゴブリン'): Goblin {
  return {
    id: 1,
    name: 'テスト',
    race,
    level,
    experience: 0,
    avatar: 'test.png',
    stats: { hp: 10, atk: 1, magicAtk: 0, def: 1, magicDef: 0, attackCount: 1, accuracy: 1, evasion: 1, magicHeal: 1, criticalRate: 0 },
    skills: [],
  }
}

describe('calculateHealingCost', () => {
  it('Lv1の基本治療費は5G', () => {
    expect(calculateHealingCost(createGoblin(1))).toBe(5)
  })

  it('低レベル帯は二次関数で緩やかに増える', () => {
    expect(calculateHealingCost(createGoblin(2))).toBe(10)
    expect(calculateHealingCost(createGoblin(5))).toBe(63)
    expect(calculateHealingCost(createGoblin(10))).toBe(250)
  })

  it('高レベル帯は参考値に近い値になる', () => {
    expect(calculateHealingCost(createGoblin(50))).toBe(6250)
    expect(calculateHealingCost(createGoblin(130))).toBe(42250)
    expect(calculateHealingCost(createGoblin(135))).toBe(45563)
  })

  it('亜種ゴブリンは1.2倍の治療費になる', () => {
    expect(calculateHealingCost(createGoblin(1, 'ウルフゴブリン'))).toBe(6)
  })
})
