import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Goblin } from '../../shared/types'
import { JsonGoblinRepositoryImpl } from '../../infrastructure/repositories/JsonGoblinRepositoryImpl'
import {
  FirestoreGoblinRepositoryAdapter,
} from '../../infrastructure/repositories/FirestoreGoblinRepositoryImpl'
import type { IGoblinRepository } from '../../core/repositories'
import { GetGoblinListUseCase } from '../../core/usecases'

type ListenerCapableGoblinRepository = IGoblinRepository & {
  setOnDataChange?: (callback: () => void) => void
}

export const useGoblinService = () => {
  const [repositoryInitialized, setRepositoryInitialized] = useState(false)
  const [goblins, setGoblins] = useState<Goblin[]>([])

  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'

  const goblinRepository = useMemo<ListenerCapableGoblinRepository>(() => {
    return useFirestore
      ? new FirestoreGoblinRepositoryAdapter()
      : new JsonGoblinRepositoryImpl()
  }, [useFirestore])

  const getGoblinListUseCase = useMemo(
    () => new GetGoblinListUseCase(goblinRepository),
    [goblinRepository],
  )

  const refreshGoblins = useCallback(() => {
    setGoblins(getGoblinListUseCase.execute())
  }, [getGoblinListUseCase])

  useEffect(() => {
    refreshGoblins()

    if (goblinRepository.setOnDataChange) {
      goblinRepository.setOnDataChange(() => {
        refreshGoblins()
        setRepositoryInitialized(true)
      })
    } else {
      setRepositoryInitialized(true)
    }
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

  const equipItem = useCallback(
    (goblinId: number, slotIndex: number, itemId: string) => {
      goblinRepository.equipItem(goblinId, slotIndex, itemId)
      refreshGoblins()
    },
    [goblinRepository, refreshGoblins],
  )

  const unequipItem = useCallback(
    (goblinId: number, slotIndex: number) => {
      goblinRepository.unequipItem(goblinId, slotIndex)
      refreshGoblins()
    },
    [goblinRepository, refreshGoblins],
  )

  return {
    goblinRepository,
    goblins,
    isLoading: useFirestore && !repositoryInitialized,
    refreshGoblins,
    getGoblinById,
    saveGoblin,
    deleteGoblin,
    updateGoblinLevel,
    equipItem,
    unequipItem,
  }
}
