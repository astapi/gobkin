import { calculateEnemyBaseHp } from '../enemyStats'

describe('enemyStats', () => {
  it('human係数と体力から敵HPを計算する', () => {
    expect(calculateEnemyBaseHp({ level: 30, raceTags: ['human'], vitality: 18 })).toBe(760)
    expect(calculateEnemyBaseHp({ level: 30, raceTags: ['human'], vitality: 14 })).toBe(590)
    expect(calculateEnemyBaseHp({ level: 40, raceTags: ['human'], vitality: 22 })).toBe(1370)
  })

  it('体力未設定ならHP計算をスキップする', () => {
    expect(calculateEnemyBaseHp({ level: 30, raceTags: ['human'] })).toBeNull()
  })
})
