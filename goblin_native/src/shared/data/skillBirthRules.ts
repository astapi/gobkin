import type { CharacterSkillId } from './skillCatalog'

export interface BirthSkillLotteryEntry {
  skillId: CharacterSkillId
  probability: number
}

export interface FactorSkillInheritanceRule {
  factorId: string
  skills: BirthSkillLotteryEntry[]
}

export interface PureGoblinSkillManifestationRule {
  baseRank: number
  skills: BirthSkillLotteryEntry[]
}

export const PURE_GOBLIN_BIRTH_SKILL_SLOT_MAX = 4

export const factorSkillInheritanceRules: Record<string, FactorSkillInheritanceRule> = {
  slime: {
    factorId: "slime",
    skills: [
      {
        skillId: "talent_hp_150",
        probability: 0.12
      },
      {
        skillId: "armor_mastery_130",
        probability: 0.1
      },
      {
        skillId: "rear_guard",
        probability: 0.08
      },
      {
        skillId: "hp_regen_10",
        probability: 0.08
      }
    ]
  },
  wolf: {
    factorId: "wolf",
    skills: [
      {
        skillId: "talent_accuracy_150",
        probability: 0.12
      },
      {
        skillId: "attack_count_up_2",
        probability: 0.08
      },
      {
        skillId: "equipment_accuracy_200",
        probability: 0.08
      },
      {
        skillId: "additional_damage_13",
        probability: 0.08
      }
    ]
  },
  orc: {
    factorId: "orc",
    skills: [
      {
        skillId: "talent_atk_150",
        probability: 0.12
      }
    ]
  },
  undead: {
    factorId: "undead",
    skills: [
      {
        skillId: "talent_itemSlots",
        probability: 0.05
      },
      {
        skillId: "undead_trait",
        probability: 0.08
      },
      {
        skillId: "hp_regen_20",
        probability: 0.08
      }
    ]
  },
  hobgoblin: {
    factorId: "hobgoblin",
    skills: [
      {
        skillId: "talent_atk_150",
        probability: 0.12
      },
      {
        skillId: "inspire_150",
        probability: 0.08
      },
      {
        skillId: "survive_lethal_hp1",
        probability: 0.06
      },
      {
        skillId: "goblin_binder",
        probability: 0.06
      }
    ]
  },
  lizardman: {
    factorId: "lizardman",
    skills: [
      {
        skillId: "two_column_attack",
        probability: 0.08
      }
    ]
  },
  shadow: {
    factorId: "shadow",
    skills: [
      {
        skillId: "action_order_150",
        probability: 0.08
      },
      {
        skillId: "attack_count_up_1",
        probability: 0.08
      },
      {
        skillId: "evasion_up_30",
        probability: 0.08
      },
      {
        skillId: "critical_rate_up_10",
        probability: 0.08
      }
    ]
  }
}

export const pureGoblinSkillManifestationRules: PureGoblinSkillManifestationRule[] = [
  {
    baseRank: 1,
    skills: [
      {
        skillId: "base_power_up_2",
        probability: 0.04
      },
      {
        skillId: "base_power_up_1",
        probability: 0.04
      },
      {
        skillId: "base_wisdom_up_1",
        probability: 0.04
      },
      {
        skillId: "base_spirit_up_1",
        probability: 0.04
      },
      {
        skillId: "base_vitality_up_1",
        probability: 0.04
      },
      {
        skillId: "base_agility_up_1",
        probability: 0.04
      },
      {
        skillId: "base_luck_up_1",
        probability: 0.04
      },
      {
        skillId: "base_vitality_up_2",
        probability: 0.04
      },
      {
        skillId: "evasion_up_20",
        probability: 0.03
      },
      {
        skillId: "talent_accuracy_150",
        probability: 0.025
      },
      {
        skillId: "talent_def_150",
        probability: 0.025
      },
      {
        skillId: "talent_hp_150",
        probability: 0.025
      },
      {
        skillId: "talent_attackCount_150",
        probability: 0.025
      }
    ]
  },
  {
    baseRank: 2,
    skills: [
      {
        skillId: "talent_atk_150",
        probability: 0.025
      },
      {
        skillId: "talent_hp_150",
        probability: 0.025
      },
      {
        skillId: "critical_rate_up_10",
        probability: 0.025
      }
    ]
  },
  {
    baseRank: 3,
    skills: [
      {
        skillId: "physical_damage_10",
        probability: 0.025
      },
      {
        skillId: "physical_reduction_5",
        probability: 0.025
      },
      {
        skillId: "hp_regen_flat_10",
        probability: 0.02
      }
    ]
  },
  {
    baseRank: 4,
    skills: [
      {
        skillId: "attack_count_up_1",
        probability: 0.018
      },
      {
        skillId: "action_order_150",
        probability: 0.018
      },
      {
        skillId: "evasion_up_30",
        probability: 0.018
      }
    ]
  },
  {
    baseRank: 5,
    skills: [
      {
        skillId: "survive_lethal_hp1",
        probability: 0.015
      },
      {
        skillId: "cover_low_hp_ally",
        probability: 0.015
      },
      {
        skillId: "critical_damage_bonus_12",
        probability: 0.015
      }
    ]
  },
  {
    baseRank: 6,
    skills: [
      {
        skillId: "two_column_attack",
        probability: 0.012
      },
      {
        skillId: "instant_revive",
        probability: 0.01
      },
      {
        skillId: "party_rare_mult_1_25",
        probability: 0.01
      }
    ]
  },
  {
    baseRank: 7,
    skills: [
      {
        skillId: "attack_count_up_2",
        probability: 0.008
      },
      {
        skillId: "two_actions",
        probability: 0.006
      },
      {
        skillId: "party_title_mult_1_25",
        probability: 0.01
      }
    ]
  }
]
