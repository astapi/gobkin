import { useCallback, useEffect, useRef, useState } from 'react'
import { getDatabase, resetDatabase } from '@/infrastructure/database'
import { SQLiteDungeonProgressRepository } from '@/infrastructure/repositories/SQLiteDungeonProgressRepository'
import { SQLiteBaseStateRepository } from '@/infrastructure/repositories/SQLiteBaseStateRepository'
import { areasData } from '@/shared/data'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'
import { useTutorialOverlayStore } from '@/presentation/stores/useTutorialOverlayStore'

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
  const [reloadKey, setReloadKey] = useState(0)
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
    useTutorialOverlayStore.getState().clearAll()
    try {
      await resetDatabase()
      await ensureDefaults()
      await useTutorialStore.getState().reset()
      useTutorialOverlayStore.getState().clearAll()
      setReloadKey(value => value + 1)
      setReady(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Database reset failed')
    }
  }, [])

  /**
   * セーブデータインポート後の再起動相当の再初期化
   * - DB は import 側で既に書き換え済みなので破棄しない
   * - ready を一度 false にして RootLayout のストア初期化を再実行させる
   */
  const reloadAfterImport = useCallback(async (): Promise<void> => {
    setReady(false)
    setError(null)
    useTutorialOverlayStore.getState().clearAll()
    try {
      await ensureDefaults()
      await useTutorialStore.getState().initialize()
      useTutorialOverlayStore.getState().clearAll()
      setReloadKey(value => value + 1)
      setReady(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Database reload failed')
    }
  }, [])

  return { ready, error, reloadKey, resetAndReinitialize, reloadAfterImport }
}
