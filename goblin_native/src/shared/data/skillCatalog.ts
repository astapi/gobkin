import type { CharacterSkill } from '../types/CharacterSkill'

function cloneSkill(skill: CharacterSkill): CharacterSkill {
  return {
    ...skill,
    raceBonus: skill.raceBonus
      ? {
          add: skill.raceBonus.add ? { ...skill.raceBonus.add } : undefined,
          mult: skill.raceBonus.mult ? { ...skill.raceBonus.mult } : undefined,
        }
      : undefined,
    raceTakenBonus: skill.raceTakenBonus
      ? {
          add: skill.raceTakenBonus.add ? { ...skill.raceTakenBonus.add } : undefined,
          mult: skill.raceTakenBonus.mult ? { ...skill.raceTakenBonus.mult } : undefined,
        }
      : undefined,
    spellTakenMultipliers: skill.spellTakenMultipliers
      ? { ...skill.spellTakenMultipliers }
      : undefined,
    magicDamageFollowUp: skill.magicDamageFollowUp
      ? { ...skill.magicDamageFollowUp }
      : undefined,
    criticalAttackFollowUp: skill.criticalAttackFollowUp
      ? { ...skill.criticalAttackFollowUp }
      : undefined,
    physicalCounterAttack: skill.physicalCounterAttack
      ? { ...skill.physicalCounterAttack }
      : undefined,
    baseAttributeBonuses: skill.baseAttributeBonuses ? { ...skill.baseAttributeBonuses } : undefined,
    statBonuses: skill.statBonuses ? { ...skill.statBonuses } : undefined,
    statMultipliers: skill.statMultipliers ? { ...skill.statMultipliers } : undefined,
    baseStatMultipliers: skill.baseStatMultipliers ? { ...skill.baseStatMultipliers } : undefined,
    equipmentCategoryMultiplier: skill.equipmentCategoryMultiplier
      ? { ...skill.equipmentCategoryMultiplier }
      : undefined,
    weaponSubCategoryMultiplier: skill.weaponSubCategoryMultiplier
      ? { ...skill.weaponSubCategoryMultiplier }
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

function createBaseAttributeUpSkill(
  stat: keyof NonNullable<CharacterSkill['baseAttributeBonuses']>,
  value: number,
): CharacterSkill {
  return {
    id: `base_${stat}_up_${value}`,
    baseAttributeBonuses: {
      [stat]: value,
    },
  }
}

function createPartyRareMultiplierSkill(value: number): CharacterSkill {
  const suffix = value.toString().replace('.', '_')
  return {
    id: `party_rare_mult_${suffix}`,
    partyRareMultiplier: value,
  }
}

function createPartyTitleMultiplierSkill(value: number): CharacterSkill {
  const suffix = value.toString().replace('.', '_')
  return {
    id: `party_title_mult_${suffix}`,
    partyTitleMultiplier: value,
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

function createPhysicalDamageSkill(value: number): CharacterSkill {
  const id = `physical_damage_${value}`
  return {
    id,
    physicalDamagePercent: value,
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

function createMagicReductionSkill(value: number): CharacterSkill {
  const id = `magic_reduction_${value}`
  return {
    id,
    magicDamageReductionPercent: value,
  }
}

function createAttackResistantSkill(numerator: number, denominator: number): CharacterSkill {
  const id = `attack_resistant_${numerator}_${denominator}`
  return {
    id,
    physicalDamageTakenMultiplier: numerator / denominator,
  }
}

function createMagicResistantSkill(numerator: number, denominator: number): CharacterSkill {
  const id = `magic_resistant_${numerator}_${denominator}`
  return {
    id,
    magicDamageTakenMultiplier: numerator / denominator,
  }
}

function createCounterAvoidanceSkill(numerator: number, denominator: number): CharacterSkill {
  const id = `counter_avoidance_${numerator}_${denominator}`
  return {
    id,
    counterAttackAvoidanceRate: numerator / denominator,
  }
}

function createRecoveryMagicSkill(level: number): CharacterSkill {
  return {
    id: `recovery_magic_lv${level}`,
    recoveryMagicLevel: level,
  }
}

function createMageMagicSkill(level: number): CharacterSkill {
  return {
    id: `mage_magic_lv${level}`,
    mageMagicLevel: level,
  }
}

function createRaceSlayerSkill(raceTag: string, multiplier: number): CharacterSkill {
  const suffix = multiplier.toFixed(1).replace('.', '_')
  return {
    id: `${raceTag}_slayer_${suffix}`,
    raceBonus: {
      mult: {
        [raceTag]: multiplier - 1,
      },
    },
  }
}

function createSpellTakenSkill(spellId: string, multiplier: number): CharacterSkill {
  const suffix = multiplier.toFixed(1).replace('.', '_')
  return {
    id: `${spellId}_taken_${suffix}`,
    spellTakenMultipliers: {
      [spellId]: multiplier,
    },
  }
}

export const CHARACTER_SKILL_CATALOG = {
  abnormal_marku: {
    id: 'abnormal_marku',
    descriptionKey: 'entities.skill.abnormal_marku.description',
    baseAttributeBonuses: {
      power: 3,
      wisdom: 3,
      luck: 3,
    },
    partyRareMultiplier: 1.1,
    partyTitleMultiplier: 1.1,
  },

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
  shield_mastery_120: {
    id: 'shield_mastery_120',
    equipmentCategoryMultiplier: { shield: 1.2 },
  },
  shield_mastery_130: {
    id: 'shield_mastery_130',
    equipmentCategoryMultiplier: { shield: 1.3 },
  },
  shield_mastery_150: {
    id: 'shield_mastery_150',
    equipmentCategoryMultiplier: { shield: 1.5 },
  },
  shield_mastery_200: {
    id: 'shield_mastery_200',
    equipmentCategoryMultiplier: { shield: 2.0 },
  },
  robe_mastery_120: {
    id: 'robe_mastery_120',
    equipmentCategoryMultiplier: { robe: 1.2 },
  },
  robe_mastery_130: {
    id: 'robe_mastery_130',
    equipmentCategoryMultiplier: { robe: 1.3 },
  },
  robe_mastery_150: {
    id: 'robe_mastery_150',
    equipmentCategoryMultiplier: { robe: 1.5 },
  },
  robe_mastery_200: {
    id: 'robe_mastery_200',
    equipmentCategoryMultiplier: { robe: 2.0 },
  },
  sword_mastery_120: {
    id: 'sword_mastery_120',
    weaponSubCategoryMultiplier: { sword: 1.2 },
  },
  sword_mastery_150: {
    id: 'sword_mastery_150',
    weaponSubCategoryMultiplier: { sword: 1.5 },
  },
  claw_mastery_120: {
    id: 'claw_mastery_120',
    weaponSubCategoryMultiplier: { claw: 1.2 },
  },
  claw_mastery_150: {
    id: 'claw_mastery_150',
    weaponSubCategoryMultiplier: { claw: 1.5 },
  },
  wand_mastery_120: {
    id: 'wand_mastery_120',
    equipmentCategoryMultiplier: { wand: 1.2 },
  },
  wand_mastery_150: {
    id: 'wand_mastery_150',
    equipmentCategoryMultiplier: { wand: 1.5 },
  },
  rod_mastery_120: {
    id: 'rod_mastery_120',
    equipmentCategoryMultiplier: { rod: 1.2 },
  },
  rod_mastery_150: {
    id: 'rod_mastery_150',
    equipmentCategoryMultiplier: { rod: 1.5 },
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

  base_power_up_1: createBaseAttributeUpSkill('power', 1),
  base_power_up_2: createBaseAttributeUpSkill('power', 2),
  base_power_up_3: createBaseAttributeUpSkill('power', 3),
  base_power_up_4: createBaseAttributeUpSkill('power', 4),
  base_power_up_5: createBaseAttributeUpSkill('power', 5),
  base_power_up_6: createBaseAttributeUpSkill('power', 6),
  base_power_up_7: createBaseAttributeUpSkill('power', 7),
  base_power_up_8: createBaseAttributeUpSkill('power', 8),
  base_power_up_9: createBaseAttributeUpSkill('power', 9),
  base_power_up_10: createBaseAttributeUpSkill('power', 10),
  base_wisdom_up_1: createBaseAttributeUpSkill('wisdom', 1),
  base_wisdom_up_2: createBaseAttributeUpSkill('wisdom', 2),
  base_wisdom_up_3: createBaseAttributeUpSkill('wisdom', 3),
  base_wisdom_up_4: createBaseAttributeUpSkill('wisdom', 4),
  base_wisdom_up_5: createBaseAttributeUpSkill('wisdom', 5),
  base_wisdom_up_6: createBaseAttributeUpSkill('wisdom', 6),
  base_wisdom_up_7: createBaseAttributeUpSkill('wisdom', 7),
  base_wisdom_up_8: createBaseAttributeUpSkill('wisdom', 8),
  base_wisdom_up_9: createBaseAttributeUpSkill('wisdom', 9),
  base_wisdom_up_10: createBaseAttributeUpSkill('wisdom', 10),
  base_spirit_up_1: createBaseAttributeUpSkill('spirit', 1),
  base_spirit_up_2: createBaseAttributeUpSkill('spirit', 2),
  base_spirit_up_3: createBaseAttributeUpSkill('spirit', 3),
  base_spirit_up_4: createBaseAttributeUpSkill('spirit', 4),
  base_spirit_up_5: createBaseAttributeUpSkill('spirit', 5),
  base_spirit_up_6: createBaseAttributeUpSkill('spirit', 6),
  base_spirit_up_7: createBaseAttributeUpSkill('spirit', 7),
  base_spirit_up_8: createBaseAttributeUpSkill('spirit', 8),
  base_spirit_up_9: createBaseAttributeUpSkill('spirit', 9),
  base_spirit_up_10: createBaseAttributeUpSkill('spirit', 10),
  base_vitality_up_1: createBaseAttributeUpSkill('vitality', 1),
  base_vitality_up_2: createBaseAttributeUpSkill('vitality', 2),
  base_vitality_up_3: createBaseAttributeUpSkill('vitality', 3),
  base_vitality_up_4: createBaseAttributeUpSkill('vitality', 4),
  base_vitality_up_5: createBaseAttributeUpSkill('vitality', 5),
  base_vitality_up_6: createBaseAttributeUpSkill('vitality', 6),
  base_vitality_up_7: createBaseAttributeUpSkill('vitality', 7),
  base_vitality_up_8: createBaseAttributeUpSkill('vitality', 8),
  base_vitality_up_9: createBaseAttributeUpSkill('vitality', 9),
  base_vitality_up_10: createBaseAttributeUpSkill('vitality', 10),
  base_agility_up_1: createBaseAttributeUpSkill('agility', 1),
  base_agility_up_2: createBaseAttributeUpSkill('agility', 2),
  base_agility_up_3: createBaseAttributeUpSkill('agility', 3),
  base_agility_up_4: createBaseAttributeUpSkill('agility', 4),
  base_agility_up_5: createBaseAttributeUpSkill('agility', 5),
  base_agility_up_6: createBaseAttributeUpSkill('agility', 6),
  base_agility_up_7: createBaseAttributeUpSkill('agility', 7),
  base_agility_up_8: createBaseAttributeUpSkill('agility', 8),
  base_agility_up_9: createBaseAttributeUpSkill('agility', 9),
  base_agility_up_10: createBaseAttributeUpSkill('agility', 10),
  base_luck_up_1: createBaseAttributeUpSkill('luck', 1),
  base_luck_up_2: createBaseAttributeUpSkill('luck', 2),
  base_luck_up_3: createBaseAttributeUpSkill('luck', 3),
  base_luck_up_4: createBaseAttributeUpSkill('luck', 4),
  base_luck_up_5: createBaseAttributeUpSkill('luck', 5),
  base_luck_up_6: createBaseAttributeUpSkill('luck', 6),
  base_luck_up_7: createBaseAttributeUpSkill('luck', 7),
  base_luck_up_8: createBaseAttributeUpSkill('luck', 8),
  base_luck_up_9: createBaseAttributeUpSkill('luck', 9),
  base_luck_up_10: createBaseAttributeUpSkill('luck', 10),

  cover_low_hp_ally: {
    id: 'cover_low_hp_ally',
    coverLowHpAlly: true,
  },

  two_column_attack: {
    id: 'two_column_attack',
    twoColumnAttack: true,
  },

  two_actions: {
    id: 'two_actions',
    actTwicePerTurn: true,
  },

  mana_recovery: {
    id: 'mana_recovery',
    recoverRandomUsedSpellOnDefend: true,
  },

  instant_revive: {
    id: 'instant_revive',
    immediateReviveOnAllyDeath: true,
  },

  magic_support: {
    id: 'magic_support',
    magicDamageFollowUp: {
      attackCountMultiplier: 0.7,
      criticalRateMultiplier: 0.5,
    },
  },

  critical_support: {
    id: 'critical_support',
    criticalAttackFollowUp: {
      attackCountMultiplier: 0.7,
      criticalRateMultiplier: 0.5,
    },
  },

  counter_attack: {
    id: 'counter_attack',
    physicalCounterAttack: {
      attackCountMultiplier: 0.3,
      criticalRateMultiplier: 0.5,
    },
  },

  counter_avoidance_1_2: createCounterAvoidanceSkill(1, 2),
  counter_avoidance_2_3: createCounterAvoidanceSkill(2, 3),
  counter_avoidance_1_10: createCounterAvoidanceSkill(1, 10),

  goblin_pack_tactics: {
    id: 'goblin_pack_tactics',
    pureGoblinPartyStatBonusPercent: 5,
    pureGoblinPartyStatBonusMinLevel: 15,
  },

  goblin_binder: {
    id: 'goblin_binder',
    pureGoblinPartyStatBonusPercent: 5,
    pureGoblinPartyStatBonusMinLevel: 20,
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
  equipment_magic_atk_150: {
    id: 'equipment_magic_atk_150',
    equipmentStatMultipliers: {
      magic_atk_flat: 1.5,
    },
  },
  equipment_magic_atk_200: {
    id: 'equipment_magic_atk_200',
    equipmentStatMultipliers: {
      magic_atk_flat: 2,
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
  spell_damage_20: createSpellDamageSkill(20),
  spell_damage_58: createSpellDamageSkill(58),
  spell_damage_110: createSpellDamageSkill(110),
  spell_damage_175: createSpellDamageSkill(175),
  spell_damage_250: createSpellDamageSkill(250),
  spell_damage_400: createSpellDamageSkill(400),

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
  magic_field: {
    id: 'magic_field',
    partyMagicDamageMultiplier: 1.5,
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
  physical_reduction_14: createPhysicalReductionSkill(14),
  physical_reduction_18: createPhysicalReductionSkill(18),
  physical_reduction_22: createPhysicalReductionSkill(22),
  physical_reduction_26: createPhysicalReductionSkill(26),
  physical_reduction_30: createPhysicalReductionSkill(30),

  attack_resistant_1_4: createAttackResistantSkill(1, 4),
  attack_resistant_1_3: createAttackResistantSkill(1, 3),
  attack_resistant_1_2: createAttackResistantSkill(1, 2),
  attack_resistant_2_5: createAttackResistantSkill(2, 5),
  attack_resistant_3_5: createAttackResistantSkill(3, 5),
  attack_resistant_3_4: createAttackResistantSkill(3, 4),
  attack_resistant_2_3: createAttackResistantSkill(2, 3),
  attack_resistant_4_5: createAttackResistantSkill(4, 5),

  magic_reduction_1: createMagicReductionSkill(1),
  magic_reduction_2: createMagicReductionSkill(2),
  magic_reduction_3: createMagicReductionSkill(3),
  magic_reduction_5: createMagicReductionSkill(5),
  magic_reduction_6: createMagicReductionSkill(6),
  magic_reduction_7: createMagicReductionSkill(7),
  magic_reduction_8: createMagicReductionSkill(8),
  magic_reduction_9: createMagicReductionSkill(9),
  magic_reduction_10: createMagicReductionSkill(10),
  magic_reduction_11: createMagicReductionSkill(11),
  magic_reduction_12: createMagicReductionSkill(12),
  magic_reduction_14: createMagicReductionSkill(14),
  magic_reduction_18: createMagicReductionSkill(18),
  magic_reduction_22: createMagicReductionSkill(22),
  magic_reduction_26: createMagicReductionSkill(26),
  magic_reduction_30: createMagicReductionSkill(30),

  magic_resistant_1_4: createMagicResistantSkill(1, 4),
  magic_resistant_1_3: createMagicResistantSkill(1, 3),
  magic_resistant_1_2: createMagicResistantSkill(1, 2),
  magic_resistant_2_5: createMagicResistantSkill(2, 5),
  magic_resistant_3_5: createMagicResistantSkill(3, 5),
  magic_resistant_3_4: createMagicResistantSkill(3, 4),
  magic_resistant_2_3: createMagicResistantSkill(2, 3),
  magic_resistant_4_5: createMagicResistantSkill(4, 5),

  physical_damage_10: createPhysicalDamageSkill(10),
  physical_damage_20: createPhysicalDamageSkill(20),
  physical_damage_30: createPhysicalDamageSkill(30),
  physical_damage_40: createPhysicalDamageSkill(40),
  physical_damage_50: createPhysicalDamageSkill(50),
  physical_damage_58: createPhysicalDamageSkill(58),
  physical_damage_110: createPhysicalDamageSkill(110),
  physical_damage_175: createPhysicalDamageSkill(175),
  physical_damage_250: createPhysicalDamageSkill(250),
  physical_damage_400: createPhysicalDamageSkill(400),

  rear_guard: {
    id: 'rear_guard',
    protectRearAllyNormalAttackMultiplier: 2 / 3,
  },

  magic_rear_guard: {
    id: 'magic_rear_guard',
    protectRearAllyMagicDamageMultiplier: 2 / 3,
  },

  survive_lethal_hp1: {
    id: 'survive_lethal_hp1',
    surviveLethalDamageAtHp1: true,
  },

  exp_bonus_10: {
    id: 'exp_bonus_10',
    expBonusPercent: 10,
  },

  exp_bonus_30: {
    id: 'exp_bonus_30',
    expBonusPercent: 30,
  },

  exp_bonus_50: {
    id: 'exp_bonus_50',
    expBonusPercent: 50,
  },

  exp_bonus_60: {
    id: 'exp_bonus_60',
    expBonusPercent: 60,
  },

  exp_bonus_70: {
    id: 'exp_bonus_70',
    expBonusPercent: 70,
  },

  exp_bonus_80: {
    id: 'exp_bonus_80',
    expBonusPercent: 80,
  },

  exp_bonus_90: {
    id: 'exp_bonus_90',
    expBonusPercent: 90,
  },

  exp_mult_0_7: {
    id: 'exp_mult_0_7',
    expMultiplier: 0.7,
  },

  exp_mult_0_8: {
    id: 'exp_mult_0_8',
    expMultiplier: 0.8,
  },

  exp_mult_1_1: {
    id: 'exp_mult_1_1',
    expMultiplier: 1.1,
  },

  exp_mult_1_3: {
    id: 'exp_mult_1_3',
    expMultiplier: 1.3,
  },

  exp_mult_1_4: {
    id: 'exp_mult_1_4',
    expMultiplier: 1.4,
  },

  exp_mult_1_5: {
    id: 'exp_mult_1_5',
    expMultiplier: 1.5,
  },

  factor_drop_bonus_10: {
    id: 'factor_drop_bonus_10',
    factorDropBonusPercent: 10,
  },

  factor_drop_bonus_20: {
    id: 'factor_drop_bonus_20',
    factorDropBonusPercent: 20,
  },

  factor_drop_bonus_30: {
    id: 'factor_drop_bonus_30',
    factorDropBonusPercent: 30,
  },

  factor_drop_bonus_50: {
    id: 'factor_drop_bonus_50',
    factorDropBonusPercent: 50,
  },

  factor_drop_mult_1_2: {
    id: 'factor_drop_mult_1_2',
    factorDropMultiplier: 1.2,
  },

  factor_drop_mult_1_3: {
    id: 'factor_drop_mult_1_3',
    factorDropMultiplier: 1.3,
  },

  factor_drop_mult_1_5: {
    id: 'factor_drop_mult_1_5',
    factorDropMultiplier: 1.5,
  },

  gold_bonus_50: {
    id: 'gold_bonus_50',
    goldBonusPercent: 50,
  },

  party_rare_mult_1_05: createPartyRareMultiplierSkill(1.05),
  party_rare_mult_1_1: createPartyRareMultiplierSkill(1.1),
  party_rare_mult_1_25: createPartyRareMultiplierSkill(1.25),
  party_rare_mult_1_3: createPartyRareMultiplierSkill(1.3),
  party_rare_mult_1_5: createPartyRareMultiplierSkill(1.5),
  party_title_mult_1_05: createPartyTitleMultiplierSkill(1.05),
  party_title_mult_1_1: createPartyTitleMultiplierSkill(1.1),
  party_title_mult_1_25: createPartyTitleMultiplierSkill(1.25),
  party_title_mult_1_3: createPartyTitleMultiplierSkill(1.3),
  party_title_mult_1_5: createPartyTitleMultiplierSkill(1.5),

  light_footed_4_5: {
    id: 'light_footed_4_5',
    expeditionTimeMultiplier: 4 / 5,
    descriptionKey: 'entities.skill.light_footed_4_5.description',
  },

  beast_slayer_1_2: createRaceSlayerSkill('beast', 1.2),
  beast_slayer_1_5: createRaceSlayerSkill('beast', 1.5),
  beast_slayer_2_0: createRaceSlayerSkill('beast', 2.0),
  undead_slayer_1_2: createRaceSlayerSkill('undead', 1.2),
  undead_slayer_1_5: createRaceSlayerSkill('undead', 1.5),
  undead_slayer_2_0: createRaceSlayerSkill('undead', 2.0),
  human_slayer_1_2: createRaceSlayerSkill('human', 1.2),
  human_slayer_1_5: createRaceSlayerSkill('human', 1.5),
  human_slayer_2_0: createRaceSlayerSkill('human', 2.0),
  demon_race_slayer_1_2: createRaceSlayerSkill('demon_race', 1.2),
  demon_race_slayer_1_5: createRaceSlayerSkill('demon_race', 1.5),
  demon_race_slayer_2_0: createRaceSlayerSkill('demon_race', 2.0),
  dragon_slayer_1_2: createRaceSlayerSkill('dragon', 1.2),
  dragon_slayer_1_5: createRaceSlayerSkill('dragon', 1.5),
  dragon_slayer_2_0: createRaceSlayerSkill('dragon', 2.0),
  fireball_taken_0_6: createSpellTakenSkill('fireball', 0.6),
  fireball_taken_1_5: createSpellTakenSkill('fireball', 1.5),
  fireball_taken_2_0: createSpellTakenSkill('fireball', 2.0),
  magic_arrow_taken_0_6: createSpellTakenSkill('magic_arrow', 0.6),
  magic_arrow_taken_1_5: createSpellTakenSkill('magic_arrow', 1.5),
  magic_arrow_taken_2_0: createSpellTakenSkill('magic_arrow', 2.0),
  blizzard_taken_0_6: createSpellTakenSkill('blizzard', 0.6),
  blizzard_taken_1_5: createSpellTakenSkill('blizzard', 1.5),
  blizzard_taken_2_0: createSpellTakenSkill('blizzard', 2.0),

  undead_trait: {
    id: 'undead_trait',
    undead: true,
  },

  hp_regen_20: {
    id: 'hp_regen_20',
    hpRegenPercent: 20,
  },

  hp_regen_flat_10: {
    id: 'hp_regen_flat_10',
    hpRegenAmount: 10,
  },

  recovery_magic_lv1: createRecoveryMagicSkill(1),
  recovery_magic_lv2: createRecoveryMagicSkill(2),
  recovery_magic_lv3: createRecoveryMagicSkill(3),
  recovery_magic_lv4: createRecoveryMagicSkill(4),
  recovery_magic_lv5: createRecoveryMagicSkill(5),
  recovery_magic_lv6: createRecoveryMagicSkill(6),
  recovery_magic_lv7: createRecoveryMagicSkill(7),

  mage_magic_lv1: createMageMagicSkill(1),
  mage_magic_lv2: createMageMagicSkill(2),
  mage_magic_lv3: createMageMagicSkill(3),
  mage_magic_lv4: createMageMagicSkill(4),
  mage_magic_lv5: createMageMagicSkill(5),
  mage_magic_lv6: createMageMagicSkill(6),
  mage_magic_lv7: createMageMagicSkill(7),

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
