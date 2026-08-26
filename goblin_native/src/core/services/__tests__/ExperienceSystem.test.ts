import { addExperience, getExpForNextLevel } from '../ExperienceSystem'

describe('ExperienceSystem', () => {
  it('参考ゲームの観測値に近い必要経験値を返す', () => {
    expect(getExpForNextLevel(1)).toBe(19)
    expect(getExpForNextLevel(11)).toBe(485)
    expect(getExpForNextLevel(23)).toBe(4427)
    expect(getExpForNextLevel(36)).toBe(22084)
    expect(getExpForNextLevel(45)).toBe(52209)
    expect(getExpForNextLevel(46)).toBe(56933)
  })

  it('レベル上限では次レベル経験値を0にする', () => {
    expect(getExpForNextLevel(200)).toBe(0)
    expect(getExpForNextLevel(50, 50)).toBe(0)
  })

  it('個体ごとの最大レベルを超えてレベルアップしない', () => {
    const result = addExperience(49, 0, 1_000_000, 50)
    expect(result.newLevel).toBe(50)
  })
})
