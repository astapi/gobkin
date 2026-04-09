import type { CharacterSkill } from '../types/CharacterSkill'

function cloneSkill(skill: CharacterSkill): CharacterSkill {
  return {
    ...skill,
    statBonuses: skill.statBonuses ? { ...skill.statBonuses } : undefined,
    statMultipliers: skill.statMultipliers ? { ...skill.statMultipliers } : undefined,
    equipmentCategoryMultiplier: skill.equipmentCategoryMultiplier
      ? { ...skill.equipmentCategoryMultiplier }
      : undefined,
    equipmentStatMultipliers: skill.equipmentStatMultipliers
      ? { ...skill.equipmentStatMultipliers }
      : undefined,
  }
}

function createAttackCountUpSkill(value: number): CharacterSkill {
  return {
    id: `attack_count_up_${value}`,
    name: `[+${value}]攻撃回数`,
    statBonuses: {
      attackCount: value,
    },
  }
}

function createPhysicalReductionSkill(value: number): CharacterSkill {
  return {
    id: `physical_reduction_${value}`,
    name: `[-${value}%]物理ダメージ軽減(%)`,
    physicalDamageReductionPercent: value,
  }
}

export const CHARACTER_SKILL_CATALOG = {
  additional_damage_13: {
    id: 'additional_damage_13',
    name: '[+13]追加ダメージ',
    additionalDamage: 13,
  },

  action_order_150: {
    id: 'action_order_150',
    name: '[戦術] 先制攻撃',
    actionOrderMultiplier: 1.5,
  },

  armor_mastery_120: {
    id: 'armor_mastery_120',
    name: '[1.2倍]鎧装備',
    equipmentCategoryMultiplier: { armor: 1.2 },
  },
  armor_mastery_130: {
    id: 'armor_mastery_130',
    name: '[1.3倍]鎧装備',
    equipmentCategoryMultiplier: { armor: 1.3 },
  },
  armor_mastery_150: {
    id: 'armor_mastery_150',
    name: '[1.5倍]鎧装備',
    equipmentCategoryMultiplier: { armor: 1.5 },
  },

  attack_count_up_1: createAttackCountUpSkill(1),
  attack_count_up_2: createAttackCountUpSkill(2),
  attack_count_up_3: createAttackCountUpSkill(3),
  attack_count_up_4: createAttackCountUpSkill(4),
  attack_count_up_5: createAttackCountUpSkill(5),
  attack_count_up_6: createAttackCountUpSkill(6),
  attack_count_up_7: createAttackCountUpSkill(7),
  attack_count_up_8: createAttackCountUpSkill(8),
  attack_count_up_9: createAttackCountUpSkill(9),
  attack_count_up_10: createAttackCountUpSkill(10),
  attack_count_up_11: createAttackCountUpSkill(11),

  cover_low_hp_ally: {
    id: 'cover_low_hp_ally',
    name: 'かばう',
    coverLowHpAlly: true,
  },

  equipment_accuracy_200: {
    id: 'equipment_accuracy_200',
    name: '[2.0倍]命中精度',
    equipmentStatMultipliers: {
      accuracy_flat: 2,
      accuracy_percent: 2,
    },
  },

  evasion_150: {
    id: 'evasion_150',
    name: '回避適正',
    statMultipliers: { evasion: 1.5 },
  },

  grant_blizzard: {
    id: 'grant_blizzard',
    name: 'ブリザード',
    grantsSpellId: 'blizzard',
  },
  grant_fireball: {
    id: 'grant_fireball',
    name: 'ファイヤーボール',
    grantsSpellId: 'fireball',
  },
  grant_magic_arrow: {
    id: 'grant_magic_arrow',
    name: 'マジックアロー',
    grantsSpellId: 'magic_arrow',
  },

  inspire_150: {
    id: 'inspire_150',
    name: '鼓舞',
    rearAllyDamageMultiplier: 1.5,
  },

  physical_reduction_1: createPhysicalReductionSkill(1),
  physical_reduction_2: createPhysicalReductionSkill(2),
  physical_reduction_3: createPhysicalReductionSkill(3),
  physical_reduction_5: createPhysicalReductionSkill(5),
  physical_reduction_6: createPhysicalReductionSkill(6),
  physical_reduction_7: createPhysicalReductionSkill(7),
  physical_reduction_8: createPhysicalReductionSkill(8),
  physical_reduction_9: createPhysicalReductionSkill(9),
  physical_reduction_10: createPhysicalReductionSkill(10),
  physical_reduction_11: createPhysicalReductionSkill(11),
  physical_reduction_12: createPhysicalReductionSkill(12),

  rear_guard: {
    id: 'rear_guard',
    name: '後列防護',
    protectRearAllyNormalAttackMultiplier: 2 / 3,
  },

  survive_lethal_hp1: {
    id: 'survive_lethal_hp1',
    name: '気合い',
    surviveLethalDamageAtHp1: true,
  },

  weapon_melee_attack: {
    id: 'weapon_melee_attack',
    name: '[武器]近距離攻撃',
    enablesMeleeRowDamagePenalty: true,
  },
  weapon_ranged_attack: {
    id: 'weapon_ranged_attack',
    name: '[武器]遠距離攻撃',
    enablesRangedRowDamagePenalty: true,
  },
} satisfies Record<string, CharacterSkill>

export type CharacterSkillId = keyof typeof CHARACTER_SKILL_CATALOG

export function isCharacterSkillId(skillId: string): skillId is CharacterSkillId {
  return skillId in CHARACTER_SKILL_CATALOG
}

export function getCharacterSkillDefinition(skillId: string): CharacterSkill {
  if (!(skillId in CHARACTER_SKILL_CATALOG)) {
    throw new Error(`Unknown character skill id: ${skillId}`)
  }

  return CHARACTER_SKILL_CATALOG[skillId as CharacterSkillId]
}

export function getCharacterSkill(skillId: string): CharacterSkill {
  return cloneSkill(getCharacterSkillDefinition(skillId))
}

export function getCharacterSkills(skillIds: readonly string[]): CharacterSkill[] {
  return skillIds.map((skillId) => getCharacterSkill(skillId))
}
