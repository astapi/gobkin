import type { EquipmentCategory, EquipmentStat, WeaponSubCategory } from './Equipment'
import type { GoblinStats } from './Goblin'

export type RaceBuckets = {
  add?: Partial<Record<string, number>>
  mult?: Partial<Record<string, number>>
}

export interface CharacterSkill {
  id: string
  descriptionKey?: string
  statBonuses?: Partial<Record<keyof GoblinStats, number>>
  statMultipliers?: Partial<Record<keyof GoblinStats, number>>
  baseStatMultipliers?: Partial<Record<keyof GoblinStats, number>>
  defToHpPercent?: number
  magicHealToHpPercent?: number
  criticalRateBonusPercent?: number
  criticalDamageBonusPercent?: number
  actionOrderMultiplier?: number
  equipmentCategoryMultiplier?: Partial<Record<EquipmentCategory, number>>
  weaponSubCategoryMultiplier?: Partial<Record<WeaponSubCategory, number>>
  equipmentStatMultipliers?: Partial<Record<EquipmentStat, number>>
  enablesMeleeRowDamagePenalty?: boolean
  enablesRangedRowDamagePenalty?: boolean
  physicalDamageReductionPercent?: number
  breathDamageReductionPercent?: number
  breathDamageMultiplier?: number
  physicalDamagePercent?: number
  spellDamagePercent?: number
  additionalDamage?: number
  protectRearAllyNormalAttackMultiplier?: number
  rearAllyDamageMultiplier?: number
  coverLowHpAlly?: boolean
  actTwicePerTurn?: boolean
  surviveLethalDamageAtHp1?: boolean
  recoverRandomUsedSpellOnDefend?: boolean
  immediateReviveOnAllyDeath?: boolean
  grantsSpellId?: string
  spellChargeBonusForId?: string
  extraSpellCharges?: number
  expBonusPercent?: number
  expMultiplier?: number
  goldBonusPercent?: number
  expeditionTimeMultiplier?: number
  raceBonus?: RaceBuckets
  raceTakenBonus?: RaceBuckets
  spellTakenMultipliers?: Partial<Record<string, number>>
  undead?: boolean
  hpRegenPercent?: number
  hpRegenAmount?: number
  itemSlotsBonus?: boolean
  recoveryMagicLevel?: number
  mageMagicLevel?: number
}
