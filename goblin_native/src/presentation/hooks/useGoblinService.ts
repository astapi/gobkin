import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Goblin } from '../../shared/types'
import { SQLiteGoblinRepository } from '../../infrastructure/repositories/SQLiteGoblinRepository'
import type { IGoblinRepository } from '../../core/repositories'
import { GetGoblinListUseCase } from '../../core/usecases'

export const useGoblinService = () => {
  const [goblins, setGoblins] = useState<Goblin[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const goblinRepository = useMemo<IGoblinRepository>(() => {
    return SQLiteGoblinRepository.getInstance()
  }, [])

  const getGoblinListUseCase = useMemo(
    () => new GetGoblinListUseCase(goblinRepository),
    [goblinRepository],
  )

  const refreshGoblins = useCallback(async () => {
    const list = await getGoblinListUseCase.execute()
    setGoblins(list)
  }, [getGoblinListUseCase])

  useEffect(() => {
    void refreshGoblins().then(() => setIsLoading(false))
  }, [refreshGoblins])

  const getGoblinById = useCallback(
    async (goblinId: number): Promise<Goblin> => {
      const goblin = await goblinRepository.getGoblin(goblinId)
      if (!goblin) {
        throw new Error(`ID ${goblinId} のゴブリンが見つかりません`)
      }
      return goblin
    },
    [goblinRepository],
  )

  const saveGoblin = useCallback(
    async (goblin: Goblin) => {
      await goblinRepository.saveGoblin(goblin)
      await refreshGoblins()
    },
    [goblinRepository, refreshGoblins],
  )

  const deleteGoblin = useCallback(
    async (goblinId: number) => {
      await goblinRepository.deleteGoblin(goblinId)
      await refreshGoblins()
    },
    [goblinRepository, refreshGoblins],
  )

  const updateGoblinLevel = useCallback(
    async (goblinId: number, level: number) => {
      await goblinRepository.updateGoblinLevel(goblinId, level)
      await refreshGoblins()
    },
    [goblinRepository, refreshGoblins],
  )

  return {
    goblinRepository,
    goblins,
    isLoading,
    refreshGoblins,
    getGoblinById,
    saveGoblin,
    deleteGoblin,
    updateGoblinLevel,
  }
}
