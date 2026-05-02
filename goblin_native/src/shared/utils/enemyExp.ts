import { races } from '../data/races'

const RACE_EXP_COEFFICIENTS: Record<string, number> = {
  human: 1.15,
  beast: 1.0,
  construct: 1.2,
}

const DEFAULT_RACE_EXP_COEFFICIENT = 1.0

const BOSS_EXP_COEFFICIENT = 1.5

const LEVEL_EXP_BASE = 3

function expandRaceTags(raceTags: readonly string[]): Set<string> {
  const expanded = new Set<string>()
  const visit = (tag: string) => {
    if (expanded.has(tag)) return
    expanded.add(tag)
    const race = races[tag]
    if (!race) return
    for (const implied of race.implies ?? []) {
      visit(implied)
    }
  }
  for (const tag of raceTags) visit(tag)
  return expanded
}

export function getRaceExpCoefficient(raceTags: readonly string[]): number {
  const expanded = expandRaceTags(raceTags)
  let coefficient = DEFAULT_RACE_EXP_COEFFICIENT
  for (const tag of expanded) {
    const value = RACE_EXP_COEFFICIENTS[tag]
    if (value !== undefined && value > coefficient) {
      coefficient = value
    }
  }
  return coefficient
}

export function calculateEnemyExp(
  level: number,
  raceTags: readonly string[],
  isBoss: boolean
): number {
  const base = level * LEVEL_EXP_BASE
  const raceCoefficient = getRaceExpCoefficient(raceTags)
  const bossCoefficient = isBoss ? BOSS_EXP_COEFFICIENT : 1
  return Math.round(base * raceCoefficient * bossCoefficient)
}
