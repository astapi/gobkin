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
    factorId: 'slime',
    factorName: 'スライム因子',
    factorDescription: 'スライムの特性を宿した因子。耐久性が増す。',
    inheritProbability: 0.3,
    factorEffects: [
      { type: 'stat_bonus', target: 'hp', value: 100 },
    ],
    variantProbability: 0.2,
    raceId: 'slime',
    raceName: 'スライムゴブリン',
    avatar: '/src/assets/goblin/slime_goblin.png',
    imageKey: 'slime_goblin',
    additionalEffects: [
      { type: 'stat_bonus', target: 'def', value: 20 },
    ],
    baseAttributes: { power: 8, wisdom: 8, spirit: 13, vitality: 13, agility: 8, luck: 10 },
    hpCoefficient: 1.2,
    combatStats: { attackCount: 2, accuracy: 20, evasion: 15 },
    defaultSkillIds: [
      'talent_hp_150',
      'armor_mastery_130',
      'rear_guard',
      'hp_regen_20',
    ],
  },
  wolf: {
    factorId: 'wolf',
    factorName: 'ウルフ因子',
    factorDescription: 'ウルフの特性を宿した因子。敏捷性が増す。',
    inheritProbability: 0.25,
    factorEffects: [
      { type: 'stat_bonus', target: 'atk', value: 15 },
    ],
    variantProbability: 0.15,
    raceId: 'wolf',
    raceName: 'ウルフゴブリン',
    avatar: '/src/assets/goblin/wolf_goblin.png',
    imageKey: 'wolf_goblin',
    additionalEffects: [],
    baseAttributes: { power: 11, wisdom: 9, spirit: 10, vitality: 10, agility: 13, luck: 12 },
    hpCoefficient: 0.9,
    combatStats: { attackCount: 3, accuracy: 20, evasion: 15 },
    defaultSkillIds: [
      'talent_accuracy_150',
      'attack_count_up_2',
      'equipment_accuracy_200',
      'additional_damage_13',
    ],
  },
  orc: {
    factorId: 'orc',
    factorName: 'オーク因子',
    factorDescription: 'オークの特性を宿した因子。攻撃力と防御力が増す。',
    inheritProbability: 0.2,
    factorEffects: [
      { type: 'stat_bonus', target: 'atk', value: 25 },
      { type: 'stat_bonus', target: 'def', value: 20 },
    ],
    variantProbability: 0.1,
    raceId: 'orc',
    raceName: 'オークゴブリン',
    avatar: '/src/assets/goblin/orc_goblin.png',
    imageKey: 'orc_goblin',
    additionalEffects: [
      { type: 'stat_bonus', target: 'hp', value: 50 },
      { type: 'stat_bonus', target: 'atk', value: 10 },
    ],
    baseAttributes: { power: 15, wisdom: 8, spirit: 9, vitality: 15, agility: 7, luck: 8 },
    hpCoefficient: 1.5,
    combatStats: { attackCount: 2, accuracy: 20, evasion: 15 },
    defaultSkillIds: [],
  },
  undead: {
    factorId: 'undead',
    factorName: 'アンデッド因子',
    factorDescription: 'アンデッドの特性を宿した因子。生命力と耐毒性が増す。',
    inheritProbability: 0.2,
    factorEffects: [
      { type: 'stat_bonus', target: 'hp', value: 80 },
      { type: 'stat_bonus', target: 'def', value: 15 },
    ],
    variantProbability: 0.15,
    raceId: 'undead',
    raceName: 'アンデッドゴブリン',
    avatar: '/src/assets/goblin/skelton_goblin.png',
    imageKey: 'skelton_goblin',
    additionalEffects: [
      { type: 'stat_bonus', target: 'hp', value: 40 },
      { type: 'stat_bonus', target: 'atk', value: 10 },
    ],
    baseAttributes: { power: 11, wisdom: 8, spirit: 10, vitality: 15, agility: 7, luck: 9 },
    defaultSkillIds: [
      'talent_itemSlots',
      'undead_trait',
      'hp_regen_20',
    ],
  },
  hobgoblin: {
    factorId: 'hobgoblin',
    factorName: 'ホブゴブリン因子',
    factorDescription: '上位ゴブリンの特性を宿した因子。全能力が底上げされる。',
    inheritProbability: 0.25,
    factorEffects: [
      { type: 'stat_bonus', target: 'atk', value: 15 },
      { type: 'stat_bonus', target: 'def', value: 10 },
    ],
    variantProbability: 0.2,
    raceId: 'hobgoblin',
    raceName: 'ホブゴブリン',
    avatar: '/src/assets/goblin/hobgoblin.png',
    imageKey: 'hobgoblin',
    additionalEffects: [
      { type: 'stat_bonus', target: 'hp', value: 30 },
      { type: 'stat_bonus', target: 'atk', value: 10 },
    ],
    baseAttributes: { power: 13, wisdom: 11, spirit: 11, vitality: 11, agility: 11, luck: 10 },
    hpCoefficient: 1.2,
    combatStats: { attackCount: 2, accuracy: 20, evasion: 15 },
    defaultSkillIds: [
      'talent_atk_150',
      'inspire_150',
      'survive_lethal_hp1',
    ],
  },
  dwarf: {
    factorId: 'dwarf',
    factorName: 'ドワーフ因子',
    factorDescription: 'ドワーフの特性を宿した因子。防御力と耐久性が大幅に増す。',
    inheritProbability: 0.2,
    factorEffects: [
      { type: 'stat_bonus', target: 'def', value: 30 },
      { type: 'stat_bonus', target: 'hp', value: 60 },
    ],
    variantProbability: 0.1,
    raceId: 'dwarf',
    raceName: 'ドワーフゴブリン',
    avatar: '/src/assets/goblin/dwarf_goblin.png',
    imageKey: 'dwarf_goblin',
    additionalEffects: [
      { type: 'stat_bonus', target: 'def', value: 20 },
      { type: 'stat_bonus', target: 'atk', value: 15 },
    ],
    defaultSkillIds: [],
  },
  elf: {
    factorId: 'elf',
    factorName: 'エルフ因子',
    factorDescription: 'エルフの特性を宿した因子。敏捷性と精神力が増す。',
    inheritProbability: 0.2,
    factorEffects: [
      { type: 'stat_bonus', target: 'def', value: 15 },
    ],
    variantProbability: 0.1,
    raceId: 'elf',
    raceName: 'エルフゴブリン',
    avatar: '/src/assets/goblin/elf_goblin.png',
    imageKey: 'elf_goblin',
    additionalEffects: [
      { type: 'stat_bonus', target: 'atk', value: 10 },
    ],
    defaultSkillIds: [],
  },
  lizardman: {
    factorId: 'lizardman',
    factorName: 'リザードマン因子',
    factorDescription: 'リザードマンの特性を宿した因子。全体的な耐性とHPが増す。',
    inheritProbability: 0.15,
    factorEffects: [
      { type: 'stat_bonus', target: 'hp', value: 70 },
      { type: 'stat_bonus', target: 'def', value: 20 },
      { type: 'stat_bonus', target: 'atk', value: 10 },
    ],
    variantProbability: 0.1,
    raceId: 'lizardman',
    raceName: 'リザードゴブリン',
    avatar: '/src/assets/goblin/lizard_goblin.png',
    imageKey: 'lizard_goblin',
    additionalEffects: [
      { type: 'stat_bonus', target: 'def', value: 15 },
    ],
    defaultSkillIds: [],
  },
  troll: {
    factorId: 'troll',
    factorName: 'トロル因子',
    factorDescription: 'トロルの特性を宿した因子。HPが大幅に増し、防御力も上がる。',
    inheritProbability: 0.15,
    factorEffects: [
      { type: 'stat_bonus', target: 'hp', value: 150 },
      { type: 'stat_bonus', target: 'def', value: 15 },
    ],
    variantProbability: 0.08,
    raceId: 'troll',
    raceName: 'トロルゴブリン',
    avatar: '/src/assets/goblin/troll_goblin.png',
    imageKey: 'troll_goblin',
    additionalEffects: [
      { type: 'stat_bonus', target: 'hp', value: 80 },
      { type: 'stat_bonus', target: 'atk', value: 20 },
    ],
    baseAttributes: { power: 16, wisdom: 7, spirit: 8, vitality: 18, agility: 5, luck: 7 },
    hpCoefficient: 1.7,
    combatStats: { attackCount: 2, accuracy: 20, evasion: 15 },
    defaultSkillIds: [],
  },
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
