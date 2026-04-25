import type { EquipmentCategory, EquipmentStat } from './Equipment'
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
  equipmentStatMultipliers?: Partial<Record<EquipmentStat, number>>
  enablesMeleeRowDamagePenalty?: boolean
  enablesRangedRowDamagePenalty?: boolean
  physicalDamageReductionPercent?: number
  breathDamageReductionPercent?: number
  breathDamageMultiplier?: number
  spellDamagePercent?: number
  additionalDamage?: number
  protectRearAllyNormalAttackMultiplier?: number
  rearAllyDamageMultiplier?: number
  coverLowHpAlly?: boolean
  surviveLethalDamageAtHp1?: boolean
  grantsSpellId?: string
  spellChargeBonusForId?: string
  extraSpellCharges?: number
  expBonusPercent?: number
  goldBonusPercent?: number
  expeditionTimeMultiplier?: number
  raceBonus?: RaceBuckets
  raceTakenBonus?: RaceBuckets
  spellTakenMultipliers?: Partial<Record<string, number>>
  undead?: boolean
  hpRegenPercent?: number
  itemSlotsBonus?: boolean
  recoveryMagicLevel?: number
  mageMagicLevel?: number
}
