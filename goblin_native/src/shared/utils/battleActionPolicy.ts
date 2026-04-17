import type { BattleActionPolicy } from '../types'

export const DEFAULT_BATTLE_ACTION_POLICY: BattleActionPolicy = {
  attackRate: 100,
  clericMagicRate: 100,
  mageMagicRate: 100,
}

function normalizeRate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 100
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function normalizeBattleActionPolicy(
  policy?: Partial<BattleActionPolicy> | null,
): BattleActionPolicy {
  return {
    attackRate: normalizeRate(policy?.attackRate),
    clericMagicRate: normalizeRate(policy?.clericMagicRate),
    mageMagicRate: normalizeRate(policy?.mageMagicRate),
  }
}

export function shouldRunRate(rate: number, rng: () => number): boolean {
  const normalizedRate = normalizeRate(rate)
  if (normalizedRate >= 100) return true
  if (normalizedRate <= 0) return false
  return rng() * 100 < normalizedRate
}
