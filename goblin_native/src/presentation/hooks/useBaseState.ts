/**
 * 拠点状態管理用カスタムフック
 * SQLiteBaseStateRepositoryを使用して拠点の状態を管理
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { BaseState } from '@/shared/types'
import { SQLiteBaseStateRepository } from '@/infrastructure/repositories'

// シングルトンリポジトリインスタンス
let repositoryInstance: SQLiteBaseStateRepository | null = null

const getRepository = (): SQLiteBaseStateRepository => {
  if (!repositoryInstance) {
    repositoryInstance = new SQLiteBaseStateRepository()
  }
  return repositoryInstance
}

export function useBaseState() {
  const [baseState, setBaseState] = useState<BaseState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const repositoryRef = useRef<SQLiteBaseStateRepository | null>(null)

  // リポジトリの初期化とデータ取得
  useEffect(() => {
    const repository = getRepository()
    repositoryRef.current = repository

    const initializeAndLoad = async () => {
      try {
        await repository.initialize()
        setBaseState(repository.getBaseState())
      } catch (error) {
        console.error('[useBaseState] Failed to initialize:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // データ変更時のコールバックを設定
    repository.setOnDataChange(() => {
      setBaseState(repository.getBaseState())
    })

    initializeAndLoad()
  }, [])

  // 拠点ランクアップ
  const upgradeRank = useCallback(() => {
    if (!repositoryRef.current) return

    repositoryRef.current.upgradeRank()
    setBaseState(repositoryRef.current.getBaseState())
  }, [])

  // 次のゴブリンIDを取得して更新
  const getNextGoblinId = useCallback((): number => {
    if (!repositoryRef.current) return 1

    return repositoryRef.current.getAndIncrementNextGoblinId()
  }, [])

  // 拠点状態を更新
  const updateBaseState = useCallback((updates: Partial<BaseState>) => {
    if (!repositoryRef.current || !baseState) return

    const newState: BaseState = {
      ...baseState,
      ...updates,
    }

    repositoryRef.current.saveBaseState(newState)
    setBaseState(newState)
  }, [baseState])

  return {
    baseState,
    isLoading,
    upgradeRank,
    getNextGoblinId,
    updateBaseState,
    capacity: baseState?.capacity ?? 8,
    rank: baseState?.rank ?? 1,
  }
}
