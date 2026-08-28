import type { DungeonProgressState } from '../../shared/types'

export interface DungeonProgress {
  unlocked: boolean
  cleared: boolean
  unlockNotified: boolean
  maxClearedTier: number
  maxClearedFloorsByTier: Record<number, number>
}

export interface IDungeonProgressRepository {
  getAll(): Promise<DungeonProgressState>
  get(dungeonId: string): Promise<DungeonProgress | null>
  save(dungeonId: string, progress: DungeonProgress): Promise<void>
  unlock(dungeonId: string): Promise<void>
  markCleared(dungeonId: string, tier?: number): Promise<void>
}
