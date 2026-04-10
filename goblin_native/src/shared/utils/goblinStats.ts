import type { Goblin, GoblinStats, EquipmentInstance } from '../types'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'
import { EquipmentService } from '@/core/services/EquipmentService'
import { calculateGoblinDerivedStats, getGoblinBaseAttributes } from './goblinHp'
import { getLegacyRaceName, normalizeGoblinRaceId } from '../types/Race'

export function calculateGoblinEffectiveStats(
  goblin: Goblin,
  equippedItems: EquipmentInstance[] = [],
): GoblinStats {
  const equipmentBonuses = EquipmentService.calculateEquipmentBonuses(equippedItems)
  const equipmentSkills = EquipmentService.collectGrantedSkills(equippedItems)
  return ModStatCalculator.calculate({
    ...goblin,
    skills: [...goblin.skills, ...equipmentSkills],
  }, equipmentBonuses)
}

/**
 * ゴブリンの実効ステータス（因子+MOD適用後）を取得
 * effectiveStatsが設定されていればそれを返し、なければ計算する
 */
export function getEffectiveStats(goblin: Goblin): GoblinStats {
  if (goblin.effectiveStats) {
    return goblin.effectiveStats
  }
  return calculateGoblinEffectiveStats(goblin)
}

export function syncGoblinDerivedStats<T extends Goblin>(goblin: T): T {
  const raceId = normalizeGoblinRaceId(goblin.raceId ?? goblin.race)
  return {
    ...goblin,
    raceId,
    race: getLegacyRaceName(raceId),
    baseAttributes: getGoblinBaseAttributes(goblin),
    stats: calculateGoblinDerivedStats(goblin.level, {
      ...goblin,
      raceId,
      race: getLegacyRaceName(raceId),
      baseAttributes: getGoblinBaseAttributes(goblin),
      stats: goblin.stats,
    }),
  }
}
