/**
 * ダンジョン進行状況を管理するHook
 * SQLiteDungeonProgressRepository を使用
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SQLiteDungeonProgressRepository } from '../../infrastructure/repositories/SQLiteDungeonProgressRepository'
import { areasData } from '../../shared/data'
import type { Dungeon } from '../../shared/types'
import type { DungeonProgressState } from '../../shared/types/DungeonProgress'

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

export const useDungeonProgress = () => {
  const [progress, setProgress] = useState<DungeonProgressState>(() => buildDefaultProgress())
  const [isLoading, setIsLoading] = useState(true)

  const repository = useMemo(() => {
    return SQLiteDungeonProgressRepository.getInstance()
  }, [])

  const refreshProgress = useCallback(async () => {
    const storedProgress = await repository.getAll()
    const mergedProgress = { ...buildDefaultProgress(), ...storedProgress }
    setProgress(mergedProgress)
  }, [repository])

  useEffect(() => {
    void refreshProgress().then(() => setIsLoading(false))
  }, [refreshProgress])

  const updateProgress = useCallback(
    async (updater: (prev: DungeonProgressState) => DungeonProgressState) => {
      const storedProgress = await repository.getAll()
      const currentProgress = { ...buildDefaultProgress(), ...storedProgress }
      const nextProgress = updater(currentProgress)

      for (const [dungeonId, state] of Object.entries(nextProgress)) {
        await repository.save(dungeonId, state)
      }

      await refreshProgress()
    },
    [repository, refreshProgress]
  )

  const markDungeonCleared = useCallback(
    async (dungeon: Dungeon, cleared: boolean) => {
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
    [updateProgress]
  )

  const markUnlockNotified = useCallback(
    async (dungeonId: string) => {
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
    [updateProgress]
  )

  const dungeons: Dungeon[] = useMemo(
    () =>
      areasData.map(dungeon => ({
        ...dungeon,
        cleared: progress[dungeon.id]?.cleared ?? dungeon.cleared ?? false,
        unlocked: progress[dungeon.id]?.unlocked ?? dungeon.unlocked ?? false,
      })),
    [progress]
  )

  return {
    dungeons,
    progress,
    isLoading,
    updateProgress,
    markDungeonCleared,
    markUnlockNotified,
  }
}
