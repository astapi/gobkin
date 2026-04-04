/**
 * 待機中ゴブリン管理用カスタムフック
 * SQLitePendingGoblinRepositoryを使用して待機中のゴブリンを管理
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Goblin } from '@/shared/types'
import { SQLitePendingGoblinRepository } from '@/infrastructure/repositories'

const getRepository = (): SQLitePendingGoblinRepository => {
  return SQLitePendingGoblinRepository.getInstance()
}

export function usePendingGoblins() {
  const [pendingGoblins, setPendingGoblins] = useState<Goblin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const repositoryRef = useRef<SQLitePendingGoblinRepository | null>(null)

  useEffect(() => {
    const repository = getRepository()
    repositoryRef.current = repository

    void repository.getPendingGoblins().then(goblins => {
      setPendingGoblins(goblins)
      setIsLoading(false)
    })
  }, [])

  const addPendingGoblin = useCallback(async (goblin: Goblin) => {
    if (!repositoryRef.current) return

    await repositoryRef.current.addPendingGoblin(goblin)
    const goblins = await repositoryRef.current.getPendingGoblins()
    setPendingGoblins(goblins)
  }, [])

  const removePendingGoblin = useCallback(async (id: number) => {
    if (!repositoryRef.current) return

    await repositoryRef.current.removePendingGoblin(id)
    const goblins = await repositoryRef.current.getPendingGoblins()
    setPendingGoblins(goblins)
  }, [])

  const clearPendingGoblins = useCallback(async () => {
    if (!repositoryRef.current) return

    await repositoryRef.current.clearPendingGoblins()
    setPendingGoblins([])
  }, [])

  const getPendingGoblinById = useCallback((id: number): Goblin | undefined => {
    return pendingGoblins.find(g => g.id === id)
  }, [pendingGoblins])

  const refreshPendingGoblins = useCallback(async () => {
    if (!repositoryRef.current) return
    const goblins = await repositoryRef.current.getPendingGoblins()
    setPendingGoblins(goblins)
  }, [])

  return {
    pendingGoblins,
    isLoading,
    addPendingGoblin,
    removePendingGoblin,
    clearPendingGoblins,
    getPendingGoblinById,
    refreshPendingGoblins,
    pendingCount: pendingGoblins.length,
  }
}
