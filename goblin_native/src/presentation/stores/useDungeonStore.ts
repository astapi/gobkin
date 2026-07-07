import { create } from 'zustand'
import { dungeonProgressRepository as repository } from '../di/repositories'
import { areasData } from '../../shared/data'
import type { Dungeon, DungeonTier } from '../../shared/types'
import type { DungeonProgressState } from '../../shared/types/DungeonProgress'

const buildDefaultProgress = (): DungeonProgressState => {
  const defaults: DungeonProgressState = {}
  areasData.forEach((dungeon, index) => {
    defaults[dungeon.id] = {
      unlocked: dungeon.unlocked ?? index === 0,
      cleared: dungeon.cleared ?? false,
      unlockNotified: false,
      maxClearedTier: 0,
      maxClearedFloorsByTier: dungeon.cleared ? { 0: dungeon.floors } : {},
    }
  })
  return defaults
}

const buildDungeons = (progress: DungeonProgressState): Dungeon[] =>
  areasData.map(dungeon => ({
    ...dungeon,
    cleared: progress[dungeon.id]?.cleared ?? dungeon.cleared ?? false,
    unlocked: progress[dungeon.id]?.unlocked ?? dungeon.unlocked ?? false,
    maxClearedTier: progress[dungeon.id]?.maxClearedTier ?? 0,
    maxClearedFloorsByTier: progress[dungeon.id]?.maxClearedFloorsByTier ?? {},
  }))

interface DungeonStoreState {
  progress: DungeonProgressState
  dungeons: Dungeon[]
  isLoading: boolean
}

interface DungeonStoreActions {
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  updateProgress: (updater: (prev: DungeonProgressState) => DungeonProgressState) => Promise<void>
  markDungeonCleared: (dungeon: Dungeon, cleared: boolean, tier?: DungeonTier) => Promise<void>
  markDungeonFloorCleared: (dungeon: Dungeon, floor: number, tier?: DungeonTier) => Promise<void>
  markUnlockNotified: (dungeonId: string) => Promise<void>
}

const defaultProgress = buildDefaultProgress()

export const useDungeonStore = create<DungeonStoreState & DungeonStoreActions>()((set, get) => {
  const setProgress = (progress: DungeonProgressState) => {
    set({ progress, dungeons: buildDungeons(progress) })
  }

  const refresh = async () => {
    const storedProgress = await repository.getAll()
    setProgress({ ...buildDefaultProgress(), ...storedProgress })
  }

  const updateProgress = async (updater: (prev: DungeonProgressState) => DungeonProgressState) => {
    const storedProgress = await repository.getAll()
    const currentProgress = { ...buildDefaultProgress(), ...storedProgress }
    const nextProgress = updater(currentProgress)

    for (const [dungeonId, state] of Object.entries(nextProgress)) {
      await repository.save(dungeonId, state)
    }

    await refresh()
  }

  return {
    progress: defaultProgress,
    dungeons: buildDungeons(defaultProgress),
    isLoading: true,

    initialize: async () => {
      const storedProgress = await repository.getAll()
      const mergedProgress = { ...buildDefaultProgress(), ...storedProgress }
      set({ progress: mergedProgress, dungeons: buildDungeons(mergedProgress), isLoading: false })
    },

    refresh,
    updateProgress,

    markDungeonCleared: async (dungeon: Dungeon, cleared: boolean, tier?: DungeonTier) => {
      await updateProgress(prev => {
        const nextProgress: DungeonProgressState = { ...prev }
        const current = nextProgress[dungeon.id] ?? {
          unlocked: dungeon.unlocked ?? false,
          cleared: false,
          unlockNotified: false,
          maxClearedTier: 0,
          maxClearedFloorsByTier: {},
        }

        const clearedTierValue = tier !== undefined ? tier + 1 : 1
        const newMaxClearedTier = cleared
          ? Math.max(current.maxClearedTier, clearedTierValue)
          : current.maxClearedTier
        const tierKey = tier ?? 0
        const currentFloors = current.maxClearedFloorsByTier ?? {}
        const maxClearedFloorsByTier = cleared
          ? {
              ...currentFloors,
              [tierKey]: Math.max(currentFloors[tierKey] ?? 0, dungeon.floors),
            }
          : currentFloors

        nextProgress[dungeon.id] = {
          ...current,
          unlocked: true,
          cleared: cleared || current.cleared,
          maxClearedTier: newMaxClearedTier,
          maxClearedFloorsByTier,
        }

        if (cleared) {
          const unlockTargets = [
            ...(dungeon.unlockNext ? [dungeon.unlockNext] : []),
            ...(dungeon.unlockNexts ?? []),
          ]

          for (const unlockTarget of unlockTargets) {
            const target = nextProgress[unlockTarget]
            if (!target || !target.unlocked) {
              nextProgress[unlockTarget] = {
                ...(target ?? { cleared: false, unlockNotified: false, maxClearedTier: 0, maxClearedFloorsByTier: {} }),
                unlocked: true,
              }
            }
          }
        }

        return nextProgress
      })
    },

    markDungeonFloorCleared: async (dungeon: Dungeon, floor: number, tier?: DungeonTier) => {
      const normalizedFloor = Math.max(1, Math.min(dungeon.floors, Math.floor(floor)))
      await updateProgress(prev => {
        const nextProgress: DungeonProgressState = { ...prev }
        const current = nextProgress[dungeon.id] ?? {
          unlocked: dungeon.unlocked ?? false,
          cleared: false,
          unlockNotified: false,
          maxClearedTier: 0,
          maxClearedFloorsByTier: {},
        }
        const tierKey = tier ?? 0
        const currentFloors = current.maxClearedFloorsByTier ?? {}
        nextProgress[dungeon.id] = {
          ...current,
          unlocked: true,
          maxClearedFloorsByTier: {
            ...currentFloors,
            [tierKey]: Math.max(currentFloors[tierKey] ?? 0, normalizedFloor),
          },
        }
        return nextProgress
      })
    },

    markUnlockNotified: async (dungeonId: string) => {
      await updateProgress(prev => {
        const nextProgress: DungeonProgressState = { ...prev }
        const current = nextProgress[dungeonId] ?? {
          unlocked: false,
          cleared: false,
          unlockNotified: false,
          maxClearedTier: 0,
          maxClearedFloorsByTier: {},
        }
        nextProgress[dungeonId] = { ...current, unlockNotified: true }
        return nextProgress
      })
    },
  }
})
