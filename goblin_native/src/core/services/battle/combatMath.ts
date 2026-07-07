import type { SpellDef } from '../../../shared/types/Spell'
import type { BattleUnit } from './types'

// 差5程度なら低敏捷側にも約10%の先行余地を持たせるため、広めの乗算乱数を使う
const ACTION_ORDER_RANDOM_MIN = 0.21
const ACTION_ORDER_RANDOM_MAX = 1.0

export function getActionOrderRandomFactor(rng: () => number): number {
  return ACTION_ORDER_RANDOM_MIN + rng() * (ACTION_ORDER_RANDOM_MAX - ACTION_ORDER_RANDOM_MIN)
}

export function getActionOrderValue(agility: number, actionOrderMultiplier: number, randomB: number): number {
  const normalizedAgility = Math.max(1, agility)
  return normalizedAgility * normalizedAgility * actionOrderMultiplier * randomB
}

/**
 * 攻撃回数に応じたダメージ補正
 * n<=2 → 1.0, n>=3 → 0.9^(n-2)
 */
export function getDamageModifier(attackNumber: number): number {
  if (attackNumber <= 2) return 1.0
  return Math.pow(0.9, attackNumber - 2)
}

/**
 * 攻撃回数に応じた命中精度補正
 * n=1 → 1.0, n>=2 → 0.6 × 0.9^(n-2)
 */
export function getAccuracyModifier(attackNumber: number): number {
  if (attackNumber <= 1) return 1.0
  return 0.6 * Math.pow(0.9, attackNumber - 2)
}

/**
 * 命中率計算に使う乱数係数
 * 0.95 <= rand < 1.05 に収め、式全体を過度に変動させないようにする
 */
export function getHitRateRandomModifier(rng: () => number): number {
  return 0.95 + rng() * 0.1
}

/**
 * 命中率を計算
 * 命中率 = 乱数A × (命中精度 × 攻撃回数補正 − 回避能力 × 残りHP補正)
 * 乱数A は 0.95 以上 1.05 未満
 * clamp(5, 95)
 */
export function calculateHitRate(
  attacker: BattleUnit,
  defender: BattleUnit,
  attackNumber: number,
  rng: () => number,
): number {
  const accMod = getAccuracyModifier(attackNumber)
  const rand = getHitRateRandomModifier(rng)

  // 残りHP補正 = 0.5 * (1 + 残りHP / 最大HP)
  const hpRatio = defender.maxHP > 0 ? defender.currentHP / defender.maxHP : 0
  const hpMod = 0.5 * (1 + hpRatio)

  const hitRate = rand * (attacker.accuracy * accMod - defender.evasion * hpMod)

  // 限界値補正: 5% 〜 95%
  return Math.max(5, Math.min(95, hitRate))
}

/** レベル帯ごとの魔法追加ダメージ制限倍率 */
const SPELL_BONUS_LEVEL_LIMIT_BY_LEVEL: { maxLevel: number; multiplier: number }[] = [
  { maxLevel: 5, multiplier: 0.282 },
  { maxLevel: 10, multiplier: 0.422 },
  { maxLevel: 15, multiplier: 0.630 },
  { maxLevel: 20, multiplier: 0.758 },
  { maxLevel: 25, multiplier: 0.910 },
  { maxLevel: Infinity, multiplier: 1.000 },
]

function getSpellCoefficient(level: number, spellDef: SpellDef): number {
  return (spellDef.spellCoefficient ?? 0) + level * (spellDef.spellCoefficientPerLevel ?? 0)
}

export function getSpellBonusDamage(level: number, magicAtk: number, spellDef: SpellDef): number {
  const entry = SPELL_BONUS_LEVEL_LIMIT_BY_LEVEL.find(e => level <= e.maxLevel)
  const spellBase = getSpellCoefficient(level, spellDef)
  if (!entry || spellBase === 0) return 0
  return entry.multiplier * (magicAtk * 0.1 + spellBase * (1 + level / 20) * 0.2)
}
