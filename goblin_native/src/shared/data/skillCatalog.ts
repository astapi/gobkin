import type { CharacterSkill } from '../types/CharacterSkill'

function cloneSkill(skill: CharacterSkill): CharacterSkill {
  return {
    ...skill,
    statBonuses: skill.statBonuses ? { ...skill.statBonuses } : undefined,
    statMultipliers: skill.statMultipliers ? { ...skill.statMultipliers } : undefined,
    baseStatMultipliers: skill.baseStatMultipliers ? { ...skill.baseStatMultipliers } : undefined,
    equipmentCategoryMultiplier: skill.equipmentCategoryMultiplier
      ? { ...skill.equipmentCategoryMultiplier }
      : undefined,
    equipmentStatMultipliers: skill.equipmentStatMultipliers
      ? { ...skill.equipmentStatMultipliers }
      : undefined,
  }
}

function createAttackCountUpSkill(value: number): CharacterSkill {
  const id = `attack_count_up_${value}`
  return {
    id,
    statBonuses: {
      attackCount: value,
    },
  }
}

function createEvasionUpSkill(value: number): CharacterSkill {
  const id = `evasion_up_${value}`
  return {
    id,
    statBonuses: {
      evasion: value,
    },
  }
}

function createCriticalRateUpSkill(value: number): CharacterSkill {
  const id = `critical_rate_up_${value}`
  return {
    id,
    criticalRateBonusPercent: value,
  }
}

function createBreathReductionSkill(value: number): CharacterSkill {
  const id = `breath_reduction_${value}`
  return {
    id,
    breathDamageReductionPercent: value,
  }
}

function createSpellDamageSkill(value: number): CharacterSkill {
  const id = `spell_damage_${value}`
  return {
    id,
    spellDamagePercent: value,
  }
}

function createDefToHpSkill(value: number): CharacterSkill {
  const id = `def_to_hp_${value}`
  return {
    id,
    defToHpPercent: value,
  }
}

function createMagicHealToHpSkill(value: number): CharacterSkill {
  const id = `magic_heal_to_hp_${value}`
  return {
    id,
    magicHealToHpPercent: value,
  }
}

function createCriticalDamageBonusSkill(value: number): CharacterSkill {
  const id = `critical_damage_bonus_${value}`
  return {
    id,
    criticalDamageBonusPercent: value,
  }
}

function createTalentSkill(stat: keyof NonNullable<CharacterSkill['baseStatMultipliers']>): CharacterSkill {
  return {
    id: `talent_${stat}_150`,
    baseStatMultipliers: {
      [stat]: 1.5,
    },
  }
}

function createPhysicalReductionSkill(value: number): CharacterSkill {
  const id = `physical_reduction_${value}`
  return {
    id,
    physicalDamageReductionPercent: value,
  }
}

function createRecoveryMagicSkill(level: number): CharacterSkill {
  return {
    id: `recovery_magic_lv${level}`,
    recoveryMagicLevel: level,
  }
}

export const CHARACTER_SKILL_CATALOG = {
  additional_damage_13: {
    id: 'additional_damage_13',
    additionalDamage: 13,
  },

  action_order_150: {
    id: 'action_order_150',
    actionOrderMultiplier: 1.5,
  },

  armor_mastery_120: {
    id: 'armor_mastery_120',
    equipmentCategoryMultiplier: { armor: 1.2 },
  },
  armor_mastery_130: {
    id: 'armor_mastery_130',
    equipmentCategoryMultiplier: { armor: 1.3 },
  },
  armor_mastery_150: {
    id: 'armor_mastery_150',
    equipmentCategoryMultiplier: { armor: 1.5 },
  },

  talent_itemSlots: {
    id: 'talent_itemSlots',
    itemSlotsBonus: true,
  } as CharacterSkill,

  talent_hp_150: createTalentSkill('hp'),
  talent_atk_150: createTalentSkill('atk'),
  talent_def_150: createTalentSkill('def'),
  talent_magicAtk_150: createTalentSkill('magicAtk'),
  talent_magicDef_150: createTalentSkill('magicDef'),
  talent_attackCount_150: createTalentSkill('attackCount'),
  talent_evasion_150: createTalentSkill('evasion'),
  talent_accuracy_150: createTalentSkill('accuracy'),
  talent_criticalRate_150: createTalentSkill('criticalRate'),

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
    coverLowHpAlly: true,
  },

  critical_damage_bonus_6: createCriticalDamageBonusSkill(6),
  critical_damage_bonus_7: createCriticalDamageBonusSkill(7),
  critical_damage_bonus_8: createCriticalDamageBonusSkill(8),
  critical_damage_bonus_9: createCriticalDamageBonusSkill(9),
  critical_damage_bonus_10: createCriticalDamageBonusSkill(10),
  critical_damage_bonus_11: createCriticalDamageBonusSkill(11),
  critical_damage_bonus_12: createCriticalDamageBonusSkill(12),
  critical_rate_up_10: createCriticalRateUpSkill(10),

  breath_damage_4_5: {
    id: 'breath_damage_4_5',
    breathDamageMultiplier: 0.8,
  },
  breath_reduction_6: createBreathReductionSkill(6),
  breath_reduction_7: createBreathReductionSkill(7),
  breath_reduction_8: createBreathReductionSkill(8),
  breath_reduction_9: createBreathReductionSkill(9),
  breath_reduction_10: createBreathReductionSkill(10),
  breath_reduction_11: createBreathReductionSkill(11),
  breath_reduction_12: createBreathReductionSkill(12),

  def_to_hp_1: createDefToHpSkill(1),
  def_to_hp_2: createDefToHpSkill(2),
  def_to_hp_3: createDefToHpSkill(3),
  def_to_hp_4: createDefToHpSkill(4),
  def_to_hp_5: createDefToHpSkill(5),
  def_to_hp_6: createDefToHpSkill(6),
  def_to_hp_7: createDefToHpSkill(7),
  def_to_hp_8: createDefToHpSkill(8),
  def_to_hp_9: createDefToHpSkill(9),

  magic_heal_to_hp_6: createMagicHealToHpSkill(6),
  magic_heal_to_hp_7: createMagicHealToHpSkill(7),
  magic_heal_to_hp_8: createMagicHealToHpSkill(8),
  magic_heal_to_hp_9: createMagicHealToHpSkill(9),
  magic_heal_to_hp_10: createMagicHealToHpSkill(10),
  magic_heal_to_hp_11: createMagicHealToHpSkill(11),
  magic_heal_to_hp_12: createMagicHealToHpSkill(12),

  equipment_accuracy_200: {
    id: 'equipment_accuracy_200',
    equipmentStatMultipliers: {
      accuracy_flat: 2,
    },
  },
  evasion_up_20: createEvasionUpSkill(20),
  evasion_up_30: createEvasionUpSkill(30),
  evasion_up_40: createEvasionUpSkill(40),
  evasion_up_50: createEvasionUpSkill(50),
  evasion_up_60: createEvasionUpSkill(60),
  evasion_up_70: createEvasionUpSkill(70),
  evasion_up_80: createEvasionUpSkill(80),

  evasion_150: {
    id: 'evasion_150',
    statMultipliers: { evasion: 1.5 },
  },

  spell_damage_10: createSpellDamageSkill(10),
  spell_damage_11: createSpellDamageSkill(11),
  spell_damage_12: createSpellDamageSkill(12),
  spell_damage_13: createSpellDamageSkill(13),
  spell_damage_14: createSpellDamageSkill(14),
  spell_damage_15: createSpellDamageSkill(15),
  spell_damage_16: createSpellDamageSkill(16),

  grant_blizzard: {
    id: 'grant_blizzard',
    grantsSpellId: 'blizzard',
  },
  grant_fireball: {
    id: 'grant_fireball',
    grantsSpellId: 'fireball',
  },
  grant_heal: {
    id: 'grant_heal',
    grantsSpellId: 'heal',
  },
  grant_magic_arrow: {
    id: 'grant_magic_arrow',
    grantsSpellId: 'magic_arrow',
  },
  grant_party_heal: {
    id: 'grant_party_heal',
    grantsSpellId: 'party_heal',
  },
  grant_shield_barrier: {
    id: 'grant_shield_barrier',
    grantsSpellId: 'shield_barrier',
  },

  inspire_150: {
    id: 'inspire_150',
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
    protectRearAllyNormalAttackMultiplier: 2 / 3,
  },

  survive_lethal_hp1: {
    id: 'survive_lethal_hp1',
    surviveLethalDamageAtHp1: true,
  },

  exp_bonus_70: {
    id: 'exp_bonus_70',
    expBonusPercent: 70,
  },

  gold_bonus_50: {
    id: 'gold_bonus_50',
    goldBonusPercent: 50,
  },

  undead_trait: {
    id: 'undead_trait',
    undead: true,
  },

  hp_regen_20: {
    id: 'hp_regen_20',
    hpRegenPercent: 20,
  },

  recovery_magic_lv1: createRecoveryMagicSkill(1),
  recovery_magic_lv2: createRecoveryMagicSkill(2),
  recovery_magic_lv3: createRecoveryMagicSkill(3),
  recovery_magic_lv4: createRecoveryMagicSkill(4),
  recovery_magic_lv5: createRecoveryMagicSkill(5),
  recovery_magic_lv6: createRecoveryMagicSkill(6),
  recovery_magic_lv7: createRecoveryMagicSkill(7),

  weapon_melee_attack: {
    id: 'weapon_melee_attack',
    descriptionKey: 'entities.skill.weapon_melee_attack.description',
    enablesMeleeRowDamagePenalty: true,
  },
  weapon_ranged_attack: {
    id: 'weapon_ranged_attack',
    descriptionKey: 'entities.skill.weapon_ranged_attack.description',
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
