import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExpeditionRecord, ExpeditionReplay } from '@/shared/types'
import { SQLiteExpeditionRepository } from '@/infrastructure/repositories'

const getRepository = (): SQLiteExpeditionRepository => {
  return SQLiteExpeditionRepository.getInstance()
}

export const useExpeditionService = () => {
  const [expeditionRecords, setExpeditionRecords] = useState<ExpeditionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const repositoryRef = useRef<SQLiteExpeditionRepository | null>(null)

  const refreshExpeditions = useCallback(() => {
    if (!repositoryRef.current) return
    setExpeditionRecords(repositoryRef.current.getAll())
  }, [])

  useEffect(() => {
    const repository = getRepository()
    repositoryRef.current = repository

    // 初回のデータ取得
    setExpeditionRecords(repository.getAll())
    setIsLoading(false)
  }, [])

  const getExpeditionById = useCallback((id: string): ExpeditionRecord | null => {
    if (!repositoryRef.current) return null
    return repositoryRef.current.getById(id)
  }, [])

  const getPartyExpeditionHistory = useCallback((partyId: number, limit = 2): ExpeditionRecord[] => {
    if (!repositoryRef.current) return []
    const records = repositoryRef.current.getByPartyId(partyId)
    return records.slice(0, limit)
  }, [])

  const saveExpeditionRecord = useCallback((record: ExpeditionRecord) => {
    if (!repositoryRef.current) return
    repositoryRef.current.save(record)
    refreshExpeditions()
  }, [refreshExpeditions])

  const updateExpeditionReplay = useCallback((id: string, replay: ExpeditionReplay) => {
    if (!repositoryRef.current) return
    const record = repositoryRef.current.getById(id)
    if (!record) return
    repositoryRef.current.save({
      ...record,
      replay,
      updatedAt: new Date(),
    })
    refreshExpeditions()
  }, [refreshExpeditions])

  const completeExpeditionRecord = useCallback((id: string, replay: ExpeditionReplay) => {
    if (!repositoryRef.current) return
    repositoryRef.current.complete(id, replay)
    refreshExpeditions()
  }, [refreshExpeditions])

  return {
    expeditionRepository: repositoryRef.current,
    expeditionRecords,
    isLoading,
    refreshExpeditions,
    getExpeditionById,
    getPartyExpeditionHistory,
    saveExpeditionRecord,
    updateExpeditionReplay,
    completeExpeditionRecord,
  }
}
