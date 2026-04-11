import type { Goblin } from '../types'
import { normalizeGoblinRaceId } from '../types/Race'

const BASE_HEALING_COST = 5
const LEVEL_COST_SCALE = 1.2
const VARIANT_COST_MULTIPLIER = 1.2

export function isInjuredGoblin(goblin: Goblin): boolean {
  return goblin.currentHp === 0
}

export function calculateHealingCost(goblin: Goblin): number {
  const level = Math.max(1, Math.floor(goblin.level))
  const levelScaledCost = BASE_HEALING_COST * Math.pow(LEVEL_COST_SCALE, level - 1)
  const raceId = normalizeGoblinRaceId(goblin.raceId ?? goblin.race)
  const variantMultiplier = raceId === 'goblin' ? 1 : VARIANT_COST_MULTIPLIER
  return Math.ceil(levelScaledCost * variantMultiplier)
}
