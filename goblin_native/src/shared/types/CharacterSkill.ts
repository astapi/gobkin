import type { EquipmentCategory, EquipmentStat } from './Equipment'
import type { GoblinStats } from './Goblin'

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
  undead?: boolean
  hpRegenPercent?: number
}
