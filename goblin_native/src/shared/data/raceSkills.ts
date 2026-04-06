import type { CharacterSkill } from '../types'
import { cloneCharacterSkills } from './characterSkills'

const CHARACTER_SKILL_LIBRARY: Record<string, CharacterSkill> = {
  slimeArmorMastery: {
    id: 'slime_armor_mastery',
    name: '[1.3倍]鎧装備',
    equipmentCategoryMultiplier: {
      armor: 1.3,
    },
  },
  rearGuard: {
    id: 'rear_guard',
    name: '後列防護',
    protectRearAllyNormalAttackMultiplier: 2 / 3,
  },
  wolfAttackCountUp: {
    id: 'wolf_attack_count_up',
    name: '[+2]攻撃回数アップ',
    statBonuses: {
      attackCount: 2,
    },
  },
  wolfAccuracyBoost: {
    id: 'wolf_accuracy_boost',
    name: '[2.0倍]命中精度',
    equipmentStatMultipliers: {
      accuracy_flat: 2,
      accuracy_percent: 2,
    },
  },
  wolfAdditionalDamage: {
    id: 'wolf_additional_damage',
    name: '[+13]追加ダメージ',
    additionalDamage: 13,
  },
}

const RACE_DEFAULT_SKILLS: Record<string, CharacterSkill[]> = {
  'スライムゴブリン': [
    CHARACTER_SKILL_LIBRARY.slimeArmorMastery,
    CHARACTER_SKILL_LIBRARY.rearGuard,
  ],
  'ウルフゴブリン': [
    CHARACTER_SKILL_LIBRARY.wolfAttackCountUp,
    CHARACTER_SKILL_LIBRARY.wolfAccuracyBoost,
    CHARACTER_SKILL_LIBRARY.wolfAdditionalDamage,
  ],
}

export function getDefaultSkillsForRace(race: string): CharacterSkill[] {
  return cloneCharacterSkills(RACE_DEFAULT_SKILLS[race] ?? [])
}
