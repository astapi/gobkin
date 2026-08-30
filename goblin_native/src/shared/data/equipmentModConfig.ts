import type {
  EquipmentModDef,
  EquipmentModId,
  EquipmentModSlot,
  EquipmentModTier,
} from '../types/Equipment'

const FLAT_STAT_WEIGHT = 100
const BASE_ATTRIBUTE_WEIGHT = 20
const EFFECT_WEIGHT = 60
const REWARD_MULTIPLIER_WEIGHT = 30
const TITLE_BONUS_WEIGHT = 5
const TITLE_MULTIPLIER_WEIGHT = 3
const BASE_ATTRIBUTE_ROLL_TIERS = [3, 4, 5] as const
const BASE_ATTRIBUTE_TIER_VALUES: Readonly<Record<EquipmentModTier, number>> = {
  1: 3,
  2: 3,
  3: 3,
  4: 2,
  5: 1,
  6: 1,
  7: 1,
  8: 1,
  9: 1,
  10: 1,
}

const baseAttributeMod = (
  id: Extract<EquipmentModId, 'power' | 'wisdom' | 'spirit' | 'vitality' | 'agility' | 'luck'>,
  stat: Extract<EquipmentModDef['stat'], `${string}_flat`>,
  legacySlots?: readonly EquipmentModSlot[],
): EquipmentModDef => ({
  id,
  slot: 'prefix',
  legacySlots,
  stat,
  weight: BASE_ATTRIBUTE_WEIGHT,
  rollTiers: BASE_ATTRIBUTE_ROLL_TIERS,
  tierValues: BASE_ATTRIBUTE_TIER_VALUES,
})

/**
 * 実数値系をprefix、倍率・報酬系をsuffixとして抽選する。
 * 既存のsuffix基本能力MODは新規抽選をprefixへ移し、旧保存値だけ互換読込する。
 * 基本能力MODは T5=+1 / T4=+2 / T3=+3 のみ新規抽選する。
 * その他は T10=1 から T1=10。倍率系は 1 + 値/100 として扱う。
 */
export const EQUIPMENT_MOD_DEFS: readonly EquipmentModDef[] = [
  baseAttributeMod('power', 'power_flat'),
  baseAttributeMod('wisdom', 'wisdom_flat'),
  baseAttributeMod('spirit', 'spirit_flat'),
  baseAttributeMod('vitality', 'vitality_flat', ['suffix']),
  baseAttributeMod('agility', 'agility_flat', ['suffix']),
  baseAttributeMod('luck', 'luck_flat', ['suffix']),
  { id: 'attack', slot: 'prefix', stat: 'atk_flat', weight: FLAT_STAT_WEIGHT },
  { id: 'defense', slot: 'prefix', stat: 'def_flat', weight: FLAT_STAT_WEIGHT },
  { id: 'accuracy', slot: 'prefix', stat: 'accuracy_flat', weight: FLAT_STAT_WEIGHT },
  { id: 'evasion', slot: 'prefix', stat: 'evasion_flat', weight: FLAT_STAT_WEIGHT },
  { id: 'hp', slot: 'prefix', stat: 'hp_flat', weight: FLAT_STAT_WEIGHT },
  { id: 'hp_multiplier', slot: 'suffix', skillEffect: 'hp_multiplier', weight: EFFECT_WEIGHT },
  { id: 'physical_damage', slot: 'suffix', skillEffect: 'physical_damage', weight: EFFECT_WEIGHT },
  { id: 'spell_damage', slot: 'suffix', skillEffect: 'spell_damage', weight: EFFECT_WEIGHT },
  { id: 'exp_bonus', slot: 'suffix', skillEffect: 'exp_bonus', weight: EFFECT_WEIGHT },
  { id: 'exp_multiplier', slot: 'suffix', skillEffect: 'exp_multiplier', weight: REWARD_MULTIPLIER_WEIGHT },
  { id: 'title_bonus', slot: 'suffix', skillEffect: 'title_bonus', weight: TITLE_BONUS_WEIGHT },
  { id: 'title_multiplier', slot: 'suffix', skillEffect: 'title_multiplier', weight: TITLE_MULTIPLIER_WEIGHT },
  { id: 'gold_multiplier', slot: 'suffix', skillEffect: 'gold_multiplier', weight: REWARD_MULTIPLIER_WEIGHT },
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
