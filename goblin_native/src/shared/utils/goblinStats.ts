import type { Goblin, GoblinStats } from '../types'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'

/**
 * ゴブリンの実効ステータス（因子+MOD適用後）を取得
 * effectiveStatsが設定されていればそれを返し、なければ計算する
 */
export function getEffectiveStats(goblin: Goblin): GoblinStats {
  if (goblin.effectiveStats) {
    return goblin.effectiveStats
  }
  return ModStatCalculator.calculate(goblin)
}
