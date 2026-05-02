import { calculateEnemyExp, getRaceExpCoefficient } from '../enemyExp'

describe('getRaceExpCoefficient', () => {
  it('魔獣系 (beast) は 1.0 を返す', () => {
    expect(getRaceExpCoefficient(['orc'])).toBe(1.0)
    expect(getRaceExpCoefficient(['wolf'])).toBe(1.0)
    expect(getRaceExpCoefficient(['slime'])).toBe(1.0)
  })

  it('人間系 (human) は 1.15 を返す (implies 経由を含む)', () => {
    expect(getRaceExpCoefficient(['human'])).toBe(1.15)
    expect(getRaceExpCoefficient(['dwarf'])).toBe(1.15)
    expect(getRaceExpCoefficient(['elf'])).toBe(1.15)
    expect(getRaceExpCoefficient(['hobbit'])).toBe(1.15)
  })

  it('構築物 (construct) は 1.2 を返す', () => {
    expect(getRaceExpCoefficient(['construct'])).toBe(1.2)
  })

  it('未定義 / 中立種族はデフォルトの 1.0 を返す', () => {
    expect(getRaceExpCoefficient(['dragon'])).toBe(1.0)
    expect(getRaceExpCoefficient(['undead'])).toBe(1.0)
    expect(getRaceExpCoefficient(['demon_race'])).toBe(1.0)
  })

  it('複数タグでは最大係数を採用する', () => {
    expect(getRaceExpCoefficient(['orc', 'human'])).toBe(1.15)
  })
})

describe('calculateEnemyExp', () => {
  it('魔獣の通常戦闘は Lv * 3 * 1.0', () => {
    expect(calculateEnemyExp(10, ['orc'], false)).toBe(30)
    expect(calculateEnemyExp(20, ['slime'], false)).toBe(60)
  })

  it('人間の通常戦闘は Lv * 3 * 1.15', () => {
    expect(calculateEnemyExp(10, ['human'], false)).toBe(35) // 34.5 → 35
    expect(calculateEnemyExp(20, ['dwarf'], false)).toBe(69) // 69
  })

  it('ボス係数 1.5 を乗算する', () => {
    expect(calculateEnemyExp(10, ['orc'], true)).toBe(45) // 30*1.5
    expect(calculateEnemyExp(10, ['human'], true)).toBe(52) // 34.5*1.5 = 51.75 → 52
  })
})
