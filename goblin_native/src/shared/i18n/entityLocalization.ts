import i18n from './index'
import type { CharacterSkill, Dungeon, Enemy, EquipmentInstance, EquipmentTemplate, Factor, GoblinJob, SpellDef } from '../types'
import type { EquipmentTitleId } from '../types/EquipmentTitle'
import type { GoblinRaceId } from '../types/Race'
import { getLegacyRaceName, normalizeGoblinRaceId } from '../types/Race'

function translateWithFallback(key: string, fallback: string, options?: Record<string, unknown>): string {
  return i18n.exists(key) ? i18n.t(key, options) : fallback
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

  if (skill.criticalDamageBonusPercent !== undefined) {
    return i18n.t('battle.criticalDamageBonus', { value: skill.criticalDamageBonusPercent })
  }

  if (skill.physicalDamageReductionPercent !== undefined) {
    return i18n.t('battle.physicalReduction', { value: skill.physicalDamageReductionPercent })
  }

  if (skill.statBonuses?.attackCount !== undefined) {
    return i18n.t('battle.attackCountBonus', { value: skill.statBonuses.attackCount })
  }

  if (skill.additionalDamage !== undefined) {
    return i18n.t('battle.additionalDamage', { value: skill.additionalDamage })
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

export function getFactorDescription(factor: Pick<Factor, 'id' | 'description'>): string {
  return translateWithFallback(`entities.factor.${factor.id}.description`, factor.description)
}

export function getEquipmentLabel(template: Pick<EquipmentTemplate, 'id' | 'name'>): string {
  return i18n.t(`entities.equipment.${template.id}.name`)
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
