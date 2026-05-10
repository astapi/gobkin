import { getEnemyDatabase } from '@/shared/data/enemy'
import { getEquipmentTemplate } from '@/shared/data/equipmentPoolLoader'
import { getFactor } from '@/shared/data/factors'
import { getEquipmentLabel, getFactorName } from '@/shared/i18n/entityLocalization'
import { DUNGEON_TIER_LIST, type DungeonTier } from '@/shared/types/DungeonTier'
import type { Dungeon, Enemy } from '@/shared/types'

export type EnemyEntry = {
  enemy: Enemy
  isBoss: boolean
  floors: number[]
}

export const STAT_ROWS: Array<{ key: keyof Enemy; label: string }> = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
  { key: 'magicAtk', label: 'MAG' },
  { key: 'magicDef', label: 'MDF' },
  { key: 'magicHeal', label: 'HEAL' },
  { key: 'attackCount', label: '回数' },
  { key: 'accuracy', label: '命中' },
  { key: 'evasion', label: '回避' },
  { key: 'gold', label: 'Gold' },
]

export const ATTRIBUTE_ROWS: Array<{ key: keyof Enemy['baseAttributes']; label: string }> = [
  { key: 'power', label: '力' },
  { key: 'wisdom', label: '知恵' },
  { key: 'spirit', label: '精神' },
  { key: 'vitality', label: '体力' },
  { key: 'agility', label: '敏捷' },
  { key: 'luck', label: '運' },
]

export function getUnlockedMaxTier(dungeon: Dungeon): DungeonTier {
  return Math.min(Math.max(dungeon.maxClearedTier ?? 0, 0), 5) as DungeonTier
}

export function getUnlockedTiers(dungeon: Dungeon): DungeonTier[] {
  const maxTier = getUnlockedMaxTier(dungeon)
  return DUNGEON_TIER_LIST.filter((tier) => tier <= maxTier)
}

export function buildEnemyEntries(areaId: string): EnemyEntry[] {
  const database = getEnemyDatabase(areaId)
  if (!database) return []

  const enemyById = new Map(database.enemies.map((enemy) => [enemy.id, enemy]))
  const entries = new Map<string, EnemyEntry>()

  database.patterns.forEach((pattern) => {
    pattern.enemies.flat().forEach((enemyId) => {
      const enemy = enemyById.get(enemyId)
      if (!enemy) return
      const existing = entries.get(enemyId)
      if (existing) {
        existing.floors = [...new Set([...existing.floors, ...pattern.floors])].sort((a, b) => a - b)
        return
      }
      entries.set(enemyId, {
        enemy,
        isBoss: enemy.isBoss === true,
        floors: [...pattern.floors].sort((a, b) => a - b),
      })
    })
  })

  if (entries.size === 0) {
    database.enemies.forEach((enemy) => {
      entries.set(enemy.id, { enemy, isBoss: enemy.isBoss === true, floors: [] })
    })
  }

  return Array.from(entries.values()).sort((a, b) => {
    if (a.isBoss !== b.isBoss) return a.isBoss ? 1 : -1
    return a.enemy.level - b.enemy.level
  })
}

export function getEnemyEntry(areaId: string, enemyId: string): EnemyEntry | undefined {
  return buildEnemyEntries(areaId).find((entry) => entry.enemy.id === enemyId)
}

export function formatFloors(floors: number[]): string {
  if (floors.length === 0) return '-'
  return floors.map((floor) => `${floor}F`).join(' / ')
}

export function formatStatValue(value: Enemy[keyof Enemy]): string {
  return typeof value === 'number' ? value.toLocaleString() : '-'
}

export function getRareDropNames(enemy: Enemy): string[] {
  return (enemy.rareEquipmentDrops ?? []).map((drop) => {
    const template = getEquipmentTemplate(drop.templateId)
    return template ? getEquipmentLabel(template) : drop.templateId
  })
}

export function getFactorDropNames(enemy: Enemy): string[] {
  return (enemy.factorDrops ?? []).map((drop) => {
    const factor = getFactor(drop.factorId)
    return factor ? getFactorName(factor) : drop.factorId
  })
}
