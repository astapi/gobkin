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

  useEffect(() => {
    const repository = getRepository()
    repositoryRef.current = repository

    void repository.getBaseState().then(state => {
      setBaseState(state)
      setIsLoading(false)
    })
  }, [])

  const upgradeRank = useCallback(async () => {
    if (!repositoryRef.current || !baseState) return

    // upgradeRank はもう BaseRankSystem 経由で行うため、ここでは performRankUp を使う
    const result = executeRankUp(baseState)
    if (result.success) {
      await repositoryRef.current.saveBaseState(result.state)
      setBaseState(result.state)
    }
  }, [baseState])

  const getNextGoblinId = useCallback(async (): Promise<number> => {
    if (!repositoryRef.current) return 1

    return repositoryRef.current.getAndIncrementNextGoblinId()
  }, [])

  const updateBaseState = useCallback(async (updates: Partial<BaseState>) => {
    if (!repositoryRef.current || !baseState) return

    const newState: BaseState = {
      ...baseState,
      ...updates,
    }

    await repositoryRef.current.saveBaseState(newState)
    setBaseState(newState)
  }, [baseState])

  const performRankUp = useCallback(async () => {
    if (!repositoryRef.current || !baseState) {
      return { success: false, error: '拠点状態が読み込まれていません' }
    }

    const result = executeRankUp(baseState)
    if (result.success) {
      await repositoryRef.current.saveBaseState(result.state)
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
