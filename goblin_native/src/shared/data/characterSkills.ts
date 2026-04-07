import type {
  CharacterSkill,
  EquipmentCategory,
  EquipmentEffect,
  EquipmentStat,
  EquipmentStatBonus,
  GoblinStats,
} from '../types'

export function cloneCharacterSkill(skill: CharacterSkill): CharacterSkill {
  return {
    ...skill,
    statBonuses: skill.statBonuses ? { ...skill.statBonuses } : undefined,
    equipmentCategoryMultiplier: skill.equipmentCategoryMultiplier
      ? { ...skill.equipmentCategoryMultiplier }
      : undefined,
    equipmentStatMultipliers: skill.equipmentStatMultipliers
      ? { ...skill.equipmentStatMultipliers }
      : undefined,
  }
}

export function cloneCharacterSkills(skills: CharacterSkill[]): CharacterSkill[] {
  return skills.map(cloneCharacterSkill)
}

export function getUniqueSkillsById(skills: CharacterSkill[]): CharacterSkill[] {
  const seen = new Set<string>()

  return skills.filter((skill) => {
    if (seen.has(skill.id)) {
      return false
    }
    seen.add(skill.id)
    return true
  })
}

export function describeCharacterSkill(skill: CharacterSkill): string {
  if (skill.physicalDamageReductionPercent !== undefined) {
    return `[-${skill.physicalDamageReductionPercent}%] 物理ダメージ軽減(%)`
  }

  if (skill.additionalDamage !== undefined) {
    return `通常攻撃の各ヒットに固定で+${skill.additionalDamage}`
  }

  if (skill.protectRearAllyNormalAttackMultiplier !== undefined) {
    const reducedRate = Math.round((1 - skill.protectRearAllyNormalAttackMultiplier) * 100)
    return `自分より後列の仲間が受ける通常攻撃ダメージを${reducedRate}%軽減`
  }

  if (skill.equipmentCategoryMultiplier?.armor !== undefined) {
    return `鎧カテゴリ装備の能力値が×${skill.equipmentCategoryMultiplier.armor.toFixed(1)}`
  }

  if (skill.equipmentStatMultipliers?.accuracy_flat !== undefined) {
    return `装備由来の命中精度補正が×${skill.equipmentStatMultipliers.accuracy_flat.toFixed(1)}`
  }

  if (skill.statBonuses?.attackCount !== undefined) {
    return `[+${skill.statBonuses.attackCount}]攻撃回数`
  }

  return skill.name
}

export function getSkillStatBonuses(skills: CharacterSkill[]): Partial<Record<keyof GoblinStats, number>> {
  const bonuses: Partial<Record<keyof GoblinStats, number>> = {}

  for (const skill of getUniqueSkillsById(skills)) {
    for (const [key, value] of Object.entries(skill.statBonuses ?? {})) {
      const statKey = key as keyof GoblinStats
      bonuses[statKey] = (bonuses[statKey] ?? 0) + (value ?? 0)
    }
  }

  return bonuses
}

export function getAdditionalDamageFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce((sum, skill) => sum + (skill.additionalDamage ?? 0), 0)
}

export function getRearProtectionMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.protectRearAllyNormalAttackMultiplier ?? 1),
    1,
  )
}

export function getPhysicalDamageReductionFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.physicalDamageReductionPercent ?? 0),
    0,
  )
}

function getEquipmentValueMultiplier(
  skills: CharacterSkill[],
  category: EquipmentCategory | undefined,
  stat: EquipmentStat | undefined,
): number {
  return getUniqueSkillsById(skills).reduce((product, skill) => {
    let next = product

    if (category) {
      next *= skill.equipmentCategoryMultiplier?.[category] ?? 1
    }

    if (stat) {
      next *= skill.equipmentStatMultipliers?.[stat] ?? 1
    }

    return next
  }, 1)
}

export function applySkillBonusesToEquipmentBonuses(
  skills: CharacterSkill[],
  bonuses: EquipmentStatBonus[],
): EquipmentStatBonus[] {
  return bonuses.map((bonus) => ({
    ...bonus,
    value: bonus.value * getEquipmentValueMultiplier(skills, bonus.sourceCategory, bonus.stat),
  }))
}

export function applySkillBonusesToEquipmentEffects(
  skills: CharacterSkill[],
  effects: EquipmentEffect[],
): EquipmentEffect[] {
  return effects.map((effect) => {
    const statKey = effect.type === 'accuracy_boost' ? 'accuracy_flat' : undefined
    return {
      ...effect,
      value: effect.value * getEquipmentValueMultiplier(skills, effect.sourceCategory, statKey),
    }
  })
}
