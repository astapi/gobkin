import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Goblin } from '../../shared/types'
import { SQLiteGoblinRepository } from '../../infrastructure/repositories/SQLiteGoblinRepository'
import type { IGoblinRepository } from '../../core/repositories'
import { GetGoblinListUseCase } from '../../core/usecases'

export const useGoblinService = () => {
  const [repositoryInitialized, setRepositoryInitialized] = useState(false)
  const [goblins, setGoblins] = useState<Goblin[]>([])

  const goblinRepository = useMemo<IGoblinRepository>(() => {
    return SQLiteGoblinRepository.getInstance()
  }, [])

  const getGoblinListUseCase = useMemo(
    () => new GetGoblinListUseCase(goblinRepository),
    [goblinRepository],
  )

  const refreshGoblins = useCallback(() => {
    setGoblins(getGoblinListUseCase.execute())
  }, [getGoblinListUseCase])

  useEffect(() => {
    // 初回のデータ取得
    refreshGoblins()
    setRepositoryInitialized(true)
  }, [refreshGoblins])

  const getGoblinById = useCallback(
    (goblinId: number): Goblin => {
      const goblin = goblinRepository.getGoblin(goblinId)
      if (!goblin) {
        throw new Error(`ID ${goblinId} のゴブリンが見つかりません`)
      }
      return goblin
    },
    [goblinRepository],
  )

  const saveGoblin = useCallback(
    (goblin: Goblin) => {
      goblinRepository.saveGoblin(goblin)
      refreshGoblins()
    },
    [goblinRepository, refreshGoblins],
  )

  const deleteGoblin = useCallback(
    (goblinId: number) => {
      goblinRepository.deleteGoblin(goblinId)
      refreshGoblins()
    },
    [goblinRepository, refreshGoblins],
  )

  const updateGoblinLevel = useCallback(
    (goblinId: number, level: number) => {
      goblinRepository.updateGoblinLevel(goblinId, level)
      refreshGoblins()
    },
    [goblinRepository, refreshGoblins],
  )

  return {
    goblinRepository,
    goblins,
    isLoading: !repositoryInitialized,
    refreshGoblins,
    getGoblinById,
    saveGoblin,
    deleteGoblin,
    updateGoblinLevel,
  }
}
