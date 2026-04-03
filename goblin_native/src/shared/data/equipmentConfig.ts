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
 * 血統別の戦闘ステータス初期値
 * 血統: ゴブリンの派生（スライムゴブリン、ウルフゴブリンなど）
 */
export interface BloodlineCombatStats {
  attackCount: number  // 攻撃回数の初期値
  accuracy: number     // 命中精度の基準値（実際はランダム範囲で生成）
  evasion: number      // 回避能力の基準値（実際はランダム範囲で生成）
}

export const BLOODLINE_COMBAT_STATS: Record<string, BloodlineCombatStats> = {
  'ゴブリン':         { attackCount: 2, accuracy: 20, evasion: 15 },
  'スライムゴブリン': { attackCount: 2, accuracy: 20, evasion: 15 },
  'ウルフゴブリン':   { attackCount: 3, accuracy: 20, evasion: 15 },
  'オークゴブリン':   { attackCount: 2, accuracy: 20, evasion: 15 },
  'ホブゴブリン':     { attackCount: 2, accuracy: 20, evasion: 15 },
}

const DEFAULT_COMBAT_STATS: BloodlineCombatStats = {
  attackCount: 2, accuracy: 20, evasion: 15,
}

/**
 * 血統の戦闘ステータス初期値を取得
 */
export function getBloodlineCombatStats(bloodline: string): BloodlineCombatStats {
  return BLOODLINE_COMBAT_STATS[bloodline] ?? DEFAULT_COMBAT_STATS
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
