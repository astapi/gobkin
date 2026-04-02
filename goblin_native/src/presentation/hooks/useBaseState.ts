/**
 * 拠点状態管理用カスタムフック
 * SQLiteBaseStateRepositoryを使用して拠点の状態を管理
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { BaseState } from '@/shared/types'
import { SQLiteBaseStateRepository } from '@/infrastructure/repositories'
import { performRankUp as executeRankUp } from '@/core/services/BaseRankSystem'

const getRepository = (): SQLiteBaseStateRepository => {
  return SQLiteBaseStateRepository.getInstance()
}

export function useBaseState() {
  const [baseState, setBaseState] = useState<BaseState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const repositoryRef = useRef<SQLiteBaseStateRepository | null>(null)

  // リポジトリからデータを取得（アプリ起動時に既に初期化済み）
  useEffect(() => {
    const repository = getRepository()
    repositoryRef.current = repository

    // 初回のデータ取得
    setBaseState(repository.getBaseState())
    setIsLoading(false)
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

  // ランクアップを実行
  const performRankUp = useCallback(() => {
    if (!repositoryRef.current || !baseState) {
      return { success: false, error: '拠点状態が読み込まれていません' }
    }

    const result = executeRankUp(baseState)
    if (result.success) {
      repositoryRef.current.saveBaseState(result.state)
      setBaseState(result.state)
    }

    return result
  }, [baseState])

  return {
    baseState,
    isLoading,
    upgradeRank,
    getNextGoblinId,
    updateBaseState,
    performRankUp,
    capacity: baseState?.capacity ?? 10,
    rank: baseState?.rank ?? 1,
    baseStateRepository: repositoryRef.current!,
    maxParties: baseState?.currentMaxParties ?? 1,
    maxGoblins: baseState?.currentMaxGoblins ?? 10,
    ivBonus: baseState?.currentIVBonus ?? 0,
    gold: baseState?.gold ?? 0,
  }
}
