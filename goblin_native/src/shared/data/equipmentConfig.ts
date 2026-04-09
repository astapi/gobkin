import { getGoblinVariantByRace } from './goblinVariants'
import { normalizeGoblinRaceId } from '../types/Race'

export interface BloodlineCombatStats {
  attackCount: number
  accuracy: number
  evasion: number
}

const DEFAULT_COMBAT_STATS: BloodlineCombatStats = {
  attackCount: 2,
  accuracy: 20,
  evasion: 15,
}

/**
 * 装備枠の解放レベル表
 * index 0 が1枠目、index 1 が2枠目を表す
 */
export const EQUIPMENT_SLOT_LEVELS = [
  1, 3, 6, 9, 12, 16, 20, 25, 30, 36, 42, 49,
  58, 67, 77, 89, 102, 118, 134, 150, 166, 183, 200,
] as const

/**
 * 血統別の攻撃回数補正
 * 攻撃回数は敏捷ベースで算出し、血統差分のみ最終補正として加算する
 */
/**
 * 血統の攻撃回数補正を取得
 */
export function getBloodlineAttackCountBonus(bloodline: string): number {
  return getBloodlineCombatStats(bloodline).attackCount - DEFAULT_COMBAT_STATS.attackCount
}

export function getBloodlineCombatStats(bloodline: string): BloodlineCombatStats {
  if (normalizeGoblinRaceId(bloodline) === 'goblin') {
    return DEFAULT_COMBAT_STATS
  }

  return getGoblinVariantByRace(normalizeGoblinRaceId(bloodline))?.combatStats ?? DEFAULT_COMBAT_STATS
}

function normalizeEquipmentLevel(level: unknown): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    return 1
  }

  return Math.max(1, Math.floor(level))
}

/**
 * ゴブリンのレベルからスロット数を計算
 */
export function calculateSlotCount(level: number): number
export function calculateSlotCount(level: number): number {
  const normalizedLevel = normalizeEquipmentLevel(level)
  let unlockedSlots = 0

  for (const unlockLevel of EQUIPMENT_SLOT_LEVELS) {
    if (normalizedLevel < unlockLevel) break
    unlockedSlots++
  }

  return Math.max(1, unlockedSlots)
}
