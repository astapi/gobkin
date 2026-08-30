import type {
  EquipmentModDef,
  EquipmentModId,
  EquipmentModRoll,
  EquipmentModSlot,
  EquipmentModTier,
  EquipmentStatBonus,
} from '../../shared/types/Equipment'
import type { CharacterSkill } from '../../shared/types/CharacterSkill'
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

  private static getUnlockedTiers(
    enemyLevel: number,
    rollTiers?: readonly EquipmentModTier[],
  ): EquipmentModTier[] {
    const bestTier = this.getBestUnlockedTier(enemyLevel)
    const globallyUnlocked = Array.from(
      { length: MAX_MOD_TIER - bestTier + 1 },
      (_, index) => (bestTier + index) as EquipmentModTier,
    )
    if (!rollTiers) return globallyUnlocked
    const allowed = new Set<EquipmentModTier>(rollTiers)
    return globallyUnlocked.filter(tier => allowed.has(tier))
  }

  private static isAvailableAtLevel(definition: EquipmentModDef, enemyLevel: number): boolean {
    return this.getUnlockedTiers(enemyLevel, definition.rollTiers).length > 0
  }

  /** 解禁済みTierをMOD固有のTier範囲内でウェイト付き抽選する。 */
  static rollBaseTier(
    enemyLevel: number,
    rng: () => number,
    rollTiers?: readonly EquipmentModTier[],
  ): EquipmentModTier {
    const candidates = this.getUnlockedTiers(enemyLevel, rollTiers)
    if (candidates.length === 0) {
      throw new Error(`No equipment MOD tier is available at enemy level ${enemyLevel}`)
    }
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
    rollTiers?: readonly EquipmentModTier[],
  ): EquipmentModTier {
    const rollCount = getDungeonTierModRollCount(dungeonTier)
    let bestTier: EquipmentModTier = MAX_MOD_TIER
    for (let index = 0; index < rollCount; index++) {
      bestTier = Math.min(bestTier, this.rollBaseTier(enemyLevel, rng, rollTiers)) as EquipmentModTier
    }
    return bestTier
  }

  static rollMod(
    slot: EquipmentModSlot,
    enemyLevel: number,
    dungeonTier: DungeonTier,
    rng: () => number,
  ): EquipmentModRoll {
    const candidates = getEquipmentModsBySlot(slot).filter(definition => (
      this.isAvailableAtLevel(definition, enemyLevel)
    ))
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
    let roll = rng() * totalWeight
    let definition = candidates[candidates.length - 1]
    for (const candidate of candidates) {
      roll -= candidate.weight
      if (roll <= 0) {
        definition = candidate
        break
      }
    }
    return {
      id: definition.id,
      tier: this.rollBestTier(enemyLevel, dungeonTier, rng, definition.rollTiers),
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
    return getEquipmentModDef(mod.id)?.tierValues?.[mod.tier]
      ?? EQUIPMENT_MOD_TIER_VALUES[mod.tier]
  }

  static toStatBonus(mod: EquipmentModRoll): EquipmentStatBonus | undefined {
    const definition = getEquipmentModDef(mod.id)
    if (!definition?.stat) return undefined
    return {
      stat: definition.stat,
      value: this.getValue(mod),
      sourceModSlot: definition.slot,
      sourceModTier: mod.tier,
      sourceModId: mod.id,
    }
  }

  /** 倍率・報酬系MODを装備付与スキルへ変換する。 */
  static toGrantedSkill(
    mod: EquipmentModRoll,
    equipmentId: string,
    valueMultiplier: number = 1,
  ): CharacterSkill | undefined {
    const definition = getEquipmentModDef(mod.id)
    if (!definition?.skillEffect) return undefined

    const value = Number((this.getValue(mod) * valueMultiplier).toFixed(4))
    const multiplier = Number((1 + value / 100).toFixed(6))
    const id = `equipment_mod_${equipmentId}_${mod.id}_t${mod.tier}`
    const baseSkill: Pick<CharacterSkill, 'id' | 'isEquipmentModEffect'> = {
      id,
      isEquipmentModEffect: true,
    }

    switch (definition.skillEffect) {
      case 'hp_multiplier':
        return { ...baseSkill, statMultipliers: { hp: multiplier } }
      case 'physical_damage':
        return { ...baseSkill, physicalDamagePercent: value }
      case 'spell_damage':
        return { ...baseSkill, spellDamagePercent: value }
      case 'exp_bonus':
        return { ...baseSkill, expBonusPercent: value }
      case 'exp_multiplier':
        return { ...baseSkill, expMultiplier: multiplier }
      case 'title_bonus':
        return { ...baseSkill, partyTitleBonusPercent: value }
      case 'title_multiplier':
        return { ...baseSkill, partyTitleMultiplier: multiplier }
      case 'gold_multiplier':
        return { ...baseSkill, goldMultiplier: multiplier }
    }
  }

  static normalizeRoll(value: unknown, expectedSlot: EquipmentModSlot): EquipmentModRoll | undefined {
    if (!value || typeof value !== 'object') return undefined
    const candidate = value as { id?: unknown; tier?: unknown }
    if (!isEquipmentModId(candidate.id)) return undefined
    if (typeof candidate.tier !== 'number' || !Number.isInteger(candidate.tier)) return undefined
    if (candidate.tier < MIN_MOD_TIER || candidate.tier > MAX_MOD_TIER) return undefined
    const definition = getEquipmentModDef(candidate.id)
    if (definition?.slot !== expectedSlot && !definition?.legacySlots?.includes(expectedSlot)) return undefined
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
