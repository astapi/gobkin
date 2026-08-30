import i18n from './index'
import type { CharacterSkill, Dungeon, Enemy, EquipmentInstance, EquipmentTemplate, Factor, GoblinJob, SpellDef } from '../types'
import type { EquipmentTitleId } from '../types/EquipmentTitle'
import type { GoblinRaceId } from '../types/Race'
import { getLegacyRaceName, normalizeGoblinRaceId } from '../types/Race'

function translateWithFallback(key: string, fallback: string, options?: Record<string, unknown>): string {
  return i18n.exists(key) ? i18n.t(key, options) : fallback
}

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

function formatMultiplierFraction(value: number): string {
  return FRACTION_LABELS.find(([multiplier]) => Math.abs(multiplier - value) < 0.000001)?.[1]
    ?? value.toFixed(2)
}

export function getRaceLabel(race: string | GoblinRaceId): string {
  const raceId = normalizeGoblinRaceId(race)
  return translateWithFallback(`entities.race.${raceId}`, getLegacyRaceName(raceId))
}

export function getGoblinJobLabel(job: GoblinJob): string {
  return translateWithFallback(`entities.job.${job}.name`, job)
}

export function getGoblinJobShortLabel(job: GoblinJob): string {
  return translateWithFallback(`entities.job.${job}.shortLabel`, job)
}

export function getGoblinJobSummary(job: GoblinJob): string {
  return translateWithFallback(`entities.job.${job}.summary`, job)
}

export function getGoblinJobDescription(job: GoblinJob): string {
  return translateWithFallback(`entities.job.${job}.description`, job)
}

export function getStatLabel(stat: string): string {
  return translateWithFallback(`entities.stat.${stat}`, stat)
}

export function getEquipmentModLabel(modId: string): string {
  return translateWithFallback(`entities.equipmentMod.${modId}`, modId)
}

export function getReturnPolicyLabel(policy: string): string {
  return translateWithFallback(`entities.returnPolicy.${policy}`, policy)
}

export function getSkillLabel(skill: CharacterSkill): string {
  const key = `entities.skill.${skill.id}.name`
  if (i18n.exists(key)) {
    return i18n.t(key)
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

  if (skill.physicalDamageReductionPercent !== undefined) {
    return i18n.t('battle.physicalReduction', { value: skill.physicalDamageReductionPercent })
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

  for (const [key, value] of Object.entries(skill.baseAttributeBonuses ?? {})) {
    if (value !== undefined) {
      return i18n.t('battle.baseAttributeBonus', {
        stat: getStatLabel(key),
        value,
      })
    }
  }

  for (const [key, value] of Object.entries(skill.baseStatMultipliers ?? {})) {
    if (value !== undefined) {
      return i18n.t('battle.baseStatMultiplier', {
        stat: getStatLabel(key),
        value: value.toFixed(1),
      })
    }
  }

  if (skill.statBonuses?.attackCount !== undefined) {
    return i18n.t('battle.attackCountBonus', { value: skill.statBonuses.attackCount })
  }

  if (skill.statBonuses?.evasion !== undefined) {
    return i18n.t('battle.evasionBonus', { value: skill.statBonuses.evasion })
  }

  if (skill.additionalDamage !== undefined) {
    return i18n.t('battle.additionalDamage', { value: skill.additionalDamage })
  }

  if (skill.itemSlotsBonus) {
    return i18n.t('battle.itemSlotsBonus')
  }

  return skill.id
}

export function getSkillDescription(skill: Pick<CharacterSkill, 'descriptionKey'>): string | undefined {
  return skill.descriptionKey && i18n.exists(skill.descriptionKey)
    ? i18n.t(skill.descriptionKey)
    : undefined
}

export function getSpellLabel(spell: Pick<SpellDef, 'id' | 'name'>): string {
  return translateWithFallback(`entities.spell.${spell.id}`, spell.name)
}

export function getDungeonName(dungeon: Pick<Dungeon, 'id' | 'name'>): string {
  return translateWithFallback(`entities.dungeon.${dungeon.id}.name`, dungeon.name)
}

export function getDungeonDescription(dungeon: Pick<Dungeon, 'id' | 'description'>): string {
  return translateWithFallback(`entities.dungeon.${dungeon.id}.description`, dungeon.description)
}

export function getBaseLocationName(rank: number): string {
  return translateWithFallback(`entities.baseLocation.rank${rank}`, '')
}

export function getEnemyName(enemy: Pick<Enemy, 'id' | 'name'>): string {
  return translateWithFallback(`entities.enemy.${enemy.id}.name`, enemy.name)
}

export function getFactorName(factor: Pick<Factor, 'id' | 'name'>): string {
  return translateWithFallback(`entities.factor.${factor.id}.name`, factor.name)
}

export function getFactorShortName(factor: Pick<Factor, 'id' | 'name'>): string {
  return translateWithFallback(`entities.factor.${factor.id}.shortName`, getFactorName(factor))
}

export function getFactorDescription(factor: Pick<Factor, 'id' | 'description'>): string {
  return translateWithFallback(`entities.factor.${factor.id}.description`, factor.description)
}

export function getEquipmentLabel(template: Pick<EquipmentTemplate, 'id' | 'name'>): string {
  return translateWithFallback(`entities.equipment.${template.id}.name`, template.name)
}

export function getEquipmentTitleLabel(titleId: EquipmentTitleId): string {
  return i18n.t(`entities.title.${titleId}`)
}

export function getResolvedEquipmentTitle(
  equipment: Pick<EquipmentInstance, 'titleId' | 'titleName'>,
): string {
  if (equipment.titleId) {
    return getEquipmentTitleLabel(equipment.titleId)
  }
  return ''
}

export function getEquipmentDisplayName(
  equipment: Pick<EquipmentInstance, 'titleId' | 'titleName'>,
  template: Pick<EquipmentTemplate, 'id' | 'name'>,
): string {
  const title = getResolvedEquipmentTitle(equipment)
  const name = getEquipmentLabel(template)
  return `${title}${name}`
}
