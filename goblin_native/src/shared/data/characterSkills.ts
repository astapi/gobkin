import type {
  CharacterSkill,
  EquipmentCategory,
  EquipmentEffect,
  EquipmentStat,
  EquipmentStatBonus,
  GoblinStats,
  LearnedSpell,
} from '../types'

export function cloneCharacterSkill(skill: CharacterSkill): CharacterSkill {
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
  if (skill.coverLowHpAlly) {
    return 'HPが半分以下の味方への通常攻撃を代わりに受ける'
  }

  if (skill.surviveLethalDamageAtHp1) {
    return 'HPが0になる攻撃を受けてもHP1で耐える'
  }

  if (skill.physicalDamageReductionPercent !== undefined) {
    return `[-${skill.physicalDamageReductionPercent}%] 物理ダメージ軽減(%)`
  }

  if (skill.rearAllyDamageMultiplier !== undefined) {
    return `自分より後列の仲間のダメージが×${skill.rearAllyDamageMultiplier.toFixed(1)}`
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

  if (skill.statMultipliers?.spd !== undefined) {
    return `SPDが×${skill.statMultipliers.spd.toFixed(1)}`
  }

  if (skill.statMultipliers?.evasion !== undefined) {
    return `回避が×${skill.statMultipliers.evasion.toFixed(1)}`
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

export function getSkillStatMultipliers(skills: CharacterSkill[]): Partial<Record<keyof GoblinStats, number>> {
  const multipliers: Partial<Record<keyof GoblinStats, number>> = {}

  for (const skill of getUniqueSkillsById(skills)) {
    for (const [key, value] of Object.entries(skill.statMultipliers ?? {})) {
      if (value === undefined) continue
      const statKey = key as keyof GoblinStats
      multipliers[statKey] = (multipliers[statKey] ?? 1) * value
    }
  }

  return multipliers
}

export function getAdditionalDamageFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce((sum, skill) => sum + (skill.additionalDamage ?? 0), 0)
}

const MELEE_ROW_DAMAGE_MULTIPLIERS = [1.0, 0.85, 0.72, 0.61, 0.52, 0.44] as const
const RANGED_ROW_DAMAGE_MULTIPLIERS = [...MELEE_ROW_DAMAGE_MULTIPLIERS].reverse() as readonly number[]
const BOTH_RANGE_ROW_DAMAGE_MULTIPLIER = 0.44

export function getRowDamageMultiplierFromSkills(skills: CharacterSkill[], row: number): number {
  const uniqueSkills = getUniqueSkillsById(skills)
  const hasMelee = uniqueSkills.some((skill) => skill.enablesMeleeRowDamagePenalty)
  const hasRanged = uniqueSkills.some((skill) => skill.enablesRangedRowDamagePenalty)

  if (hasMelee && hasRanged) {
    return BOTH_RANGE_ROW_DAMAGE_MULTIPLIER
  }

  if (!hasMelee && !hasRanged) {
    return 1
  }

  const clampedRow = Math.max(0, Math.min(row, MELEE_ROW_DAMAGE_MULTIPLIERS.length - 1))
  return hasMelee
    ? MELEE_ROW_DAMAGE_MULTIPLIERS[clampedRow]
    : RANGED_ROW_DAMAGE_MULTIPLIERS[clampedRow]
}

export function getRearProtectionMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.protectRearAllyNormalAttackMultiplier ?? 1),
    1,
  )
}

export function getRearAllyDamageMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.rearAllyDamageMultiplier ?? 1),
    1,
  )
}

export function hasCoverLowHpAllySkill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.coverLowHpAlly)
}

export function hasSurviveLethalDamageAtHp1Skill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.surviveLethalDamageAtHp1)
}

export function getPhysicalDamageReductionFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.physicalDamageReductionPercent ?? 0),
    0,
  )
}

export function getLearnedSpellsFromSkills(skills: CharacterSkill[]): LearnedSpell[] {
  const spellMap = new Map<string, LearnedSpell>()

  for (const skill of getUniqueSkillsById(skills)) {
    if (!skill.grantsSpellId) continue
    if (!spellMap.has(skill.grantsSpellId)) {
      spellMap.set(skill.grantsSpellId, { spellId: skill.grantsSpellId })
    }
  }

  for (const skill of getUniqueSkillsById(skills)) {
    if (!skill.spellChargeBonusForId || !skill.extraSpellCharges) continue
    const spell = spellMap.get(skill.spellChargeBonusForId)
    if (!spell) continue
    spell.extraCharges = (spell.extraCharges ?? 0) + skill.extraSpellCharges
  }

  return [...spellMap.values()]
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
