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

  it('Lv2以降は1.2倍ずつ増える', () => {
    expect(calculateHealingCost(createGoblin(2))).toBe(6)
    expect(calculateHealingCost(createGoblin(3))).toBe(8)
  })

  it('亜種ゴブリンは1.2倍の治療費になる', () => {
    expect(calculateHealingCost(createGoblin(1, 'ウルフゴブリン'))).toBe(6)
  })
})
