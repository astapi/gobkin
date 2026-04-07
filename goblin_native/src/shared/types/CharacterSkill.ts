import type { EquipmentCategory, EquipmentStat } from './Equipment'
import type { GoblinStats } from './Goblin'

export interface CharacterSkill {
  id: string
  name: string
  statBonuses?: Partial<Record<keyof GoblinStats, number>>
  equipmentCategoryMultiplier?: Partial<Record<EquipmentCategory, number>>
  equipmentStatMultipliers?: Partial<Record<EquipmentStat, number>>
  physicalDamageReductionPercent?: number
  additionalDamage?: number
  protectRearAllyNormalAttackMultiplier?: number
  grantsSpellId?: string
  spellChargeBonusForId?: string
  extraSpellCharges?: number
}
