/**
 * ダンジョン進行状況を管理するHook
 * SQLiteDungeonProgressRepository を使用
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SQLiteDungeonProgressRepository } from '../../infrastructure/repositories/SQLiteDungeonProgressRepository'
import { areasData } from '../../shared/data'
import type { Dungeon } from '../../shared/types'
import type { DungeonProgressState } from '../../shared/types/DungeonProgress'

type DungeonProgressRepository = SQLiteDungeonProgressRepository & {
  initialize?: () => Promise<void>
  setOnDataChange?: (callback: () => void) => void
}

const buildDefaultProgress = (): DungeonProgressState => {
  const defaults: DungeonProgressState = {}
  areasData.forEach((dungeon, index) => {
    defaults[dungeon.id] = {
      unlocked: dungeon.unlocked ?? index === 0,
      cleared: dungeon.cleared ?? false,
    }
  })
  return defaults
}

export const useDungeonProgress = () => {
  const [progress, setProgress] = useState<DungeonProgressState>(() => buildDefaultProgress())
  const [isLoading, setIsLoading] = useState(true)

  const repository = useMemo<DungeonProgressRepository>(() => {
    return new SQLiteDungeonProgressRepository()
  }, [])

  const refreshProgress = useCallback(() => {
    const storedProgress = repository.getAll()
    const mergedProgress = { ...buildDefaultProgress(), ...storedProgress }
    setProgress(mergedProgress)
  }, [repository])

  useEffect(() => {
    const initRepository = async () => {
      if (repository.initialize) {
        await repository.initialize()
      }

      // 初期データがない場合はデフォルトを保存
      const storedProgress = repository.getAll()
      const defaults = buildDefaultProgress()

      // 新規ダンジョンの初期状態を保存
      for (const [dungeonId, defaultState] of Object.entries(defaults)) {
        if (!storedProgress[dungeonId]) {
          repository.save(dungeonId, defaultState)
        }
      }

      refreshProgress()
      setIsLoading(false)
    }
    initRepository()
  }, [repository, refreshProgress])

  const updateProgress = useCallback(
    (updater: (prev: DungeonProgressState) => DungeonProgressState) => {
      const currentProgress = { ...buildDefaultProgress(), ...repository.getAll() }
      const nextProgress = updater(currentProgress)

      // 変更された項目のみ保存
      for (const [dungeonId, state] of Object.entries(nextProgress)) {
        repository.save(dungeonId, state)
      }

      refreshProgress()
    },
    [repository, refreshProgress]
  )

  const markDungeonCleared = useCallback(
    (dungeon: Dungeon, cleared: boolean) => {
      updateProgress(prev => {
        const nextProgress: DungeonProgressState = { ...prev }
        const current = nextProgress[dungeon.id] ?? { unlocked: dungeon.unlocked ?? false, cleared: false }
        nextProgress[dungeon.id] = { ...current, unlocked: true, cleared: cleared || current.cleared }

        if (cleared && dungeon.unlockNext) {
          const target = nextProgress[dungeon.unlockNext] ?? { unlocked: false, cleared: false }
          nextProgress[dungeon.unlockNext] = { ...target, unlocked: true }
        }

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
  }
}
