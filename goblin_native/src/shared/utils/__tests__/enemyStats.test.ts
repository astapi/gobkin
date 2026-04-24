import { calculateEnemyBaseHp } from '../enemyStats'

describe('enemyStats', () => {
  it('human係数と体力から敵HPを計算する', () => {
    expect(calculateEnemyBaseHp({
      level: 30,
      raceTags: ['human'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 18, agility: 10, luck: 10 },
    })).toBe(760)
    expect(calculateEnemyBaseHp({
      level: 30,
      raceTags: ['human'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 14, agility: 10, luck: 10 },
    })).toBe(590)
    expect(calculateEnemyBaseHp({
      level: 40,
      raceTags: ['human'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 22, agility: 10, luck: 10 },
    })).toBe(1370)
  })
})
