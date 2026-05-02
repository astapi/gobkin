import type { GoblinBaseAttributes } from '../types'
import type { FactorEffect } from '../types/Factor'
import type { CharacterSkillId } from './skillCatalog'
import type { GoblinRaceId } from '../types/Race'
import { normalizeGoblinRaceId } from '../types/Race'

export interface GoblinVariantDefinition {
  factorId: string
  factorName: string
  factorDescription: string
  inheritProbability: number
  factorEffects: FactorEffect[]
  variantProbability: number
  raceId: GoblinRaceId
  raceName: string
  avatar: string
  imageKey: string
  baseAttributes?: GoblinBaseAttributes
  hpCoefficient?: number
  defaultSkillIds?: CharacterSkillId[]
}

export const BASE_GOBLIN_BASE_ATTRIBUTES: GoblinBaseAttributes = {
  power: 10,
  wisdom: 10,
  spirit: 10,
  vitality: 10,
  agility: 10,
  luck: 10,
}

export const BASE_GOBLIN_HP_COEFFICIENT = 0.8

export const goblinVariantDefinitions: Record<string, GoblinVariantDefinition> = {
  slime: {
    avatar: "/src/assets/goblin/slime_goblin.png",
    baseAttributes: {
      agility: 8,
      luck: 10,
      power: 8,
      spirit: 13,
      vitality: 13,
      wisdom: 8
    },
    defaultSkillIds: [
      "talent_hp_150",
      "armor_mastery_130",
      "rear_guard",
      "hp_regen_20"
    ],
    factorDescription: "スライムの特性を宿した因子。耐久性が増す。",
    factorEffects: [
      {
        target: "hp",
        type: "stat_bonus",
        value: 20
      }
    ],
    factorId: "slime",
    factorName: "スライム因子",
    hpCoefficient: 1.2,
    imageKey: "slime_goblin",
    inheritProbability: 0.3,
    raceId: "slime",
    raceName: "スライムゴブリン",
    variantProbability: 0.2
  },
  wolf: {
    avatar: "/src/assets/goblin/wolf_goblin.png",
    baseAttributes: {
      agility: 13,
      luck: 12,
      power: 11,
      spirit: 10,
      vitality: 10,
      wisdom: 9
    },
    defaultSkillIds: [
      "talent_accuracy_150",
      "attack_count_up_2",
      "equipment_accuracy_200",
      "additional_damage_13"
    ],
    factorDescription: "ウルフの特性を宿した因子。敏捷性が増す。",
    factorEffects: [
      {
        target: "atk",
        type: "stat_bonus",
        value: 10
      }
    ],
    factorId: "wolf",
    factorName: "ウルフ因子",
    hpCoefficient: 0.9,
    imageKey: "wolf_goblin",
    inheritProbability: 0.25,
    raceId: "wolf",
    raceName: "ウルフゴブリン",
    variantProbability: 0.15
  },
  orc: {
    avatar: "/src/assets/goblin/orc_goblin.png",
    baseAttributes: {
      agility: 7,
      luck: 8,
      power: 15,
      spirit: 9,
      vitality: 15,
      wisdom: 8
    },
    defaultSkillIds: [
      "talent_atk_150"
    ],
    factorDescription: "オークの特性を宿した因子。攻撃力と防御力が増す。",
    factorEffects: [
      {
        target: "atk",
        type: "stat_bonus",
        value: 20
      },
      {
        target: "def",
        type: "stat_bonus",
        value: 20
      }
    ],
    factorId: "orc",
    factorName: "オーク因子",
    hpCoefficient: 1.5,
    imageKey: "orc_goblin",
    inheritProbability: 0.2,
    raceId: "orc",
    raceName: "オークゴブリン",
    variantProbability: 0.1
  },
  undead: {
    avatar: "/src/assets/goblin/skelton_goblin.png",
    baseAttributes: {
      agility: 7,
      luck: 9,
      power: 11,
      spirit: 10,
      vitality: 15,
      wisdom: 8
    },
    defaultSkillIds: [
      "talent_itemSlots",
      "undead_trait",
      "hp_regen_20"
    ],
    factorDescription: "アンデッドの特性を宿した因子。生命力と耐毒性が増す。",
    factorEffects: [
      {
        target: "def",
        type: "stat_bonus",
        value: 15
      }
    ],
    factorId: "undead",
    factorName: "アンデッド因子",
    imageKey: "skelton_goblin",
    inheritProbability: 0.2,
    raceId: "undead",
    raceName: "アンデッドゴブリン",
    variantProbability: 0.15
  },
  hobgoblin: {
    avatar: "/src/assets/goblin/hobgoblin.png",
    baseAttributes: {
      agility: 11,
      luck: 10,
      power: 13,
      spirit: 11,
      vitality: 11,
      wisdom: 11
    },
    defaultSkillIds: [
      "talent_atk_150",
      "inspire_150",
      "survive_lethal_hp1",
      "goblin_binder"
    ],
    factorDescription: "上位ゴブリンの特性を宿した因子。全能力が底上げされる。",
    factorEffects: [
      {
        target: "atk",
        type: "stat_bonus",
        value: 5
      },
      {
        target: "def",
        type: "stat_bonus",
        value: 5
      }
    ],
    factorId: "hobgoblin",
    factorName: "ホブゴブリン因子",
    hpCoefficient: 1.2,
    imageKey: "hobgoblin",
    inheritProbability: 0.25,
    raceId: "hobgoblin",
    raceName: "ホブゴブリン",
    variantProbability: 0.2
  },
  dwarf: {
    avatar: "/src/assets/goblin/dwarf_goblin.png",
    defaultSkillIds: [],
    factorDescription: "ドワーフの特性を宿した因子。防御力と耐久性が大幅に増す。",
    factorEffects: [
      {
        target: "def",
        type: "stat_bonus",
        value: 30
      },
      {
        target: "hp",
        type: "stat_bonus",
        value: 60
      }
    ],
    factorId: "dwarf",
    factorName: "ドワーフ因子",
    imageKey: "dwarf_goblin",
    inheritProbability: 0.2,
    raceId: "dwarf",
    raceName: "アイアンゴブリン",
    variantProbability: 0.1
  },
  elf: {
    avatar: "/src/assets/goblin/elf_goblin.png",
    defaultSkillIds: [],
    factorDescription: "エルフの特性を宿した因子。敏捷性と精神力が増す。",
    factorEffects: [
      {
        target: "def",
        type: "stat_bonus",
        value: 15
      }
    ],
    factorId: "elf",
    factorName: "エルフ因子",
    imageKey: "elf_goblin",
    inheritProbability: 0.2,
    raceId: "elf",
    raceName: "フェイゴブリン",
    variantProbability: 0.1
  },
  harpy: {
    avatar: "/src/assets/goblin/goblin.png",
    baseAttributes: {
      agility: 16,
      luck: 12,
      power: 9,
      spirit: 12,
      vitality: 8,
      wisdom: 10
    },
    defaultSkillIds: [],
    factorDescription: "ハーピィの特性を宿した因子。回避力と魔法防御が増す。",
    factorEffects: [
      {
        target: "evasion",
        type: "stat_bonus",
        value: 15
      },
      {
        target: "magicDef",
        type: "stat_bonus",
        value: 15
      }
    ],
    factorId: "harpy",
    factorName: "ハーピィ因子",
    hpCoefficient: 0.85,
    imageKey: "goblin",
    inheritProbability: 0.15,
    raceId: "harpy",
    raceName: "スカイゴブリン",
    variantProbability: 0.08
  },
  hobbit: {
    avatar: "/src/assets/goblin/goblin_thief.png",
    baseAttributes: {
      agility: 13,
      luck: 16,
      power: 9,
      spirit: 10,
      vitality: 9,
      wisdom: 11
    },
    defaultSkillIds: [],
    factorDescription: "ホビットの特性を宿した因子。命中力と幸運に由来する器用さが増す。",
    factorEffects: [
      {
        target: "accuracy",
        type: "stat_bonus",
        value: 20
      },
      {
        target: "evasion",
        type: "stat_bonus",
        value: 10
      }
    ],
    factorId: "hobbit",
    factorName: "ホビット因子",
    hpCoefficient: 0.9,
    imageKey: "goblin_thief",
    inheritProbability: 0.15,
    raceId: "hobbit",
    raceName: "スクラッパーゴブリン",
    variantProbability: 0.08
  },
  lizardman: {
    avatar: "/src/assets/goblin/scale_goblin.png",
    defaultSkillIds: [
      "two_column_attack"
    ],
    factorDescription: "リザードマンの特性を宿した因子。全体的な耐性とHPが増す。",
    factorEffects: [
      {
        target: "hp",
        type: "stat_bonus",
        value: 70
      },
      {
        target: "def",
        type: "stat_bonus",
        value: 20
      },
      {
        target: "atk",
        type: "stat_bonus",
        value: 20
      }
    ],
    factorId: "lizardman",
    factorName: "リザードマン因子",
    imageKey: "scale_goblin",
    inheritProbability: 0.15,
    raceId: "lizardman",
    raceName: "スケイルゴブリン",
    variantProbability: 0.1
  },
  troll: {
    avatar: "/src/assets/goblin/troll_goblin.png",
    baseAttributes: {
      agility: 5,
      luck: 7,
      power: 16,
      spirit: 8,
      vitality: 18,
      wisdom: 7
    },
    defaultSkillIds: [],
    factorDescription: "トロルの特性を宿した因子。HPが大幅に増し、防御力も上がる。",
    factorEffects: [
      {
        target: "hp",
        type: "stat_bonus",
        value: 150
      },
      {
        target: "def",
        type: "stat_bonus",
        value: 25
      }
    ],
    factorId: "troll",
    factorName: "トロル因子",
    hpCoefficient: 1.7,
    imageKey: "troll_goblin",
    inheritProbability: 0.15,
    raceId: "troll",
    raceName: "トロルゴブリン",
    variantProbability: 0.08
  },
  minotaur: {
    avatar: "/src/assets/goblin/orc_goblin.png",
    baseAttributes: {
      agility: 6,
      luck: 8,
      power: 18,
      spirit: 8,
      vitality: 17,
      wisdom: 7
    },
    defaultSkillIds: [],
    factorDescription: "ミノタウロスの特性を宿した因子。攻撃力とHPが大きく増す。",
    factorEffects: [
      {
        target: "atk",
        type: "stat_bonus",
        value: 35
      },
      {
        target: "hp",
        type: "stat_bonus",
        value: 80
      }
    ],
    factorId: "minotaur",
    factorName: "ミノタウロス因子",
    hpCoefficient: 1.45,
    imageKey: "orc_goblin",
    inheritProbability: 0.12,
    raceId: "minotaur",
    raceName: "ゴズゴブリン",
    variantProbability: 0.06
  },
  vampire: {
    avatar: "/src/assets/goblin/goblin_mage.png",
    baseAttributes: {
      agility: 12,
      luck: 11,
      power: 10,
      spirit: 15,
      vitality: 11,
      wisdom: 16
    },
    defaultSkillIds: [],
    factorDescription: "ヴァンパイアの特性を宿した因子。魔力と生命力が増す。",
    factorEffects: [
      {
        target: "magicAtk",
        type: "stat_bonus",
        value: 30
      },
      {
        target: "hp",
        type: "stat_bonus",
        value: 60
      }
    ],
    factorId: "vampire",
    factorName: "ヴァンパイア因子",
    hpCoefficient: 1.05,
    imageKey: "goblin_mage",
    inheritProbability: 0.1,
    raceId: "vampire",
    raceName: "ヴァンプゴブリン",
    variantProbability: 0.05
  },
  dragon: {
    avatar: "/src/assets/goblin/scale_goblin.png",
    baseAttributes: {
      agility: 9,
      luck: 10,
      power: 18,
      spirit: 14,
      vitality: 18,
      wisdom: 12
    },
    defaultSkillIds: [],
    factorDescription: "ドラゴンの特性を宿した因子。攻防と生命力が大幅に増す。",
    factorEffects: [
      {
        target: "hp",
        type: "stat_bonus",
        value: 120
      },
      {
        target: "atk",
        type: "stat_bonus",
        value: 30
      },
      {
        target: "def",
        type: "stat_bonus",
        value: 30
      }
    ],
    factorId: "dragon",
    factorName: "ドラゴン因子",
    hpCoefficient: 1.6,
    imageKey: "scale_goblin",
    inheritProbability: 0.08,
    raceId: "dragon",
    raceName: "ドラゴンゴブリン",
    variantProbability: 0.04
  },
  shadow: {
    avatar: "/src/assets/goblin/goblin_thief.png",
    baseAttributes: {
      agility: 18,
      luck: 14,
      power: 12,
      spirit: 9,
      vitality: 8,
      wisdom: 10
    },
    defaultSkillIds: [
      "action_order_150",
      "attack_count_up_1",
      "evasion_up_30",
      "critical_rate_up_10"
    ],
    factorDescription: "猫獣人の影を宿した因子。素早さと連撃性能、回避能力が高まる。",
    factorEffects: [
      {
        target: "atk",
        type: "stat_bonus",
        value: 18
      },
      {
        target: "attackCount",
        type: "stat_bonus",
        value: 1
      },
      {
        target: "evasion",
        type: "stat_bonus",
        value: 20
      }
    ],
    factorId: "shadow",
    factorName: "影猫因子",
    hpCoefficient: 0.85,
    imageKey: "goblin_thief",
    inheritProbability: 0.18,
    raceId: "shadow",
    raceName: "シャドウゴブリン",
    variantProbability: 0.12
  }
}

export function getGoblinVariantByFactorId(factorId: string): GoblinVariantDefinition | undefined {
  return goblinVariantDefinitions[factorId]
}

export function getGoblinVariantByRaceId(raceId: string): GoblinVariantDefinition | undefined {
  const normalizedRaceId = normalizeGoblinRaceId(raceId)
  return Object.values(goblinVariantDefinitions).find((variant) => variant.raceId === normalizedRaceId)
}

export function getGoblinVariantByRace(race: string): GoblinVariantDefinition | undefined {
  return getGoblinVariantByRaceId(race)
}
