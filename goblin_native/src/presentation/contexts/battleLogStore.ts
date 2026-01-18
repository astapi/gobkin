import type { BattleLogEntry } from '@/shared/types'

const battleLogStore = new Map<string, BattleLogEntry[]>()
let logCounter = 0

export const storeBattleLog = (log: BattleLogEntry[]): string => {
  logCounter += 1
  const id = `${Date.now()}-${logCounter}`
  battleLogStore.set(id, log)
  return id
}

export const getBattleLog = (id: string): BattleLogEntry[] | null => {
  return battleLogStore.get(id) ?? null
}

export const clearBattleLog = (id: string): void => {
  battleLogStore.delete(id)
}
