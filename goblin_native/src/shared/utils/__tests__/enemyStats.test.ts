import {
  calculateEnemyBaseEvasionFromInputs,
  calculateEnemyBaseHpFromInputs,
} from '../enemyStats'

describe('enemyStats', () => {
  it('敵回避はレベルに応じて命中成長へ追従する', () => {
    const level18 = calculateEnemyBaseEvasionFromInputs(18, 8, 4, 'human')
    const level25 = calculateEnemyBaseEvasionFromInputs(25, 18, 8, 'beast')

    expect(level18).toBe(54)
    expect(level25).toBe(104)
  })

  it('序盤の敵回避は過剰に上がらない', () => {
    expect(calculateEnemyBaseEvasionFromInputs(1, 10, 10, 'human')).toBe(13)
  })

  it('敵HPも味方と同じく体力がレベルで最大+10まで成長する', () => {
    expect(calculateEnemyBaseHpFromInputs(1, 10, 'human')).toBe(20)
    expect(calculateEnemyBaseHpFromInputs(5, 10, 'human')).toBe(90)
    expect(calculateEnemyBaseHpFromInputs(25, 10, 'human')).toBe(520)
  })
})
