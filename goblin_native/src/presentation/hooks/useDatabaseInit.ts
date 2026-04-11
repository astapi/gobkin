import { useCallback, useEffect, useRef, useState } from 'react'
import { getDatabase, resetDatabase } from '@/infrastructure/database'
import { SQLiteDungeonProgressRepository } from '@/infrastructure/repositories/SQLiteDungeonProgressRepository'
import { SQLiteBaseStateRepository } from '@/infrastructure/repositories/SQLiteBaseStateRepository'
import { areasData } from '@/shared/data'

async function ensureDefaults(): Promise<void> {
  await getDatabase()

  // 拠点状態がなければデフォルト値を作成
  await SQLiteBaseStateRepository.getInstance().ensureInitialized()

  // ダンジョンプログレス初期値設定
  const dungeonProgressRepo = SQLiteDungeonProgressRepository.getInstance()
  const storedProgress = await dungeonProgressRepo.getAll()
  for (let index = 0; index < areasData.length; index++) {
    const dungeon = areasData[index]
    if (!storedProgress[dungeon.id]) {
      await dungeonProgressRepo.save(dungeon.id, {
        unlocked: dungeon.unlocked ?? index === 0,
        cleared: dungeon.cleared ?? false,
        unlockNotified: false,
        maxClearedTier: 0,
      })
    }
  }
}

export const useDatabaseInit = () => {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const run = async () => {
      try {
        await ensureDefaults()
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
      await ensureDefaults()
      setReady(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Database reset failed')
    }
  }, [])

  return { ready, error, resetAndReinitialize }
}
