import { calculateEnemyBaseHp, calculateEnemyBaseHpFromInputs } from '../enemyStats'

describe('enemyStats', () => {
  it('種族係数と体力から敵HPを計算する', () => {
    expect(calculateEnemyBaseHp({
      level: 30,
      raceTags: ['human'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 18, agility: 10, luck: 10 },
    })).toBe(560)
    expect(calculateEnemyBaseHp({
      level: 30,
      raceTags: ['human'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 14, agility: 10, luck: 10 },
    })).toBe(440)
    expect(calculateEnemyBaseHp({
      level: 40,
      raceTags: ['human'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 22, agility: 10, luck: 10 },
    })).toBe(1010)
  })

  it('明示した種族でHPを計算できる', () => {
    expect(calculateEnemyBaseHpFromInputs(20, 12, 'goblin')).toBe(210)
    expect(calculateEnemyBaseHpFromInputs(20, 12, 'beast')).toBe(280)
    expect(calculateEnemyBaseHpFromInputs(20, 12, 'human')).toBe(250)
    expect(calculateEnemyBaseHpFromInputs(20, 12, 'demon_race')).toBe(330)
  })
})
