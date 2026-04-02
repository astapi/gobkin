import type { RaceSlotConfig } from '../types/Equipment'

/**
 * 種族ごとの装備スロット設定
 * スロット数 = baseSlots + floor((level - 1) / slotsPerLevel)、maxSlots上限
 */
export const RACE_SLOT_CONFIGS: Record<string, RaceSlotConfig> = {
  'ゴブリン': { baseSlots: 2, slotsPerLevel: 5, maxSlots: 6 },
  '魔獣': { baseSlots: 1, slotsPerLevel: 7, maxSlots: 4 },
}

/**
 * 種族別の戦闘ステータス初期値
 */
export interface RaceCombatStats {
  attackCount: number  // 攻撃回数の初期値
  accuracy: number     // 命中精度の基準値（実際はランダム範囲で生成）
  evasion: number      // 回避能力の基準値（実際はランダム範囲で生成）
}

export const RACE_COMBAT_STATS: Record<string, RaceCombatStats> = {
  'ゴブリン': { attackCount: 2, accuracy: 20, evasion: 15 },
  '魔獣':    { attackCount: 1, accuracy: 20, evasion: 18 },
}

const DEFAULT_COMBAT_STATS: RaceCombatStats = {
  attackCount: 2, accuracy: 20, evasion: 15,
}

/**
 * 種族の戦闘ステータス初期値を取得
 */
export function getRaceCombatStats(race: string): RaceCombatStats {
  return RACE_COMBAT_STATS[race] ?? DEFAULT_COMBAT_STATS
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
