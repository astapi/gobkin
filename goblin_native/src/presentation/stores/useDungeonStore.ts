import { create } from 'zustand'
import { SQLiteDungeonProgressRepository } from '../../infrastructure/repositories/SQLiteDungeonProgressRepository'
import { areasData } from '../../shared/data'
import type { Dungeon } from '../../shared/types'
import type { DungeonProgressState } from '../../shared/types/DungeonProgress'

const repository = SQLiteDungeonProgressRepository.getInstance()

const buildDefaultProgress = (): DungeonProgressState => {
  const defaults: DungeonProgressState = {}
  areasData.forEach((dungeon, index) => {
    defaults[dungeon.id] = {
      unlocked: dungeon.unlocked ?? index === 0,
      cleared: dungeon.cleared ?? false,
      unlockNotified: false,
    }
  })
  return defaults
}

const buildDungeons = (progress: DungeonProgressState): Dungeon[] =>
  areasData.map(dungeon => ({
    ...dungeon,
    cleared: progress[dungeon.id]?.cleared ?? dungeon.cleared ?? false,
    unlocked: progress[dungeon.id]?.unlocked ?? dungeon.unlocked ?? false,
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
  markDungeonCleared: (dungeon: Dungeon, cleared: boolean) => Promise<void>
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

    markDungeonCleared: async (dungeon: Dungeon, cleared: boolean) => {
      await updateProgress(prev => {
        const nextProgress: DungeonProgressState = { ...prev }
        const current = nextProgress[dungeon.id] ?? {
          unlocked: dungeon.unlocked ?? false,
          cleared: false,
          unlockNotified: false,
        }
        nextProgress[dungeon.id] = {
          ...current,
          unlocked: true,
          cleared: cleared || current.cleared,
        }

        if (cleared && dungeon.unlockNext) {
          const target = nextProgress[dungeon.unlockNext]
          if (!target || !target.unlocked) {
            nextProgress[dungeon.unlockNext] = {
              ...(target ?? { cleared: false, unlockNotified: false }),
              unlocked: true,
            }
          }
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
        }
        nextProgress[dungeonId] = { ...current, unlockNotified: true }
        return nextProgress
      })
    },
  }
})
