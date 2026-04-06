import type { EquipmentCategory, EquipmentStat } from './Equipment'
import type { GoblinStats } from './Goblin'

export interface RaceAbility {
  name: string
  statBonuses?: Partial<Record<keyof GoblinStats, number>>
  equipmentCategoryMultiplier?: Partial<Record<EquipmentCategory, number>>
  equipmentStatMultipliers?: Partial<Record<EquipmentStat, number>>
  additionalDamage?: number
  protectRearAllyNormalAttackMultiplier?: number
}
