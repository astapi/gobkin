// TODO: SQLiteに移行予定 - 現在は暫定的にAsyncStorageを使用
// 移行設計: docs/sqlite_migration.md を参照
import { useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { areasData } from '../../shared/data'
import type { Dungeon } from '../../shared/types'
import type { DungeonProgressState } from '../../shared/types/DungeonProgress'

const STORAGE_KEY = 'dungeon_progress'
const listeners = new Set<(progress: DungeonProgressState) => void>()
let cachedProgress: DungeonProgressState | null = null

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

const loadProgressFromStorage = async (): Promise<DungeonProgressState> => {
  if (cachedProgress) {
    return cachedProgress
  }

  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed: DungeonProgressState = { ...buildDefaultProgress(), ...JSON.parse(saved) }
      cachedProgress = parsed
      return parsed
    }
  } catch (error) {
    console.warn('Failed to load dungeon progress', error)
  }

  const defaultProgress = buildDefaultProgress()
  cachedProgress = defaultProgress
  return defaultProgress
}

const persistProgress = async (progress: DungeonProgressState) => {
  cachedProgress = progress
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch (error) {
    console.warn('Failed to persist dungeon progress', error)
  }
  listeners.forEach(listener => listener(progress))
}

export const useDungeonProgress = () => {
  const [progress, setProgress] = useState<DungeonProgressState>(() => cachedProgress || buildDefaultProgress())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const handleUpdate = (next: DungeonProgressState) => setProgress(next)
    listeners.add(handleUpdate)
    return () => {
      listeners.delete(handleUpdate)
    }
  }, [])

  useEffect(() => {
    loadProgressFromStorage().then(loaded => {
      setProgress(loaded)
      setIsLoading(false)
    })
  }, [])

  const updateProgress = (updater: (prev: DungeonProgressState) => DungeonProgressState) => {
    const next = updater(cachedProgress || buildDefaultProgress())
    persistProgress(next)
  }

  const markDungeonCleared = (dungeon: Dungeon, cleared: boolean) => {
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
  }

  const dungeons: Dungeon[] = useMemo(() => areasData.map(dungeon => ({
    ...dungeon,
    cleared: progress[dungeon.id]?.cleared ?? dungeon.cleared ?? false,
    unlocked: progress[dungeon.id]?.unlocked ?? dungeon.unlocked ?? false,
  })), [progress])

  return {
    dungeons,
    progress,
    isLoading,
    updateProgress,
    markDungeonCleared,
  }
}
