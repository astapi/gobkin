import type { BattleLogEntry, BattleLogMeta } from '@/shared/types'

interface StoredBattleLog {
  log: BattleLogEntry[]
  meta?: BattleLogMeta
}

const battleLogStore = new Map<string, StoredBattleLog>()
let logCounter = 0

export const storeBattleLog = (log: BattleLogEntry[], meta?: BattleLogMeta): string => {
  logCounter += 1
  const id = `${Date.now()}-${logCounter}`
  battleLogStore.set(id, { log, meta })
  return id
}

export const getBattleLog = (id: string): StoredBattleLog | null => {
  return battleLogStore.get(id) ?? null
}

export const clearBattleLog = (id: string): void => {
  battleLogStore.delete(id)
}
