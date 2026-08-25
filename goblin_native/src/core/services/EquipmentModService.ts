import type {
  EquipmentModId,
  EquipmentModRoll,
  EquipmentModSlot,
  EquipmentModTier,
  EquipmentStatBonus,
} from '../../shared/types/Equipment'
import { getDungeonTierModRollCount, type DungeonTier } from '../../shared/types/DungeonTier'
import {
  EQUIPMENT_MOD_TIER_WEIGHTS,
  EQUIPMENT_MOD_TIER_VALUES,
  getEquipmentModDef,
  getEquipmentModsBySlot,
} from '../../shared/data/equipmentModConfig'
import {
  getEquipmentModSignature,
  getEquipmentStackKey,
  isSameEquipmentStack,
  type EquipmentModIdentity,
} from '../../shared/utils/equipmentModIdentity'

type EquipmentModCarrier = EquipmentModIdentity

const MIN_MOD_TIER = 1
const MAX_MOD_TIER = 10
const LEVELS_PER_MOD_TIER = 15

function clampTier(value: number): EquipmentModTier {
  return Math.max(MIN_MOD_TIER, Math.min(MAX_MOD_TIER, Math.floor(value))) as EquipmentModTier
}

function isEquipmentModId(value: unknown): value is EquipmentModId {
  return typeof value === 'string' && getEquipmentModDef(value as EquipmentModId) !== undefined
}

export class EquipmentModService {
  /** 敵Lv150でT1が抽選対象に入る。 */
  static getBestUnlockedTier(enemyLevel: number): EquipmentModTier {
    const normalizedLevel = Math.max(1, Math.floor(enemyLevel))
    return clampTier(MAX_MOD_TIER + 1 - Math.floor(normalizedLevel / LEVELS_PER_MOD_TIER))
  }

  /** 解禁済みの最高TierからT10までをウェイト付きで抽選する。 */
  static rollBaseTier(enemyLevel: number, rng: () => number): EquipmentModTier {
    const bestTier = this.getBestUnlockedTier(enemyLevel)
    const candidates = Array.from(
      { length: MAX_MOD_TIER - bestTier + 1 },
      (_, index) => (bestTier + index) as EquipmentModTier,
    )
    const totalWeight = candidates.reduce(
      (total, tier) => total + EQUIPMENT_MOD_TIER_WEIGHTS[tier],
      0,
    )
    let roll = rng() * totalWeight

    for (const tier of candidates) {
      roll -= EQUIPMENT_MOD_TIER_WEIGHTS[tier]
      if (roll <= 0) return tier
    }

    return candidates[candidates.length - 1]
  }

  /** ダンジョンTierの判定回数だけ抽選し、最上位（最小値）のTierを採用する。 */
  static rollBestTier(
    enemyLevel: number,
    dungeonTier: DungeonTier,
    rng: () => number,
  ): EquipmentModTier {
    const rollCount = getDungeonTierModRollCount(dungeonTier)
    let bestTier: EquipmentModTier = MAX_MOD_TIER
    for (let index = 0; index < rollCount; index++) {
      bestTier = Math.min(bestTier, this.rollBaseTier(enemyLevel, rng)) as EquipmentModTier
    }
    return bestTier
  }

  static rollMod(
    slot: EquipmentModSlot,
    enemyLevel: number,
    dungeonTier: DungeonTier,
    rng: () => number,
  ): EquipmentModRoll {
    const candidates = getEquipmentModsBySlot(slot)
    const definition = candidates[Math.floor(rng() * candidates.length)]
    return {
      id: definition.id,
      tier: this.rollBestTier(enemyLevel, dungeonTier, rng),
    }
  }

  static rollMods(
    enemyLevel: number,
    dungeonTier: DungeonTier,
    rng: () => number,
  ): Pick<EquipmentModCarrier, 'prefixMod' | 'suffixMod'> {
    return {
      prefixMod: this.rollMod('prefix', enemyLevel, dungeonTier, rng),
      suffixMod: this.rollMod('suffix', enemyLevel, dungeonTier, rng),
    }
  }

  static getValue(mod: EquipmentModRoll): number {
    return EQUIPMENT_MOD_TIER_VALUES[mod.tier]
  }

  static toStatBonus(mod: EquipmentModRoll): EquipmentStatBonus | undefined {
    const definition = getEquipmentModDef(mod.id)
    if (!definition) return undefined
    return {
      stat: definition.stat,
      value: this.getValue(mod),
      sourceModSlot: definition.slot,
      sourceModTier: mod.tier,
      sourceModId: mod.id,
    }
  }

  static normalizeRoll(value: unknown, expectedSlot: EquipmentModSlot): EquipmentModRoll | undefined {
    if (!value || typeof value !== 'object') return undefined
    const candidate = value as { id?: unknown; tier?: unknown }
    if (!isEquipmentModId(candidate.id)) return undefined
    if (typeof candidate.tier !== 'number' || !Number.isInteger(candidate.tier)) return undefined
    if (candidate.tier < MIN_MOD_TIER || candidate.tier > MAX_MOD_TIER) return undefined
    if (getEquipmentModDef(candidate.id)?.slot !== expectedSlot) return undefined
    return { id: candidate.id, tier: candidate.tier as EquipmentModTier }
  }

  static getModSignature(item: Pick<EquipmentModCarrier, 'prefixMod' | 'suffixMod'>): string {
    return getEquipmentModSignature(item)
  }

  static getStackKey(item: EquipmentModCarrier): string {
    return getEquipmentStackKey(item)
  }

  static isSameStack(a: EquipmentModCarrier, b: EquipmentModCarrier): boolean {
    return isSameEquipmentStack(a, b)
  }
}
