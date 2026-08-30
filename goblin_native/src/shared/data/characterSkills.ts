import type {
  CharacterSkill,
  EquipmentCategory,
  EquipmentStat,
  EquipmentStatBonus,
  GoblinBaseAttributes,
  GoblinStats,
  LearnedSpell,
} from '../types'
import i18n from '../i18n'
import { getSkillDescription, getSkillLabel } from '../i18n/entityLocalization'
import { getRecoveryMagicSpellIds } from './recoveryMagic'
import { getMageMagicSpellIds } from './mageMagic'

const FRACTION_LABELS: ReadonlyArray<readonly [number, string]> = [
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [1 / 2, '1/2'],
  [2 / 5, '2/5'],
  [3 / 5, '3/5'],
  [3 / 4, '3/4'],
  [2 / 3, '2/3'],
  [4 / 5, '4/5'],
]

const BASE_ATTRIBUTE_ORDER: ReadonlyArray<keyof GoblinBaseAttributes> = [
  'power',
  'wisdom',
  'spirit',
  'vitality',
  'agility',
  'luck',
]

function formatMultiplierFraction(value: number): string {
  return FRACTION_LABELS.find(([multiplier]) => Math.abs(multiplier - value) < 0.000001)?.[1]
    ?? value.toFixed(2)
}

export function cloneCharacterSkill(skill: CharacterSkill): CharacterSkill {
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
    spellDamageMultipliers: skill.spellDamageMultipliers
      ? { ...skill.spellDamageMultipliers }
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

export function cloneCharacterSkills(skills: CharacterSkill[]): CharacterSkill[] {
  return skills.map(cloneCharacterSkill)
}

export function getUniqueSkillsById(skills: CharacterSkill[]): CharacterSkill[] {
  const seen = new Set<string>()

  return skills.filter((skill) => {
    if (skill.isEquipmentModEffect) {
      return true
    }
    if (seen.has(skill.id)) {
      return false
    }
    seen.add(skill.id)
    return true
  })
}

function getMultiplierWithAdditiveEquipmentMods(
  skills: CharacterSkill[],
  getMultiplier: (skill: CharacterSkill) => number | undefined,
): number {
  let skillMultiplier = 1
  let modBonus = 0

  for (const skill of getUniqueSkillsById(skills)) {
    const multiplier = getMultiplier(skill)
    if (multiplier === undefined) continue
    if (skill.isEquipmentModEffect) {
      modBonus += multiplier - 1
    } else {
      skillMultiplier *= multiplier
    }
  }

  return skillMultiplier * (1 + modBonus)
}

export function describeCharacterSkill(skill: CharacterSkill): string {
  if (skill.actionOrderMultiplier !== undefined) {
    if (skill.actionOrderMultiplier === 2) {
      return i18n.t('battle.actionOrderFast2')
    }
    if (skill.actionOrderMultiplier === 1.5) {
      return i18n.t('battle.actionOrderFast15')
    }
    if (skill.actionOrderMultiplier === 2 / 3) {
      return i18n.t('battle.actionOrderSlow23')
    }
    if (skill.actionOrderMultiplier === 0.5) {
      return i18n.t('battle.actionOrderSlow05')
    }
    return i18n.t('battle.actionOrderGeneric', { value: skill.actionOrderMultiplier.toFixed(2) })
  }

  if (skill.coverLowHpAlly) {
    return i18n.t('battle.coverLowHp')
  }

  if (skill.twoColumnAttack) {
    return i18n.t('battle.twoColumnAttack')
  }

  if (skill.actTwicePerTurn) {
    return i18n.t('battle.actTwicePerTurn')
  }

  if (skill.recoverRandomUsedSpellOnDefend) {
    return i18n.t('battle.recoverRandomUsedSpellOnDefend')
  }

  if (skill.immediateReviveOnAllyDeath) {
    return i18n.t('battle.immediateRevive')
  }

  if (skill.magicDamageFollowUp) {
    return i18n.t('battle.magicDamageFollowUp', {
      attackCount: skill.magicDamageFollowUp.attackCountMultiplier.toFixed(1),
      criticalRate: skill.magicDamageFollowUp.criticalRateMultiplier.toFixed(1),
    })
  }

  if (skill.criticalAttackFollowUp) {
    return i18n.t('battle.criticalAttackFollowUp', {
      attackCount: skill.criticalAttackFollowUp.attackCountMultiplier.toFixed(1),
      criticalRate: skill.criticalAttackFollowUp.criticalRateMultiplier.toFixed(1),
    })
  }

  if (skill.physicalCounterAttack) {
    return i18n.t('battle.physicalCounterAttack', {
      attackCount: skill.physicalCounterAttack.attackCountMultiplier.toFixed(1),
      criticalRate: skill.physicalCounterAttack.criticalRateMultiplier.toFixed(1),
    })
  }

  if (skill.counterAttackAvoidanceRate !== undefined) {
    return i18n.t('battle.counterAttackAvoidance', {
      value: formatMultiplierFraction(skill.counterAttackAvoidanceRate),
    })
  }

  if (skill.pureGoblinPartyStatBonusPercent !== undefined) {
    return i18n.t('battle.pureGoblinPartyStatBonus', {
      value: skill.pureGoblinPartyStatBonusPercent,
      level: skill.pureGoblinPartyStatBonusMinLevel ?? 1,
    })
  }

  if (skill.surviveLethalDamageAtHp1) {
    return i18n.t('battle.surviveLethal')
  }

  if (skill.physicalDamageReductionPercent !== undefined) {
    return i18n.t('battle.physicalReduction', { value: skill.physicalDamageReductionPercent })
  }

  if (skill.rangedAttackDamageReductionPercent !== undefined) {
    return i18n.t('battle.rangedAttackReduction', { value: skill.rangedAttackDamageReductionPercent })
  }

  if (skill.physicalDamageTakenMultiplier !== undefined) {
    return i18n.t('battle.attackResistant', {
      value: formatMultiplierFraction(skill.physicalDamageTakenMultiplier),
    })
  }

  if (skill.magicDamageReductionPercent !== undefined) {
    return i18n.t('battle.magicReduction', { value: skill.magicDamageReductionPercent })
  }

  if (skill.magicDamageTakenMultiplier !== undefined) {
    return i18n.t('battle.magicResistant', {
      value: formatMultiplierFraction(skill.magicDamageTakenMultiplier),
    })
  }

  if (skill.breathDamageMultiplier !== undefined) {
    return i18n.t('battle.breathDamageMultiplier', { value: skill.breathDamageMultiplier === 0.8 ? '4/5' : skill.breathDamageMultiplier.toFixed(2) })
  }

  if (skill.breathDamageReductionPercent !== undefined) {
    return i18n.t('battle.breathReduction', { value: skill.breathDamageReductionPercent })
  }

  if (skill.physicalDamagePercent !== undefined) {
    return i18n.t('battle.physicalDamagePercent', { value: skill.physicalDamagePercent })
  }

  if (skill.spellDamagePercent !== undefined) {
    return i18n.t('battle.spellDamagePercent', { value: skill.spellDamagePercent })
  }

  for (const [spellId, value] of Object.entries(skill.spellDamageMultipliers ?? {})) {
    if (value !== undefined) {
      return i18n.t('battle.spellDamageMultiplier', {
        spell: i18n.t(`entities.spell.${spellId}`, { defaultValue: spellId }),
        value: value.toFixed(1),
      })
    }
  }

  if (skill.partyMagicDamageMultiplier !== undefined) {
    return i18n.t('battle.partyMagicDamageMultiplier', { value: skill.partyMagicDamageMultiplier.toFixed(1) })
  }

  if (skill.rearAllyDamageMultiplier !== undefined) {
    return i18n.t('battle.rearAllyDamage', { value: skill.rearAllyDamageMultiplier.toFixed(1) })
  }

  if (skill.additionalDamage !== undefined) {
    return i18n.t('battle.additionalDamage', { value: skill.additionalDamage })
  }

  if (skill.defToHpPercent !== undefined) {
    return i18n.t('battle.defToHp', { value: skill.defToHpPercent })
  }

  if (skill.magicHealToHpPercent !== undefined) {
    return i18n.t('battle.magicHealToHp', { value: skill.magicHealToHpPercent })
  }

  if (skill.criticalRateBonusPercent !== undefined) {
    return i18n.t('battle.criticalRateBonus', { value: skill.criticalRateBonusPercent })
  }

  if (skill.criticalDamageBonusPercent !== undefined) {
    return i18n.t('battle.criticalDamageBonus', { value: skill.criticalDamageBonusPercent })
  }

  if (skill.expBonusPercent !== undefined) {
    return i18n.t('battle.expBonus', { value: skill.expBonusPercent })
  }

  if (skill.expMultiplier !== undefined) {
    return i18n.t('battle.expMultiplier', { value: skill.expMultiplier.toFixed(2) })
  }

  if (skill.factorDropBonusPercent !== undefined) {
    return i18n.t('battle.factorDropBonus', { value: skill.factorDropBonusPercent })
  }

  if (skill.factorDropMultiplier !== undefined) {
    return i18n.t('battle.factorDropMultiplier', { value: skill.factorDropMultiplier.toFixed(1) })
  }

  if (skill.goldBonusPercent !== undefined) {
    return i18n.t('battle.goldBonus', { value: skill.goldBonusPercent })
  }

  if (skill.goldMultiplier !== undefined) {
    return i18n.t('battle.goldMultiplier', { value: skill.goldMultiplier.toFixed(2) })
  }

  if (skill.partyRareMultiplier !== undefined) {
    return i18n.t('battle.partyRareMultiplier', { value: skill.partyRareMultiplier.toFixed(2) })
  }

  if (skill.partyTitleBonusPercent !== undefined) {
    return i18n.t('battle.partyTitleBonus', { value: skill.partyTitleBonusPercent })
  }

  if (skill.partyTitleMultiplier !== undefined) {
    return i18n.t('battle.partyTitleMultiplier', { value: skill.partyTitleMultiplier.toFixed(2) })
  }

  if (skill.undead) {
    return i18n.t('battle.undead')
  }

  if (skill.hpRegenPercent !== undefined) {
    return i18n.t('battle.hpRegen', { value: skill.hpRegenPercent })
  }

  if (skill.hpRegenAmount !== undefined) {
    return i18n.t('battle.hpRegenFlat', { value: skill.hpRegenAmount })
  }

  if (skill.itemSlotsBonus) {
    return i18n.t('battle.itemSlotsBonus')
  }

  if (skill.protectRearAllyNormalAttackMultiplier !== undefined) {
    const reducedRate = Math.round((1 - skill.protectRearAllyNormalAttackMultiplier) * 100)
    return i18n.t('battle.rearProtection', { value: reducedRate })
  }

  if (skill.protectRearAllyMagicDamageMultiplier !== undefined) {
    const reducedRate = Math.round((1 - skill.protectRearAllyMagicDamageMultiplier) * 100)
    return i18n.t('battle.magicRearProtection', { value: reducedRate })
  }

  if (skill.equipmentCategoryMultiplier?.armor !== undefined) {
    return i18n.t('battle.armorMultiplier', { value: skill.equipmentCategoryMultiplier.armor.toFixed(1) })
  }

  if (skill.equipmentCategoryMultiplier?.shield !== undefined) {
    return i18n.t('battle.shieldMultiplier', { value: skill.equipmentCategoryMultiplier.shield.toFixed(1) })
  }

  if (skill.equipmentCategoryMultiplier?.robe !== undefined) {
    return i18n.t('battle.robeMultiplier', { value: skill.equipmentCategoryMultiplier.robe.toFixed(1) })
  }

  if (skill.equipmentCategoryMultiplier?.wand !== undefined) {
    return i18n.t('battle.wandMultiplier', { value: skill.equipmentCategoryMultiplier.wand.toFixed(1) })
  }

  if (skill.equipmentCategoryMultiplier?.rod !== undefined) {
    return i18n.t('battle.rodMultiplier', { value: skill.equipmentCategoryMultiplier.rod.toFixed(1) })
  }

  if (skill.weaponSubCategoryMultiplier?.sword !== undefined) {
    return i18n.t('battle.swordMultiplier', { value: skill.weaponSubCategoryMultiplier.sword.toFixed(1) })
  }

  if (skill.weaponSubCategoryMultiplier?.claw !== undefined) {
    return i18n.t('battle.clawMultiplier', { value: skill.weaponSubCategoryMultiplier.claw.toFixed(1) })
  }

  for (const [key, value] of Object.entries(skill.baseStatMultipliers ?? {})) {
    if (value !== undefined) {
      return i18n.t('battle.baseStatMultiplier', {
        stat: i18n.t(`entities.stat.${key}`, { defaultValue: key }),
        value: value.toFixed(1),
      })
    }
  }

  for (const [key, value] of Object.entries(skill.baseAttributeBonuses ?? {})) {
    if (value !== undefined) {
      return i18n.t('battle.baseAttributeBonus', {
        stat: i18n.t(`entities.stat.${key}`, { defaultValue: key }),
        value,
      })
    }
  }

  if (skill.statMultipliers?.evasion !== undefined) {
    return i18n.t('battle.evasionMultiplier', { value: skill.statMultipliers.evasion.toFixed(1) })
  }

  if (skill.statMultipliers?.hp !== undefined) {
    const value = Math.round((skill.statMultipliers.hp - 1) * 100)
    return i18n.t('battle.hpMultiplier', { value })
  }

  if (skill.equipmentStatMultipliers?.accuracy_flat !== undefined) {
    return i18n.t('battle.accuracyMultiplier', { value: skill.equipmentStatMultipliers.accuracy_flat.toFixed(1) })
  }

  if (skill.equipmentStatMultipliers?.magic_atk_flat !== undefined) {
    return i18n.t('battle.magicAtkMultiplier', { value: skill.equipmentStatMultipliers.magic_atk_flat.toFixed(1) })
  }

  if (skill.statBonuses?.attackCount !== undefined) {
    return i18n.t('battle.attackCountBonus', { value: skill.statBonuses.attackCount })
  }

  if (skill.statBonuses?.evasion !== undefined) {
    return i18n.t('battle.evasionBonus', { value: skill.statBonuses.evasion })
  }

  return getSkillLabel(skill)
}

function getListedSkillEffectDescriptions(skill: CharacterSkill): string[] {
  const descriptions: string[] = []

  for (const key of BASE_ATTRIBUTE_ORDER) {
    const value = skill.baseAttributeBonuses?.[key]
    if (value === undefined) continue
    descriptions.push(i18n.t('battle.baseAttributeBonus', {
      stat: i18n.t(`entities.stat.${key}`, { defaultValue: key }),
      value,
    }))
  }

  if (skill.partyRareMultiplier !== undefined) {
    descriptions.push(i18n.t('battle.partyRareMultiplier', { value: skill.partyRareMultiplier.toFixed(2) }))
  }

  if (skill.partyTitleBonusPercent !== undefined) {
    descriptions.push(i18n.t('battle.partyTitleBonus', { value: skill.partyTitleBonusPercent }))
  }

  if (skill.partyTitleMultiplier !== undefined) {
    descriptions.push(i18n.t('battle.partyTitleMultiplier', { value: skill.partyTitleMultiplier.toFixed(2) }))
  }

  return descriptions
}

export function getCharacterSkillDescription(skill: CharacterSkill): string {
  const listedDescriptions = getListedSkillEffectDescriptions(skill)
  if (listedDescriptions.length > 1) return listedDescriptions.join('\n')
  return getSkillDescription(skill) ?? listedDescriptions[0] ?? describeCharacterSkill(skill)
}

export function getCharacterSkillEffectDescriptions(skill: CharacterSkill): string[] {
  const listedDescriptions = getListedSkillEffectDescriptions(skill)
  return listedDescriptions.length > 0 ? listedDescriptions : [getCharacterSkillDescription(skill)]
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

export function getSkillBaseAttributeBonuses(
  skills: CharacterSkill[],
): Partial<Record<keyof GoblinBaseAttributes, number>> {
  const bonuses: Partial<Record<keyof GoblinBaseAttributes, number>> = {}

  for (const skill of getUniqueSkillsById(skills)) {
    for (const [key, value] of Object.entries(skill.baseAttributeBonuses ?? {})) {
      const statKey = key as keyof GoblinBaseAttributes
      bonuses[statKey] = (bonuses[statKey] ?? 0) + (value ?? 0)
    }
  }

  return bonuses
}

export function getSkillStatMultipliers(skills: CharacterSkill[]): Partial<Record<keyof GoblinStats, number>> {
  const skillMultipliers: Partial<Record<keyof GoblinStats, number>> = {}
  const modBonuses: Partial<Record<keyof GoblinStats, number>> = {}

  for (const skill of getUniqueSkillsById(skills)) {
    for (const [key, value] of Object.entries(skill.statMultipliers ?? {})) {
      if (value === undefined) continue
      const statKey = key as keyof GoblinStats
      if (skill.isEquipmentModEffect) {
        modBonuses[statKey] = (modBonuses[statKey] ?? 0) + value - 1
      } else {
        skillMultipliers[statKey] = (skillMultipliers[statKey] ?? 1) * value
      }
    }
  }

  const multipliers: Partial<Record<keyof GoblinStats, number>> = { ...skillMultipliers }
  for (const statKey of Object.keys(modBonuses) as Array<keyof GoblinStats>) {
    multipliers[statKey] = (skillMultipliers[statKey] ?? 1) * (1 + (modBonuses[statKey] ?? 0))
  }
  return multipliers
}

export function getSkillBaseStatMultipliers(skills: CharacterSkill[]): Partial<Record<keyof GoblinStats, number>> {
  const multipliers: Partial<Record<keyof GoblinStats, number>> = {}

  for (const skill of getUniqueSkillsById(skills)) {
    for (const [key, value] of Object.entries(skill.baseStatMultipliers ?? {})) {
      if (value === undefined) continue
      const statKey = key as keyof GoblinStats
      multipliers[statKey] = (multipliers[statKey] ?? 1) * value
    }
  }

  return multipliers
}

export function getActionOrderMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.actionOrderMultiplier ?? 1),
    1,
  )
}

export function getSpellTakenMultiplierFromSkills(skills: CharacterSkill[], spellId: string): number {
  return getUniqueSkillsById(skills).reduce((product, skill) => {
    const multiplier = skill.spellTakenMultipliers?.[spellId]
    return product * (multiplier ?? 1)
  }, 1)
}

export function getSpellDamageMultiplierFromSkills(skills: CharacterSkill[], spellId: string): number {
  return getUniqueSkillsById(skills).reduce((product, skill) => {
    const multiplier = skill.spellDamageMultipliers?.[spellId]
    return product * (multiplier ?? 1)
  }, 1)
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

export function getRowDamageMultiplierForAttackType(attackType: 'melee' | 'range', row: number): number {
  const clampedRow = Math.max(0, Math.min(row, MELEE_ROW_DAMAGE_MULTIPLIERS.length - 1))
  return attackType === 'melee'
    ? MELEE_ROW_DAMAGE_MULTIPLIERS[clampedRow]
    : RANGED_ROW_DAMAGE_MULTIPLIERS[clampedRow]
}

export function getRearProtectionMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.protectRearAllyNormalAttackMultiplier ?? 1),
    1,
  )
}

export function getRearMagicProtectionMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.protectRearAllyMagicDamageMultiplier ?? 1),
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

export function hasTwoColumnAttackSkill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.twoColumnAttack)
}

export function hasActTwicePerTurnSkill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.actTwicePerTurn)
}

export function hasRecoverRandomUsedSpellOnDefendSkill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.recoverRandomUsedSpellOnDefend)
}

export function hasImmediateReviveSkill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.immediateReviveOnAllyDeath)
}

export function getMagicDamageFollowUpFromSkills(skills: CharacterSkill[]): CharacterSkill['magicDamageFollowUp'] | undefined {
  return getUniqueSkillsById(skills)
    .map((skill) => skill.magicDamageFollowUp)
    .find((followUp) => followUp !== undefined)
}

export function getCriticalAttackFollowUpFromSkills(skills: CharacterSkill[]): CharacterSkill['criticalAttackFollowUp'] | undefined {
  return getUniqueSkillsById(skills)
    .map((skill) => skill.criticalAttackFollowUp)
    .find((followUp) => followUp !== undefined)
}

export function getPhysicalCounterAttackFromSkills(skills: CharacterSkill[]): CharacterSkill['physicalCounterAttack'] | undefined {
  return getUniqueSkillsById(skills)
    .map((skill) => skill.physicalCounterAttack)
    .find((counterAttack) => counterAttack !== undefined)
}

export function getCounterAttackAvoidanceRateFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.counterAttackAvoidanceRate ?? 0),
    0,
  )
}

export function getPureGoblinPartyStatBonusPercentFromSkills(
  skills: CharacterSkill[],
  level?: number,
): number {
  return getUniqueSkillsById(skills).reduce((max, skill) => {
    if (skill.pureGoblinPartyStatBonusPercent === undefined) return max
    const minLevel = skill.pureGoblinPartyStatBonusMinLevel ?? 0
    if (level !== undefined && level < minLevel) return max
    return Math.max(max, skill.pureGoblinPartyStatBonusPercent)
  }, 0)
}

export function hasSurviveLethalDamageAtHp1Skill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.surviveLethalDamageAtHp1)
}

export function getPhysicalDamageReductionFromSkills(skills: CharacterSkill[]): number {
  const uniqueSkills = getUniqueSkillsById(skills)
  const reductionPercent = uniqueSkills.reduce(
    (sum, skill) => sum + (skill.physicalDamageReductionPercent ?? 0),
    0,
  )
  const takenMultiplier = uniqueSkills.reduce(
    (product, skill) => product * (skill.physicalDamageTakenMultiplier ?? 1),
    1,
  )
  let damageTakenPercent = Math.floor(100 * takenMultiplier)
  damageTakenPercent = Math.floor(damageTakenPercent * (1 - reductionPercent / 100))

  return 100 - damageTakenPercent
}

export function getRangedAttackDamageReductionFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.rangedAttackDamageReductionPercent ?? 0),
    0,
  )
}

export function getMagicDamageReductionFromSkills(skills: CharacterSkill[]): number {
  const uniqueSkills = getUniqueSkillsById(skills)
  const reductionPercent = uniqueSkills.reduce(
    (sum, skill) => sum + (skill.magicDamageReductionPercent ?? 0),
    0,
  )
  const takenMultiplier = uniqueSkills.reduce(
    (product, skill) => product * (skill.magicDamageTakenMultiplier ?? 1),
    1,
  )
  let damageTakenPercent = Math.floor(100 * takenMultiplier)
  damageTakenPercent = Math.floor(damageTakenPercent * (1 - reductionPercent / 100))

  return 100 - damageTakenPercent
}

export function getCriticalRateBonusFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.criticalRateBonusPercent ?? 0),
    0,
  )
}

export function getCriticalDamageBonusFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.criticalDamageBonusPercent ?? 0),
    0,
  )
}

export function getSpellDamagePercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.spellDamagePercent ?? 0),
    0,
  )
}

export function getPartyMagicDamageMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.partyMagicDamageMultiplier ?? 1),
    1,
  )
}

export function getPhysicalDamagePercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.physicalDamagePercent ?? 0),
    0,
  )
}

export function getLearnedSpellsFromSkills(skills: CharacterSkill[], level?: number): LearnedSpell[] {
  const spellMap = new Map<string, LearnedSpell>()

  for (const skill of getUniqueSkillsById(skills)) {
    if (skill.grantsSpellId) {
      if (!spellMap.has(skill.grantsSpellId)) {
        spellMap.set(skill.grantsSpellId, { spellId: skill.grantsSpellId })
      }
    }

    if (skill.recoveryMagicLevel !== undefined) {
      const charLevel = level ?? 99
      const spellIds = getRecoveryMagicSpellIds(skill.recoveryMagicLevel, charLevel)
      for (const spellId of spellIds) {
        if (!spellMap.has(spellId)) {
          spellMap.set(spellId, { spellId })
        }
      }
    }

    if (skill.mageMagicLevel !== undefined) {
      const charLevel = level ?? 99
      const spellIds = getMageMagicSpellIds(skill.mageMagicLevel, charLevel)
      for (const spellId of spellIds) {
        if (!spellMap.has(spellId)) {
          spellMap.set(spellId, { spellId })
        }
      }
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

export function getExpBonusPercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.expBonusPercent ?? 0),
    0,
  )
}

export function getExpMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getMultiplierWithAdditiveEquipmentMods(skills, skill => skill.expMultiplier)
}

export function getFactorDropBonusPercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.factorDropBonusPercent ?? 0),
    0,
  )
}

export function getFactorDropMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.factorDropMultiplier ?? 1),
    1,
  )
}

export function getGoldBonusPercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.goldBonusPercent ?? 0),
    0,
  )
}

export function getGoldMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getMultiplierWithAdditiveEquipmentMods(skills, skill => skill.goldMultiplier)
}

export function getPartyRareMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.partyRareMultiplier ?? 1),
    1,
  )
}

export function getPartyTitleMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getMultiplierWithAdditiveEquipmentMods(skills, skill => skill.partyTitleMultiplier)
}

export function getPartyTitleBonusPercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.partyTitleBonusPercent ?? 0),
    0,
  )
}

export function getExpeditionTimeMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (product, skill) => product * (skill.expeditionTimeMultiplier ?? 1),
    1,
  )
}

export function hasUndeadSkill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.undead)
}

export function hasItemSlotsBonusSkill(skills: CharacterSkill[]): boolean {
  return getUniqueSkillsById(skills).some((skill) => skill.itemSlotsBonus)
}

export function getHpRegenPercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.hpRegenPercent ?? 0),
    0,
  )
}

export function getHpRegenAmountFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.hpRegenAmount ?? 0),
    0,
  )
}

export function getLifestealPercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.lifestealPercent ?? 0),
    0,
  )
}

export function getPartyHpRegenFromMagicHealPercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.partyHpRegenFromMagicHealPercent ?? 0),
    0,
  )
}

export type DamageRamp = {
  perAttackPercent: number
  maxPercent: number
}

export function getDamageRampFromSkills(skills: CharacterSkill[]): DamageRamp | undefined {
  const ramps = getUniqueSkillsById(skills).filter(
    (skill) => skill.damageRampPerAttackPercent !== undefined,
  )
  if (ramps.length === 0) return undefined
  return {
    perAttackPercent: ramps.reduce((sum, skill) => sum + (skill.damageRampPerAttackPercent ?? 0), 0),
    maxPercent: ramps.reduce((max, skill) => Math.max(max, skill.damageRampMaxPercent ?? 0), 0),
  }
}

export function getMagicAtkRampFromSkills(skills: CharacterSkill[]): DamageRamp | undefined {
  const ramps = getUniqueSkillsById(skills).filter(
    (skill) => skill.magicAtkRampPerTurnPercent !== undefined,
  )
  if (ramps.length === 0) return undefined
  return {
    perAttackPercent: ramps.reduce((sum, skill) => sum + (skill.magicAtkRampPerTurnPercent ?? 0), 0),
    maxPercent: ramps.reduce((max, skill) => Math.max(max, skill.magicAtkRampMaxPercent ?? 0), 0),
  }
}

export function getSingleStrikeAttackMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.singleStrikeAttackMultiplier ?? 1),
    1,
  )
}

export function getSingleStrikeAccuracyMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.singleStrikeAccuracyMultiplier ?? 1),
    1,
  )
}

export function getPhysicalBarrierChargesFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.physicalBarrierCharges ?? 0),
    0,
  )
}

export function getMagicBarrierChargesFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.magicBarrierCharges ?? 0),
    0,
  )
}

export function getPartyPhysicalDamageMultiplierFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.partyPhysicalDamageMultiplier ?? 1),
    1,
  )
}

export function getReattackOnKillChancePercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.reattackOnKillChancePercent ?? 0),
    0,
  )
}

export function getChainReattackChancePercentFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.chainReattackChancePercent ?? 0),
    0,
  )
}

export function getCriticalDamageTakenReductionFromSkills(skills: CharacterSkill[]): number {
  return Math.min(100, getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.criticalDamageTakenReductionPercent ?? 0),
    0,
  ))
}

export function getAdditionalDamageTakenReductionFromSkills(skills: CharacterSkill[]): number {
  return Math.min(100, getUniqueSkillsById(skills).reduce(
    (sum, skill) => sum + (skill.additionalDamageTakenReductionPercent ?? 0),
    0,
  ))
}

export function getRecoverUsedSpellOnAttackChanceFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.recoverUsedSpellOnAttackChancePercent ?? 0),
    0,
  )
}

export function getTurnStartAoeMagicSkillFromSkills(skills: CharacterSkill[]): CharacterSkill | undefined {
  return getUniqueSkillsById(skills).find((skill) => skill.turnStartAoeMagic !== undefined)
}

export function getLowerLevelDamageTakenReductionFromSkills(skills: CharacterSkill[]): number {
  return getUniqueSkillsById(skills).reduce(
    (max, skill) => Math.max(max, skill.lowerLevelDamageTakenReductionPercent ?? 0),
    0,
  )
}

function getEquipmentValueMultiplier(
  skills: CharacterSkill[],
  category: EquipmentCategory | undefined,
  subCategory: EquipmentStatBonus['sourceSubCategory'],
  stat: EquipmentStat | undefined,
): number {
  return getUniqueSkillsById(skills).reduce((product, skill) => {
    let next = product

    if (category) {
      next *= skill.equipmentCategoryMultiplier?.[category] ?? 1
    }

    if (subCategory) {
      next *= skill.weaponSubCategoryMultiplier?.[subCategory] ?? 1
    }

    if (stat) {
      next *= skill.equipmentStatMultipliers?.[stat] ?? 1
    }

    return next
  }, 1)
}

function applyEquipmentValueMultiplier(value: number, multiplier: number): number {
  if (multiplier === 1 || value === 0) return value

  const scaledAbs = Math.abs(value) * multiplier
  const scaledValue = Math.floor(scaledAbs)
  return value > 0 ? scaledValue : -scaledValue
}

export function applySkillBonusesToEquipmentBonuses(
  skills: CharacterSkill[],
  bonuses: EquipmentStatBonus[],
): EquipmentStatBonus[] {
  return bonuses.map((bonus) => {
    const multiplier = getEquipmentValueMultiplier(
      skills,
      bonus.sourceCategory,
      bonus.sourceSubCategory,
      bonus.stat,
    )

    return {
      ...bonus,
      value: applyEquipmentValueMultiplier(bonus.value, multiplier),
    }
  })
}
