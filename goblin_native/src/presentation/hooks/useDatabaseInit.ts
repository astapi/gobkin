import { useCallback, useEffect, useRef, useState } from 'react'
import { getDatabase, resetDatabase } from '@/infrastructure/database'
import { SQLiteDungeonProgressRepository } from '@/infrastructure/repositories/SQLiteDungeonProgressRepository'
import { SQLiteGoblinRepository } from '@/infrastructure/repositories/SQLiteGoblinRepository'
import { SQLitePartyRepository } from '@/infrastructure/repositories/SQLitePartyRepository'
import { SQLiteBaseStateRepository } from '@/infrastructure/repositories/SQLiteBaseStateRepository'
import { SQLiteExpeditionRepository } from '@/infrastructure/repositories/SQLiteExpeditionRepository'
import { SQLitePendingGoblinRepository } from '@/infrastructure/repositories/SQLitePendingGoblinRepository'
import { areasData } from '@/shared/data'

async function initializeRepositories(): Promise<void> {
  await getDatabase()

  await Promise.all([
    SQLiteGoblinRepository.getInstance().initialize(),
    SQLitePartyRepository.getInstance().initialize(),
    SQLiteBaseStateRepository.getInstance().initialize(),
    SQLiteExpeditionRepository.getInstance().initialize(),
    SQLitePendingGoblinRepository.getInstance().initialize(),
    SQLiteDungeonProgressRepository.getInstance().initialize(),
  ])

  const dungeonProgressRepo = SQLiteDungeonProgressRepository.getInstance()
  const storedProgress = dungeonProgressRepo.getAll()
  areasData.forEach((dungeon, index) => {
    if (!storedProgress[dungeon.id]) {
      dungeonProgressRepo.save(dungeon.id, {
        unlocked: dungeon.unlocked ?? index === 0,
        cleared: dungeon.cleared ?? false,
        unlockNotified: false,
      })
    }
  })
}

export const useDatabaseInit = () => {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const run = async () => {
      try {
        await initializeRepositories()
        if (mountedRef.current) setReady(true)
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Database init failed')
        }
      }
    }
    void run()
    return () => { mountedRef.current = false }
  }, [])

  const resetAndReinitialize = useCallback(async (): Promise<void> => {
    setReady(false)
    setError(null)
    try {
      await resetDatabase()
      await initializeRepositories()
      setReady(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Database reset failed')
    }
  }, [])

  return { ready, error, resetAndReinitialize }
}
