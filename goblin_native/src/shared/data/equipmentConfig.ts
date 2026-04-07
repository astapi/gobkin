/**
 * 装備枠の解放レベル表
 * index 0 が1枠目、index 1 が2枠目を表す
 */
export const EQUIPMENT_SLOT_LEVELS = [
  1, 3, 6, 9, 12, 16, 20, 25, 30, 36, 42, 49,
  58, 67, 77, 89, 102, 118, 134, 150, 166, 183, 200,
] as const

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

/**
 * ゴブリンのレベルからスロット数を計算
 */
export function calculateSlotCount(level: number): number {
  let unlockedSlots = 0

  for (const unlockLevel of EQUIPMENT_SLOT_LEVELS) {
    if (level < unlockLevel) break
    unlockedSlots++
  }

  return Math.max(1, unlockedSlots)
}
