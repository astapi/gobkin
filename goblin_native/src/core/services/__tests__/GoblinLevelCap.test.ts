import type { Goblin } from '../../../shared/types'
import {
  ABSOLUTE_GOBLIN_MAX_LEVEL,
  getGoblinMaxLevel,
  PURE_GOBLIN_BASE_MAX_LEVEL,
  PURE_GOBLIN_LEVELS_PER_PLUS,
} from '../GoblinLevelCap'

function createGoblin(overrides: Partial<Goblin> = {}): Goblin {
  return {
    id: 1,
    name: 'テスト',
    race: 'ゴブリン',
    raceId: 'goblin',
    level: 1,
    experience: 0,
    avatar: '',
    stats: { hp: 1, atk: 1, magicAtk: 1, def: 1, magicDef: 1, attackCount: 1, accuracy: 1, evasion: 1, magicHeal: 1, criticalRate: 0 },
    skills: [],
    ...overrides,
  }
}

describe('GoblinLevelCap', () => {
  it('純ゴブリンは＋値に応じて最大レベルが伸びる', () => {
    expect(getGoblinMaxLevel(createGoblin({ plusValue: 0 }))).toBe(PURE_GOBLIN_BASE_MAX_LEVEL)
    expect(getGoblinMaxLevel(createGoblin({ plusValue: 5 }))).toBe(
      PURE_GOBLIN_BASE_MAX_LEVEL + 5 * PURE_GOBLIN_LEVELS_PER_PLUS,
    )
  })

  it('亜種とマルクは＋値にかかわらずLv200まで成長できる', () => {
    expect(getGoblinMaxLevel(createGoblin({ race: 'ウルフゴブリン', raceId: 'wolf' })))
      .toBe(ABSOLUTE_GOBLIN_MAX_LEVEL)
    expect(getGoblinMaxLevel(createGoblin({ race: '始祖ゴブリン', raceId: 'founder' })))
      .toBe(ABSOLUTE_GOBLIN_MAX_LEVEL)
  })

  it('移行前から計算上限を超えた個体のレベルは下げない', () => {
    expect(getGoblinMaxLevel(createGoblin({ level: 80, plusValue: 0 }))).toBe(80)
  })
})
