import type {
  EquipmentModDef,
  EquipmentModId,
  EquipmentModSlot,
  EquipmentModTier,
} from '../types/Equipment'

/**
 * prefixは攻撃寄り、suffixは防御・機動寄りの基本能力MOD。
 * MOD値は全種類共通で T10=+1 から T1=+10。
 */
export const EQUIPMENT_MOD_DEFS: readonly EquipmentModDef[] = [
  { id: 'power', slot: 'prefix', stat: 'power_flat' },
  { id: 'wisdom', slot: 'prefix', stat: 'wisdom_flat' },
  { id: 'spirit', slot: 'prefix', stat: 'spirit_flat' },
  { id: 'vitality', slot: 'suffix', stat: 'vitality_flat' },
  { id: 'agility', slot: 'suffix', stat: 'agility_flat' },
  { id: 'luck', slot: 'suffix', stat: 'luck_flat' },
]

export const EQUIPMENT_MOD_TIER_VALUES: Readonly<Record<EquipmentModTier, number>> = {
  1: 10,
  2: 9,
  3: 8,
  4: 7,
  5: 6,
  6: 5,
  7: 4,
  8: 3,
  9: 2,
  10: 1,
}

/**
 * MOD Tierの抽選ウェイト。T1が最高品質、T10が最低品質。
 * 敵レベルで解禁されたTierだけを対象に、ウェイトを再集計して抽選する。
 */
export const EQUIPMENT_MOD_TIER_WEIGHTS: Readonly<Record<EquipmentModTier, number>> = {
  1: 1,
  2: 4,
  3: 10,
  4: 40,
  5: 40,
  6: 36,
  7: 30,
  8: 24,
  9: 16,
  10: 10,
}

export const getEquipmentModsBySlot = (slot: EquipmentModSlot): readonly EquipmentModDef[] => (
  EQUIPMENT_MOD_DEFS.filter((definition) => definition.slot === slot)
)

export const getEquipmentModDef = (id: EquipmentModId): EquipmentModDef | undefined => (
  EQUIPMENT_MOD_DEFS.find((definition) => definition.id === id)
)
