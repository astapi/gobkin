import {
  calculateEnemyBaseAccuracy,
  calculateEnemyBaseAccuracyFromInputs,
  calculateEnemyBaseAtk,
  calculateEnemyBaseAtkFromInputs,
  calculateEnemyBaseDef,
  calculateEnemyBaseDefFromInputs,
  calculateEnemyBaseEvasion,
  calculateEnemyBaseEvasionFromInputs,
  calculateEnemyBaseHp,
  calculateEnemyBaseHpFromInputs,
} from '../enemyStats'

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

  it('種族係数と体力から敵DEFを計算する', () => {
    expect(calculateEnemyBaseDef({
      level: 30,
      raceTags: ['human'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 18, agility: 10, luck: 10 },
    })).toBe(72)
    expect(calculateEnemyBaseDef({
      level: 25,
      raceTags: ['minotaur'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 14, agility: 10, luck: 10 },
    })).toBe(53)
  })

  it('明示した種族でDEFを計算できる', () => {
    expect(calculateEnemyBaseDefFromInputs(20, 12, 'goblin')).toBe(31)
    expect(calculateEnemyBaseDefFromInputs(20, 12, 'beast')).toBe(38)
    expect(calculateEnemyBaseDefFromInputs(20, 12, 'human')).toBe(36)
    expect(calculateEnemyBaseDefFromInputs(20, 12, 'demon_race')).toBe(43)
  })

  it('種族係数と敏捷/幸運から敵回避を計算する', () => {
    expect(calculateEnemyBaseEvasion({
      level: 30,
      raceTags: ['human'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
    })).toBe(40)
    expect(calculateEnemyBaseEvasion({
      level: 25,
      raceTags: ['minotaur'],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 8, luck: 6 },
    })).toBe(26)
  })

  it('明示した種族で回避を計算できる', () => {
    expect(calculateEnemyBaseEvasionFromInputs(20, 12, 8, 'goblin')).toBe(26)
    expect(calculateEnemyBaseEvasionFromInputs(20, 12, 8, 'beast')).toBe(32)
    expect(calculateEnemyBaseEvasionFromInputs(20, 12, 8, 'human')).toBe(30)
    expect(calculateEnemyBaseEvasionFromInputs(20, 12, 8, 'demon_race')).toBe(36)
  })

  it('種族係数と力から敵ATKを計算する', () => {
    expect(calculateEnemyBaseAtk({
      level: 30,
      raceTags: ['human'],
      baseAttributes: { power: 18, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
    })).toBe(72)
    expect(calculateEnemyBaseAtk({
      level: 25,
      raceTags: ['minotaur'],
      baseAttributes: { power: 15, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
    })).toBe(56)
  })

  it('明示した種族でATKを計算できる', () => {
    expect(calculateEnemyBaseAtkFromInputs(20, 14, 'goblin')).toBe(36)
    expect(calculateEnemyBaseAtkFromInputs(20, 14, 'beast')).toBe(45)
    expect(calculateEnemyBaseAtkFromInputs(20, 14, 'human')).toBe(42)
    expect(calculateEnemyBaseAtkFromInputs(20, 14, 'demon_race')).toBe(50)
  })

  it('種族係数と力/敏捷から敵命中を計算する', () => {
    expect(calculateEnemyBaseAccuracy({
      level: 30,
      raceTags: ['human'],
      baseAttributes: { power: 18, wisdom: 10, spirit: 10, vitality: 10, agility: 12, luck: 10 },
    })).toBe(155)
    expect(calculateEnemyBaseAccuracy({
      level: 25,
      raceTags: ['minotaur'],
      baseAttributes: { power: 15, wisdom: 10, spirit: 10, vitality: 10, agility: 8, luck: 10 },
    })).toBe(125)
  })

  it('明示した種族で命中を計算できる', () => {
    expect(calculateEnemyBaseAccuracyFromInputs(20, 14, 10, 'goblin')).toBe(100)
    expect(calculateEnemyBaseAccuracyFromInputs(20, 14, 10, 'beast')).toBe(115)
    expect(calculateEnemyBaseAccuracyFromInputs(20, 14, 10, 'human')).toBe(110)
    expect(calculateEnemyBaseAccuracyFromInputs(20, 14, 10, 'demon_race')).toBe(124)
  })
})
