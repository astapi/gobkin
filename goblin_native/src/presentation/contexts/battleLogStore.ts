import type { BattleLogEntry, BattleLogMeta, Goblin } from '@/shared/types'

interface StoredBattleLog {
  log: BattleLogEntry[]
  meta?: BattleLogMeta
  partySnapshot?: Goblin[]
}

const battleLogStore = new Map<string, StoredBattleLog>()
let logCounter = 0

export const storeBattleLog = (log: BattleLogEntry[], meta?: BattleLogMeta, partySnapshot?: Goblin[]): string => {
  logCounter += 1
  const id = `${Date.now()}-${logCounter}`
  battleLogStore.set(id, { log, meta, partySnapshot })
  return id
}

export const getBattleLog = (id: string): StoredBattleLog | null => {
  return battleLogStore.get(id) ?? null
}

export const clearBattleLog = (id: string): void => {
  battleLogStore.delete(id)
}
