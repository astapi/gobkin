import { useEffect, useMemo, useState } from 'react'
import { areasData } from '../../shared/data'
import type { Dungeon } from '../../shared/types'

type DungeonProgressState = Record<string, { unlocked: boolean; cleared: boolean }>

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

const loadProgress = (): DungeonProgressState => {
  if (cachedProgress) {
    return cachedProgress
  }

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        cachedProgress = { ...buildDefaultProgress(), ...JSON.parse(saved) }
        return cachedProgress
      } catch (error) {
        console.warn('ダンジョン進行状況の読み込みに失敗しました', error)
      }
    }
  }

  cachedProgress = buildDefaultProgress()
  return cachedProgress
}

const persistProgress = (progress: DungeonProgressState) => {
  cachedProgress = progress
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }
  listeners.forEach(listener => listener(progress))
}

export const useDungeonProgress = () => {
  const [progress, setProgress] = useState<DungeonProgressState>(() => loadProgress())

  useEffect(() => {
    const handleUpdate = (next: DungeonProgressState) => setProgress(next)
    listeners.add(handleUpdate)
    return () => listeners.delete(handleUpdate)
  }, [])

  const updateProgress = (updater: (prev: DungeonProgressState) => DungeonProgressState) => {
    const next = updater(loadProgress())
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
    updateProgress,
    markDungeonCleared,
  }
}
