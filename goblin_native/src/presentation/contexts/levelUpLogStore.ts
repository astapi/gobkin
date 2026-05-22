import type { GoblinBaseAttributes } from '@/shared/types'

export interface LevelUpStatChange {
  key: keyof GoblinBaseAttributes
  oldValue: number
  newValue: number
}

export interface LevelUpLogDetail {
  memberName: string
  oldLevel: number
  newLevel: number
  statChanges: LevelUpStatChange[]
}

interface StoredLevelUpLog {
  levelUps: LevelUpLogDetail[]
}

const levelUpLogStore = new Map<string, StoredLevelUpLog>()
let logCounter = 0

export const storeLevelUpLog = (levelUps: LevelUpLogDetail[]): string => {
  logCounter += 1
  const id = `${Date.now()}-${logCounter}`
  levelUpLogStore.set(id, { levelUps })
  return id
}

export const getLevelUpLog = (id: string): StoredLevelUpLog | null => {
  return levelUpLogStore.get(id) ?? null
}

export const clearLevelUpLog = (id: string): void => {
  levelUpLogStore.delete(id)
}
