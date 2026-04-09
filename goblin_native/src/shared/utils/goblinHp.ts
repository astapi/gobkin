import { getBloodlineAttackCountBonus } from '../data/equipmentConfig'
import type { Goblin, GoblinBaseAttributes, GoblinStats } from '../types'

const RACE_BASE_ATTRIBUTES: Record<string, GoblinBaseAttributes> = {
  'ゴブリン': { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
  'スライムゴブリン': { power: 8, wisdom: 8, spirit: 13, vitality: 13, agility: 8, luck: 10 },
  'ウルフゴブリン': { power: 11, wisdom: 9, spirit: 10, vitality: 10, agility: 13, luck: 12 },
  'ホブゴブリン': { power: 13, wisdom: 11, spirit: 11, vitality: 11, agility: 11, luck: 10 },
  'オークゴブリン': { power: 15, wisdom: 8, spirit: 9, vitality: 15, agility: 7, luck: 8 },
}

const DEFAULT_BASE_ATTRIBUTES: GoblinBaseAttributes = RACE_BASE_ATTRIBUTES['ゴブリン']

const RACE_HP_COEFFICIENTS: Record<string, number> = {
  'ゴブリン': 0.8,
  'スライムゴブリン': 1.2,
  'ウルフゴブリン': 0.9,
  'ホブゴブリン': 1.2,
  'オークゴブリン': 1.5,
}

const GOBLIN_JOB_HP_COEFFICIENTS: Record<NonNullable<Goblin['job']>, number> = {
  guard: 1.1,
  warrior: 1.2,
  thief: 0.8,
  mage: 0.7,
}

export function getGoblinBaseAttributes(goblin: Pick<Goblin, 'race' | 'baseAttributes'>): GoblinBaseAttributes {
  if (goblin.baseAttributes) {
    return { ...goblin.baseAttributes }
  }

  return { ...(RACE_BASE_ATTRIBUTES[goblin.race] ?? DEFAULT_BASE_ATTRIBUTES) }
}

export function getGoblinHpCoefficient(goblin: Pick<Goblin, 'race' | 'job'>): number {
  if (goblin.race === 'ゴブリン' && goblin.job) {
    return GOBLIN_JOB_HP_COEFFICIENTS[goblin.job]
  }

  return RACE_HP_COEFFICIENTS[goblin.race] ?? 1.0
}

export function getGoblinStatCoefficient(goblin: Pick<Goblin, 'race' | 'job'>): number {
  return getGoblinHpCoefficient(goblin)
}

export function getGoblinHpLevelScale(level: number, race: string): number {
  const normalizedLevel = Math.max(1, Math.min(200, Math.floor(level)))
  const isPureGoblin = race === 'ゴブリン'

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
  const levelScale = getGoblinStatLevelScale(level, goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.floor(attributes.vitality * (1 + levelScale * 10 * coefficient) + 1)
}

export function calculateGoblinBaseAtk(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'atk')) {
    return goblin.stats.atk
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.round(attributes.power * (1 + levelScale * coefficient))
}

export function calculateGoblinBaseDef(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'def')) {
    return goblin.stats.def
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  return Math.round(attributes.vitality * (1 + levelScale * coefficient))
}

export function calculateGoblinBaseAccuracy(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'accuracy')) {
    return goblin.stats.accuracy
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const attributeAverage = (attributes.power + attributes.agility) / 2
  return Math.round(attributeAverage * (1 + levelScale * 2 * coefficient) + 50)
}

export function calculateGoblinBaseEvasion(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'evasion')) {
    return goblin.stats.evasion
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const attributeAverage = (attributes.agility + attributes.luck) / 2
  return Math.round(attributeAverage * (1 + levelScale * coefficient))
}

export function calculateGoblinBaseAttackCount(level: number, goblin: GoblinStatContext): number {
  if (hasStoredStat(goblin, 'attackCount')) {
    return goblin.stats.attackCount
  }

  const attributes = getGoblinBaseAttributes(goblin)
  const levelScale = getGoblinStatLevelScale(level, goblin.race)
  const coefficient = getGoblinStatCoefficient(goblin)
  const bloodlineAttackCountBonus = getBloodlineAttackCountBonus(goblin.race)
  const agilityScale = (attributes.agility / 10) * (1 + levelScale * 0.025 * coefficient) * 0.5
  const primary = Math.round(agilityScale + 0.1)
  const secondary = Math.round(agilityScale - 0.3)
  const combined = Math.max(1, primary + secondary)

  return Math.round(combined * 2 + bloodlineAttackCountBonus)
}

export function calculateGoblinDerivedStats(
  level: number,
  goblin: GoblinStatContext
): GoblinStats {
  return {
    hp: calculateGoblinBaseHp(level, goblin),
    atk: calculateGoblinBaseAtk(level, goblin),
    def: calculateGoblinBaseDef(level, goblin),
    attackCount: calculateGoblinBaseAttackCount(level, goblin),
    accuracy: calculateGoblinBaseAccuracy(level, goblin),
    evasion: calculateGoblinBaseEvasion(level, goblin),
  }
}
