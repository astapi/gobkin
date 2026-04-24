import type { GoblinBaseAttributes } from '../types'
import type { FactorEffect } from '../types/Factor'
import type { CharacterSkillId } from './skillCatalog'
import type { GoblinRaceId } from '../types/Race'
import { normalizeGoblinRaceId } from '../types/Race'

export interface GoblinCombatStats {
  attackCount: number
  accuracy: number
  evasion: number
}

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
  additionalEffects: FactorEffect[]
  baseAttributes?: GoblinBaseAttributes
  hpCoefficient?: number
  combatStats?: GoblinCombatStats
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

export const DEFAULT_GOBLIN_COMBAT_STATS: GoblinCombatStats = {
  attackCount: 2,
  accuracy: 20,
  evasion: 15,
}

export const goblinVariantDefinitions: Record<string, GoblinVariantDefinition> = {
  slime: {
    additionalEffects: [
      {
        target: "def",
        type: "stat_bonus",
        value: 20
      }
    ],
    avatar: "/src/assets/goblin/slime_goblin.png",
    baseAttributes: {
      agility: 8,
      luck: 10,
      power: 8,
      spirit: 13,
      vitality: 13,
      wisdom: 8
    },
    combatStats: {
      accuracy: 20,
      attackCount: 2,
      evasion: 15
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
        value: 100
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
    additionalEffects: [],
    avatar: "/src/assets/goblin/wolf_goblin.png",
    baseAttributes: {
      agility: 13,
      luck: 12,
      power: 11,
      spirit: 10,
      vitality: 10,
      wisdom: 9
    },
    combatStats: {
      accuracy: 20,
      attackCount: 3,
      evasion: 15
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
        value: 15
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
    additionalEffects: [
      {
        target: "hp",
        type: "stat_bonus",
        value: 50
      },
      {
        target: "atk",
        type: "stat_bonus",
        value: 10
      }
    ],
    avatar: "/src/assets/goblin/orc_goblin.png",
    baseAttributes: {
      agility: 7,
      luck: 8,
      power: 15,
      spirit: 9,
      vitality: 15,
      wisdom: 8
    },
    combatStats: {
      accuracy: 20,
      attackCount: 2,
      evasion: 15
    },
    defaultSkillIds: [],
    factorDescription: "オークの特性を宿した因子。攻撃力と防御力が増す。",
    factorEffects: [
      {
        target: "atk",
        type: "stat_bonus",
        value: 25
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
    additionalEffects: [
      {
        target: "hp",
        type: "stat_bonus",
        value: 40
      },
      {
        target: "atk",
        type: "stat_bonus",
        value: 10
      }
    ],
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
        target: "hp",
        type: "stat_bonus",
        value: 80
      },
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
    additionalEffects: [
      {
        target: "hp",
        type: "stat_bonus",
        value: 30
      },
      {
        target: "atk",
        type: "stat_bonus",
        value: 10
      }
    ],
    avatar: "/src/assets/goblin/hobgoblin.png",
    baseAttributes: {
      agility: 11,
      luck: 10,
      power: 13,
      spirit: 11,
      vitality: 11,
      wisdom: 11
    },
    combatStats: {
      accuracy: 20,
      attackCount: 2,
      evasion: 15
    },
    defaultSkillIds: [
      "talent_atk_150",
      "inspire_150",
      "survive_lethal_hp1"
    ],
    factorDescription: "上位ゴブリンの特性を宿した因子。全能力が底上げされる。",
    factorEffects: [
      {
        target: "atk",
        type: "stat_bonus",
        value: 15
      },
      {
        target: "def",
        type: "stat_bonus",
        value: 10
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
    additionalEffects: [
      {
        target: "def",
        type: "stat_bonus",
        value: 20
      },
      {
        target: "atk",
        type: "stat_bonus",
        value: 15
      }
    ],
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
    raceName: "ドワーフゴブリン",
    variantProbability: 0.1
  },
  elf: {
    additionalEffects: [
      {
        target: "atk",
        type: "stat_bonus",
        value: 10
      }
    ],
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
    raceName: "エルフゴブリン",
    variantProbability: 0.1
  },
  lizardman: {
    additionalEffects: [
      {
        target: "def",
        type: "stat_bonus",
        value: 15
      }
    ],
    avatar: "/src/assets/goblin/lizard_goblin.png",
    defaultSkillIds: [],
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
        value: 10
      }
    ],
    factorId: "lizardman",
    factorName: "リザードマン因子",
    imageKey: "lizard_goblin",
    inheritProbability: 0.15,
    raceId: "lizardman",
    raceName: "リザードゴブリン",
    variantProbability: 0.1
  },
  troll: {
    additionalEffects: [
      {
        target: "hp",
        type: "stat_bonus",
        value: 80
      },
      {
        target: "atk",
        type: "stat_bonus",
        value: 20
      }
    ],
    avatar: "/src/assets/goblin/troll_goblin.png",
    baseAttributes: {
      agility: 5,
      luck: 7,
      power: 16,
      spirit: 8,
      vitality: 18,
      wisdom: 7
    },
    combatStats: {
      accuracy: 20,
      attackCount: 2,
      evasion: 15
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
        value: 15
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
