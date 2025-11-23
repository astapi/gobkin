import { useEffect, useMemo, useState } from 'react'
import { areasData } from '../../shared/data'
import type { Dungeon } from '../../shared/types'
import type { DungeonProgressState } from '../../shared/types/DungeonProgress'
import { FirestoreDungeonProgressService } from '../../infrastructure/services/FirestoreDungeonProgressService'

type PersistProgress = (progress: DungeonProgressState) => void | Promise<void>

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

const persistProgress = (progress: DungeonProgressState, saveRemote?: PersistProgress) => {
  cachedProgress = progress
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }
  listeners.forEach(listener => listener(progress))
  if (saveRemote) {
    Promise.resolve(saveRemote(progress)).catch(error => {
      console.warn('ダンジョン進行状況のリモート保存に失敗しました', error)
    })
  }
}

export const useDungeonProgress = () => {
  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'
  const [progress, setProgress] = useState<DungeonProgressState>(() => loadProgress())
  const progressService = useMemo(() =>
    useFirestore ? new FirestoreDungeonProgressService() : null,
  [useFirestore])

  useEffect(() => {
    const handleUpdate = (next: DungeonProgressState) => setProgress(next)
    listeners.add(handleUpdate)
    return () => listeners.delete(handleUpdate)
  }, [])

  // Firestore から最新の進行状況を読み込み
  useEffect(() => {
    if (!progressService) return

    let isActive = true
    const defaults = buildDefaultProgress()

    progressService.loadProgress(defaults).then(remote => {
      if (!isActive) return
      cachedProgress = remote
      setProgress(remote)
      persistProgress(remote)
    }).catch(error => {
      console.warn('ダンジョン進行状況の同期に失敗しました', error)
    })

    return () => {
      isActive = false
    }
  }, [progressService])

  const updateProgress = (updater: (prev: DungeonProgressState) => DungeonProgressState) => {
    const next = updater(loadProgress())
    persistProgress(next, progressService ? progressService.saveProgress.bind(progressService) : undefined)
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
