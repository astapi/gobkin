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

  // リポジトリからデータを取得（アプリ起動時に既に初期化済み）
  useEffect(() => {
    const repository = getRepository()
    repositoryRef.current = repository

    // 初回のデータ取得
    setPendingGoblins(repository.getPendingGoblins())
    setIsLoading(false)
  }, [])

  // 待機中ゴブリンを追加
  const addPendingGoblin = useCallback((goblin: Goblin) => {
    if (!repositoryRef.current) return

    repositoryRef.current.addPendingGoblin(goblin)
    setPendingGoblins(repositoryRef.current.getPendingGoblins())
  }, [])

  // 待機中ゴブリンを削除（受け入れ時）
  const removePendingGoblin = useCallback((id: number) => {
    if (!repositoryRef.current) return

    repositoryRef.current.removePendingGoblin(id)
    setPendingGoblins(repositoryRef.current.getPendingGoblins())
  }, [])

  // 全待機中ゴブリンをクリア
  const clearPendingGoblins = useCallback(() => {
    if (!repositoryRef.current) return

    repositoryRef.current.clearPendingGoblins()
    setPendingGoblins([])
  }, [])

  // 指定IDの待機中ゴブリンを取得
  const getPendingGoblinById = useCallback((id: number): Goblin | undefined => {
    return pendingGoblins.find(g => g.id === id)
  }, [pendingGoblins])

  const refreshPendingGoblins = useCallback(() => {
    if (!repositoryRef.current) return
    setPendingGoblins(repositoryRef.current.getPendingGoblins())
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
