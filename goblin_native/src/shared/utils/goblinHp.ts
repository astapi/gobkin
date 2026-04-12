import { getBloodlineAttackCountBonus } from '../data/equipmentConfig'
import {
  BASE_GOBLIN_BASE_ATTRIBUTES,
  BASE_GOBLIN_HP_COEFFICIENT,
  getGoblinVariantByRace,
} from '../data/goblinVariants'
import type { Goblin, GoblinBaseAttributes, GoblinStats } from '../types'
import { normalizeGoblinRaceId } from '../types/Race'

const DEFAULT_BASE_ATTRIBUTES: GoblinBaseAttributes = BASE_GOBLIN_BASE_ATTRIBUTES

const GOBLIN_JOB_HP_COEFFICIENTS: Record<NonNullable<Goblin['job']>, number> = {
  guard: 1.1,
  warrior: 1.2,
  thief: 0.8,
  mage: 0.7,
  cleric: 0.9,
}

type GoblinRaceContext = Pick<Goblin, 'race' | 'baseAttributes'> & { raceId?: Goblin['raceId']; job?: Goblin['job'] }

function resolveRaceId(goblin: { race: string; raceId?: Goblin['raceId'] }): string {
  return normalizeGoblinRaceId(goblin.raceId ?? goblin.race)
}

export function getGoblinBaseAttributes(goblin: GoblinRaceContext): GoblinBaseAttributes {
  if (goblin.baseAttributes) {
    return { ...goblin.baseAttributes }
  }

  return { ...(getGoblinVariantByRace(resolveRaceId(goblin))?.baseAttributes ?? DEFAULT_BASE_ATTRIBUTES) }
}

export function getGoblinHpCoefficient(goblin: Pick<Goblin, 'race' | 'job'> & { raceId?: Goblin['raceId'] }): number {
  const raceId = resolveRaceId(goblin)
  if (raceId === 'goblin' && goblin.job) {
    return GOBLIN_JOB_HP_COEFFICIENTS[goblin.job]
  }

  if (raceId === 'goblin') {
    return BASE_GOBLIN_HP_COEFFICIENT
  }

  return getGoblinVariantByRace(raceId)?.hpCoefficient ?? 1.0
}

export function getGoblinStatCoefficient(goblin: Pick<Goblin, 'race' | 'job'> & { raceId?: Goblin['raceId'] }): number {
  return getGoblinHpCoefficient(goblin)
}

export function getGoblinHpLevelScale(level: number, race: string): number {
  const normalizedLevel = Math.max(1, Math.min(200, Math.floor(level)))
  const isPureGoblin = normalizeGoblinRaceId(race) === 'goblin'

  if (normalizedLevel <= 30) return normalizedLevel * 0.1
  if (normalizedLevel <= 60) return normalizedLevel * 0.15 - 1.5
  if (normalizedLevel <= 80) return normalizedLevel * 0.225 - 6
  if (normalizedLevel <= 100) return isPureGoblin ? normalizedLevel * 0.225 - 6 : normalizedLevel * 0.45 - 24
  if (normalizedLevel <= 150) return isPureGoblin ? normalizedLevel * 0.1125 + 5.25 : normalizedLevel * 0.45 - 24
  if (normalizedLevel <= 180) return isPureGoblin ? normalizedLevel * 0.16875 - 3.1875 : normalizedLevel * 0.45 - 24
  return isPureGoblin ? normalizedLevel * 0.253125 - 18.375 : normalizedLevel * 0.45 - 24
}

export function getGoblinStatLevelScale(level: number, race: string): number {
  return getGoblinHpLevelScale(level, race)
}

type GoblinStatContext = Pick<Goblin, 'race' | 'job' | 'baseAttributes'> & {
  raceId?: Goblin['raceId']
  stats?: Partial<GoblinStats>
}

function hasStoredStat(
  goblin: GoblinStatContext,
  key: keyof GoblinStats
): goblin is GoblinStatContext & { stats: Pick<GoblinStats, typeof key> } {
  return !goblin.baseAttributes && goblin.stats?.[key] !== undefined
}

export function calculateGoblinBaseHp(
  level: number,
  goblin: GoblinStatContext
): number {
  if (hasStoredStat(goblin, 'hp')) {
    return goblin.stats.hp
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.floor(attributes.vitality * (1 + levelScale * 10 * coefficient) + 1)
}

export function calculateGoblinBaseAtk(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'atk')) {
    return goblin.stats.atk
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.round(attributes.power * (1 + levelScale * coefficient))
}

export function calculateGoblinBaseDef(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'def')) {
    return goblin.stats.def
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.round(attributes.vitality * (1 + levelScale * coefficient))
}

export function calculateGoblinBaseMagicDef(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'magicDef')) {
    return goblin.stats.magicDef
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.round(attributes.spirit * (1 + levelScale * 1 * coefficient))
}

export function calculateGoblinBaseAccuracy(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'accuracy')) {
    return goblin.stats.accuracy
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const attributeAverage = (attributes.power + attributes.agility) / 2
  return Math.round(attributeAverage * (1 + levelScale * 2 * coefficient) + 50)
}

export function calculateGoblinBaseEvasion(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'evasion')) {
    return goblin.stats.evasion
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const attributeAverage = (attributes.agility + attributes.luck) / 2
  return Math.round(attributeAverage * (1 + levelScale * coefficient))
}

export function calculateGoblinBaseAttackCount(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'attackCount')) {
    return goblin.stats.attackCount
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const bloodlineAttackCountBonus = getBloodlineAttackCountBonus(goblin.raceId ?? goblin.race)
  const agilityScale = (attributes.agility / 10) * (1 + levelScale * 0.025 * coefficient) * 0.5
  const primary = Math.round(agilityScale + 0.1)
  const secondary = Math.round(agilityScale - 0.3)
  const combined = Math.max(1, primary + secondary)

  return Math.round(combined * 2 + bloodlineAttackCountBonus)
}

export function calculateGoblinBaseMagicAtk(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'magicAtk')) {
    return goblin.stats.magicAtk
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.round(attributes.wisdom * (1 + levelScale * 1 * coefficient))
}

export function calculateGoblinBaseMagicHeal(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'magicHeal')) {
    return goblin.stats.magicHeal
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.round(attributes.spirit * (1 + levelScale * 2 * coefficient))
}

export function calculateGoblinBaseCriticalRate(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'criticalRate')) {
    return goblin.stats.criticalRate
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const rawBase = attributes.agility * 1 + attributes.luck * 2 - 45
  const base = Math.max(0, rawBase)
  return Math.round(base * (1 + levelScale * 0.16 * coefficient))
}

export function calculateGoblinDerivedStats(
  level: number,
  goblin: GoblinStatContext
): GoblinStats {
  return {
    hp: calculateGoblinBaseHp(level, goblin),
    atk: calculateGoblinBaseAtk(level, goblin),
    magicAtk: calculateGoblinBaseMagicAtk(level, goblin),
    def: calculateGoblinBaseDef(level, goblin),
    magicDef: calculateGoblinBaseMagicDef(level, goblin),
    attackCount: calculateGoblinBaseAttackCount(level, goblin),
    accuracy: calculateGoblinBaseAccuracy(level, goblin),
    evasion: calculateGoblinBaseEvasion(level, goblin),
    magicHeal: calculateGoblinBaseMagicHeal(level, goblin),
    criticalRate: calculateGoblinBaseCriticalRate(level, goblin),
  }
}
