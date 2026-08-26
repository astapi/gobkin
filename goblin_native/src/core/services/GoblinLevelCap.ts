import type { Goblin } from '../../shared/types'
import { normalizeGoblinRaceId } from '../../shared/types/Race'

export const ABSOLUTE_GOBLIN_MAX_LEVEL = 200
export const PURE_GOBLIN_BASE_MAX_LEVEL = 50
export const PURE_GOBLIN_LEVELS_PER_PLUS = 3

/** 純ゴブリンだけ＋値で最大レベルが伸びる。亜種と始祖は従来どおりLv200。 */
export function getGoblinMaxLevel(goblin: Pick<Goblin, 'race' | 'raceId' | 'level' | 'plusValue'>): number {
  if (normalizeGoblinRaceId(goblin.raceId ?? goblin.race) !== 'goblin') {
    return ABSOLUTE_GOBLIN_MAX_LEVEL
  }
  const plusValue = Math.max(0, Math.floor(goblin.plusValue ?? 0))
  const calculatedCap = Math.min(
    ABSOLUTE_GOBLIN_MAX_LEVEL,
    PURE_GOBLIN_BASE_MAX_LEVEL + plusValue * PURE_GOBLIN_LEVELS_PER_PLUS,
  )
  // 移行前から上限を超えている個体のレベルを巻き戻さない。
  return Math.max(Math.floor(goblin.level), calculatedCap)
}
