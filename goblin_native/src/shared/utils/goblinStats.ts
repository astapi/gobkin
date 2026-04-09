import type { Goblin, GoblinStats } from '../types'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'
import { calculateGoblinDerivedStats, getGoblinBaseAttributes } from './goblinHp'

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

export function syncGoblinDerivedStats<T extends Goblin>(goblin: T): T {
  return {
    ...goblin,
    baseAttributes: getGoblinBaseAttributes(goblin),
    stats: calculateGoblinDerivedStats(goblin.level, {
      ...goblin,
      baseAttributes: getGoblinBaseAttributes(goblin),
      stats: goblin.stats,
    }),
  }
}
