import type { RaceSlotConfig } from '../types/Equipment'

/**
 * 種族ごとの装備スロット設定
 * スロット数 = baseSlots + floor((level - 1) / slotsPerLevel)、maxSlots上限
 */
export const RACE_SLOT_CONFIGS: Record<string, RaceSlotConfig> = {
  'ゴブリン': { baseSlots: 2, slotsPerLevel: 5, maxSlots: 6 },
  '魔獣': { baseSlots: 1, slotsPerLevel: 7, maxSlots: 4 },
}

const DEFAULT_SLOT_CONFIG: RaceSlotConfig = {
  baseSlots: 2,
  slotsPerLevel: 5,
  maxSlots: 6,
}

/**
 * ゴブリンのレベルと種族からスロット数を計算
 */
export function calculateSlotCount(race: string, level: number): number {
  const config = RACE_SLOT_CONFIGS[race] ?? DEFAULT_SLOT_CONFIG
  const bonusSlots = Math.floor((level - 1) / config.slotsPerLevel)
  return Math.min(config.baseSlots + bonusSlots, config.maxSlots)
}
