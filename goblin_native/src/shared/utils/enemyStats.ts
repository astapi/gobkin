// 敵ステータス自動算出フォーミュラ。
// Lv・raceTags(種族)・baseAttributes(力/体力/敏捷/運) から HP/DEF/EVA/ATK/ACC の
// 基準値を導出する、敵データのオーサリング用ユーティリティ。
//
// 【重要】アプリのランタイムはこの計算結果を敵JSONに焼き込んだ値を使うため、
// src/ 内からは直接参照されない。しかし tools/studio の敵エディタ
// (tools/studio/src/components/EnemyEditor.tsx) がこの関数群を import して
// 「Lv・能力値を入れると各ステータスを自動計算」する機能に利用している。
// 未参照に見えても death-code ではないので削除しないこと(過去に監査で誤削除された)。
import type { Enemy } from '../types'
import { races } from '../data/races'
import { getGoblinHpLevelScale } from './goblinHp'

export type EnemyHpSpecies = 'goblin' | 'beast' | 'human' | 'demon_race'

const ENEMY_HP_SPECIES_COEFFICIENTS: Record<EnemyHpSpecies, number> = {
  goblin: 0.8,
  beast: 1.1,
  human: 1.0,
  demon_race: 1.3,
}

export function getEnemyHpSpeciesCoefficient(species: EnemyHpSpecies): number {
  return ENEMY_HP_SPECIES_COEFFICIENTS[species]
}

function raceHasAncestor(raceTag: string, target: EnemyHpSpecies, visited = new Set<string>()): boolean {
  if (raceTag === target) return true
  if (visited.has(raceTag)) return false
  visited.add(raceTag)
  const implied = races[raceTag]?.implies ?? []
  return implied.some((entry) => raceHasAncestor(entry, target, visited))
}

export function detectEnemyHpSpecies(raceTags: readonly string[]): EnemyHpSpecies {
  for (const raceTag of raceTags) {
    if (raceHasAncestor(raceTag, 'goblin')) return 'goblin'
    if (raceHasAncestor(raceTag, 'beast')) return 'beast'
    if (raceHasAncestor(raceTag, 'human')) return 'human'
    if (raceHasAncestor(raceTag, 'demon_race')) return 'demon_race'
  }
  return 'human'
}

function roundOnesPlace(value: number): number {
  return Math.round(value / 10) * 10
}

export function calculateEnemyBaseHpFromInputs(
  level: number,
  vitality: number,
  species: EnemyHpSpecies,
): number {
  const levelScale = getGoblinHpLevelScale(level, species)
  const coefficient = getEnemyHpSpeciesCoefficient(species)
  const baseHp = Math.floor(vitality * (1 + levelScale * 10 * coefficient) + 1)
  return roundOnesPlace(baseHp)
}

export function calculateEnemyBaseHp(enemy: Pick<Enemy, 'level' | 'raceTags' | 'baseAttributes'>): number {
  return calculateEnemyBaseHpFromInputs(
    enemy.level,
    enemy.baseAttributes.vitality,
    detectEnemyHpSpecies(enemy.raceTags),
  )
}

export function calculateEnemyBaseDefFromInputs(
  level: number,
  vitality: number,
  species: EnemyHpSpecies,
): number {
  const levelScale = getGoblinHpLevelScale(level, species)
  const coefficient = getEnemyHpSpeciesCoefficient(species)
  return Math.round(vitality * (1 + levelScale * coefficient))
}

export function calculateEnemyBaseDef(enemy: Pick<Enemy, 'level' | 'raceTags' | 'baseAttributes'>): number {
  return calculateEnemyBaseDefFromInputs(
    enemy.level,
    enemy.baseAttributes.vitality,
    detectEnemyHpSpecies(enemy.raceTags),
  )
}

export function calculateEnemyBaseEvasionFromInputs(
  level: number,
  agility: number,
  luck: number,
  species: EnemyHpSpecies,
): number {
  const levelScale = getGoblinHpLevelScale(level, species)
  const coefficient = getEnemyHpSpeciesCoefficient(species)
  const attributeAverage = (agility + luck) / 2
  return Math.round(attributeAverage * (1 + levelScale * coefficient))
}

export function calculateEnemyBaseEvasion(enemy: Pick<Enemy, 'level' | 'raceTags' | 'baseAttributes'>): number {
  return calculateEnemyBaseEvasionFromInputs(
    enemy.level,
    enemy.baseAttributes.agility,
    enemy.baseAttributes.luck,
    detectEnemyHpSpecies(enemy.raceTags),
  )
}

export function calculateEnemyBaseAtkFromInputs(
  level: number,
  power: number,
  species: EnemyHpSpecies,
): number {
  const levelScale = getGoblinHpLevelScale(level, species)
  const coefficient = getEnemyHpSpeciesCoefficient(species)
  return Math.round(power * (1 + levelScale * coefficient))
}

export function calculateEnemyBaseAtk(enemy: Pick<Enemy, 'level' | 'raceTags' | 'baseAttributes'>): number {
  return calculateEnemyBaseAtkFromInputs(
    enemy.level,
    enemy.baseAttributes.power,
    detectEnemyHpSpecies(enemy.raceTags),
  )
}

export function calculateEnemyBaseAccuracyFromInputs(
  level: number,
  power: number,
  agility: number,
  species: EnemyHpSpecies,
): number {
  const levelScale = getGoblinHpLevelScale(level, species)
  const coefficient = getEnemyHpSpeciesCoefficient(species)
  const attributeAverage = (power + agility) / 2
  return Math.round(attributeAverage * (1 + levelScale * 2 * coefficient) + 50)
}

export function calculateEnemyBaseAccuracy(enemy: Pick<Enemy, 'level' | 'raceTags' | 'baseAttributes'>): number {
  return calculateEnemyBaseAccuracyFromInputs(
    enemy.level,
    enemy.baseAttributes.power,
    enemy.baseAttributes.agility,
    detectEnemyHpSpecies(enemy.raceTags),
  )
}
