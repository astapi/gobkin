import {
  BASE_GOBLIN_BASE_ATTRIBUTES,
  BASE_GOBLIN_HP_COEFFICIENT,
  getGoblinVariantByRace,
} from '../data/goblinVariants'
import { getSkillBaseAttributeBonuses, getSkillBaseStatMultipliers } from '../data/characterSkills'
import type { Goblin, GoblinBaseAttributes, GoblinStats } from '../types'
import { isBaseGoblinRaceId, normalizeGoblinRaceId } from '../types/Race'

const DEFAULT_BASE_ATTRIBUTES: GoblinBaseAttributes = BASE_GOBLIN_BASE_ATTRIBUTES

const GOBLIN_JOB_HP_COEFFICIENTS: Record<NonNullable<Goblin['job']>, number> = {
  guard: 1.1,
  warrior: 1.2,
  thief: 0.8,
  mage: 0.7,
  cleric: 0.9,
  rider: 0.95,
}

type GoblinRaceContext = Pick<Goblin, 'race' | 'baseAttributes'> & {
  raceId?: Goblin['raceId']
  job?: Goblin['job']
  skills?: Goblin['skills']
}

const BASE_ATTRIBUTE_KEYS: Array<keyof GoblinBaseAttributes> = [
  'power',
  'wisdom',
  'spirit',
  'vitality',
  'agility',
  'luck',
]

const BASE_ATTRIBUTE_MAX_BONUS = 10

function resolveRaceId(goblin: { race: string; raceId?: Goblin['raceId'] }): string {
  return normalizeGoblinRaceId(goblin.raceId ?? goblin.race)
}

export function getGoblinBaseAttributes(goblin: GoblinRaceContext): GoblinBaseAttributes {
  if (goblin.baseAttributes) {
    return { ...goblin.baseAttributes }
  }

  return { ...(getGoblinVariantByRace(resolveRaceId(goblin))?.baseAttributes ?? DEFAULT_BASE_ATTRIBUTES) }
}

export function getGoblinBaseAttributeDefaults(goblin: GoblinRaceContext): GoblinBaseAttributes {
  return { ...(getGoblinVariantByRace(resolveRaceId(goblin))?.baseAttributes ?? DEFAULT_BASE_ATTRIBUTES) }
}

export function getGoblinBaseAttributeMaximums(goblin: GoblinRaceContext): GoblinBaseAttributes {
  const defaults = getGoblinBaseAttributeDefaults(goblin)
  return {
    power: defaults.power + BASE_ATTRIBUTE_MAX_BONUS,
    wisdom: defaults.wisdom + BASE_ATTRIBUTE_MAX_BONUS,
    spirit: defaults.spirit + BASE_ATTRIBUTE_MAX_BONUS,
    vitality: defaults.vitality + BASE_ATTRIBUTE_MAX_BONUS,
    agility: defaults.agility + BASE_ATTRIBUTE_MAX_BONUS,
    luck: defaults.luck + BASE_ATTRIBUTE_MAX_BONUS,
  }
}

/**
 * レベルによる基礎能力値ボーナスを返す
 * レベル1を基準に、1レベルごとに+1
 */
export function getBaseAttributeLevelBonus(level: number): number {
  return Math.max(0, Math.floor(level) - 1)
}

/**
 * レベルを考慮した基礎能力値を返す
 * 誕生時の初期値から1レベルごとに+1し、種族ごとの最大値で止まる
 */
export function getGoblinBaseAttributesAtLevel(goblin: GoblinRaceContext, level: number): GoblinBaseAttributes {
  const base = getGoblinBaseAttributes(goblin)
  const bonus = getBaseAttributeLevelBonus(level)
  const maximums = getGoblinBaseAttributeMaximums(goblin)
  const skillBonuses = goblin.skills?.length ? getSkillBaseAttributeBonuses(goblin.skills) : {}
  const result = {} as GoblinBaseAttributes

  for (const key of BASE_ATTRIBUTE_KEYS) {
    result[key] = Math.min(maximums[key], base[key] + bonus) + (skillBonuses[key] ?? 0)
  }

  return result
}

export function getGoblinHpCoefficient(goblin: Pick<Goblin, 'race' | 'job'> & { raceId?: Goblin['raceId'] }): number {
  const raceId = resolveRaceId(goblin)
  if (isBaseGoblinRaceId(raceId) && goblin.job) {
    return GOBLIN_JOB_HP_COEFFICIENTS[goblin.job]
  }

  if (isBaseGoblinRaceId(raceId)) {
    return BASE_GOBLIN_HP_COEFFICIENT
  }

  return getGoblinVariantByRace(raceId)?.hpCoefficient ?? 1.0
}

export function getGoblinStatCoefficient(goblin: Pick<Goblin, 'race' | 'job'> & { raceId?: Goblin['raceId'] }): number {
  return getGoblinHpCoefficient(goblin)
}

export function getGoblinHpLevelScale(level: number, race: string): number {
  const normalizedLevel = Math.max(1, Math.min(200, Math.floor(level)))
  const isPureGoblin = isBaseGoblinRaceId(race)

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
  skills?: Goblin['skills']
}

function hasStoredStat(
  goblin: GoblinStatContext,
  key: keyof GoblinStats
): goblin is GoblinStatContext & { stats: Pick<GoblinStats, typeof key> } {
  return !goblin.baseAttributes && goblin.stats?.[key] !== undefined
}

function getBaseStatMultiplier(goblin: GoblinStatContext, key: keyof GoblinStats): number {
  if (!goblin.skills?.length) return 1
  return getSkillBaseStatMultipliers(goblin.skills)[key] ?? 1
}

export function calculateGoblinBaseHp(
  level: number,
  goblin: GoblinStatContext
): number {
  if (hasStoredStat(goblin, 'hp')) {
    return goblin.stats.hp
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const multiplier = getBaseStatMultiplier(goblin, 'hp')
  return Math.floor(attributes.vitality * (1 + levelScale * 10 * coefficient) * multiplier + 1)
}

export function calculateGoblinBaseAtk(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'atk')) {
    return goblin.stats.atk
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const multiplier = getBaseStatMultiplier(goblin, 'atk')
  return Math.round(attributes.power * (1 + levelScale * coefficient) * multiplier)
}

export function calculateGoblinBaseDef(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'def')) {
    return goblin.stats.def
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const multiplier = getBaseStatMultiplier(goblin, 'def')
  return Math.round(attributes.vitality * (1 + levelScale * coefficient) * multiplier)
}

export function calculateGoblinBaseMagicDef(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'magicDef')) {
    return goblin.stats.magicDef
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const multiplier = getBaseStatMultiplier(goblin, 'magicDef')
  return Math.round(attributes.spirit * (1 + levelScale * 1 * coefficient) * multiplier)
}

export function calculateGoblinBaseAccuracy(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'accuracy')) {
    return goblin.stats.accuracy
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const attributeAverage = (attributes.power + attributes.agility) / 2
  const multiplier = getBaseStatMultiplier(goblin, 'accuracy')
  return Math.round((attributeAverage * (1 + levelScale * 2 * coefficient) + 50) * multiplier)
}

export function calculateGoblinBaseEvasion(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'evasion')) {
    return goblin.stats.evasion
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const attributeAverage = (attributes.agility + attributes.luck) / 2
  const multiplier = getBaseStatMultiplier(goblin, 'evasion')
  return Math.round(attributeAverage * (1 + levelScale * coefficient) * multiplier)
}

export function calculateGoblinBaseAttackCount(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'attackCount')) {
    return goblin.stats.attackCount
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const agilityScale = (attributes.agility / 10) * (1 + levelScale * 0.025 * coefficient) * 0.5
  const primary = Math.round(agilityScale + 0.1)
  const secondary = Math.round(agilityScale - 0.3)
  const combined = Math.max(1, primary + secondary)
  const multiplier = getBaseStatMultiplier(goblin, 'attackCount')

  return Math.round(combined * 2 * multiplier)
}

export function calculateGoblinBaseMagicAtk(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'magicAtk')) {
    return goblin.stats.magicAtk
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const multiplier = getBaseStatMultiplier(goblin, 'magicAtk')
  return Math.round(attributes.wisdom * (1 + levelScale * 1 * coefficient) * multiplier)
}

export function calculateGoblinBaseMagicHeal(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'magicHeal')) {
    return goblin.stats.magicHeal
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.round(attributes.spirit * (1 + levelScale * 2 * coefficient))
}

export function calculateGoblinBaseCriticalRate(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'criticalRate')) {
    return goblin.stats.criticalRate
  }

  const attributes = getGoblinBaseAttributesAtLevel(goblin, level)
  const levelScale = getGoblinStatLevelScale(level, goblin.raceId ?? goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const rawBase = attributes.agility * 1 + attributes.luck * 2 - 45
  const base = Math.max(0, rawBase)
  const multiplier = getBaseStatMultiplier(goblin, 'criticalRate')
  return Math.round(base * (1 + levelScale * 0.16 * coefficient) * multiplier)
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
