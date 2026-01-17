import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Goblin } from '../../shared/types'
import { SQLiteGoblinRepository } from '../../infrastructure/repositories/SQLiteGoblinRepository'
import type { IGoblinRepository } from '../../core/repositories'
import { GetGoblinListUseCase } from '../../core/usecases'

type ListenerCapableGoblinRepository = IGoblinRepository & {
  initialize?: () => Promise<void>
  setOnDataChange?: (callback: () => void) => void
}

export const useGoblinService = () => {
  const [repositoryInitialized, setRepositoryInitialized] = useState(false)
  const [goblins, setGoblins] = useState<Goblin[]>([])

  const goblinRepository = useMemo<ListenerCapableGoblinRepository>(() => {
    return new SQLiteGoblinRepository()
  }, [])

  const getGoblinListUseCase = useMemo(
    () => new GetGoblinListUseCase(goblinRepository),
    [goblinRepository],
  )

  const refreshGoblins = useCallback(() => {
    setGoblins(getGoblinListUseCase.execute())
  }, [getGoblinListUseCase])

  useEffect(() => {
    const initRepository = async () => {
      if (goblinRepository.initialize) {
        await goblinRepository.initialize()
      }
      refreshGoblins()
      setRepositoryInitialized(true)
    }
    initRepository()
  }, [goblinRepository, refreshGoblins])

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
