import type { Enemy, EnemyDatabase } from '../types'
import { getGoblinHpLevelScale } from './goblinHp'

const ENEMY_HP_COEFFICIENTS: Record<string, number> = {
  human: 0.9,
}

const ENEMY_HP_MULTIPLIERS: Record<string, number> = {
  human: 1.5,
}

export function getEnemyHpCoefficient(enemy: Pick<Enemy, 'raceTags'>): number {
  for (const raceTag of enemy.raceTags) {
    const coefficient = ENEMY_HP_COEFFICIENTS[raceTag]
    if (coefficient !== undefined) return coefficient
  }
  return 1
}

function getEnemyHpMultiplier(enemy: Pick<Enemy, 'raceTags'>): number {
  for (const raceTag of enemy.raceTags) {
    const multiplier = ENEMY_HP_MULTIPLIERS[raceTag]
    if (multiplier !== undefined) return multiplier
  }
  return 1
}

function roundOnesPlace(value: number): number {
  return Math.round(value / 10) * 10
}

export function calculateEnemyBaseHp(enemy: Pick<Enemy, 'level' | 'raceTags' | 'vitality'>): number | null {
  if (enemy.vitality === undefined) return null

  const raceTag = enemy.raceTags[0] ?? ''
  const levelScale = getGoblinHpLevelScale(enemy.level, raceTag)
  const coefficient = getEnemyHpCoefficient(enemy)
  const baseHp = Math.floor(enemy.vitality * (1 + levelScale * 10 * coefficient) + 1)
  return roundOnesPlace(baseHp * getEnemyHpMultiplier(enemy))
}

export function resolveEnemyStats(enemy: Enemy): Enemy {
  const hp = calculateEnemyBaseHp(enemy)
  return hp === null ? enemy : { ...enemy, hp }
}

export function resolveEnemyDatabaseStats(database: EnemyDatabase): EnemyDatabase {
  return {
    ...database,
    enemies: database.enemies.map(resolveEnemyStats),
  }
}
