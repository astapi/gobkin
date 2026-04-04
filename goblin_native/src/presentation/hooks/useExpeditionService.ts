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

  const refreshExpeditions = useCallback(async () => {
    if (!repositoryRef.current) return
    const records = await repositoryRef.current.getAll()
    setExpeditionRecords(records)
  }, [])

  useEffect(() => {
    const repository = getRepository()
    repositoryRef.current = repository

    void repository.getAll().then(records => {
      setExpeditionRecords(records)
      setIsLoading(false)
    })
  }, [])

  const getExpeditionById = useCallback(async (id: string): Promise<ExpeditionRecord | null> => {
    if (!repositoryRef.current) return null
    return repositoryRef.current.getById(id)
  }, [])

  const getPartyExpeditionHistory = useCallback(async (partyId: number, limit = 2): Promise<ExpeditionRecord[]> => {
    if (!repositoryRef.current) return []
    const records = await repositoryRef.current.getByPartyId(partyId)
    return records.slice(0, limit)
  }, [])

  const saveExpeditionRecord = useCallback(async (record: ExpeditionRecord) => {
    if (!repositoryRef.current) return
    await repositoryRef.current.save(record)
    await refreshExpeditions()
  }, [refreshExpeditions])

  const updateExpeditionReplay = useCallback(async (id: string, replay: ExpeditionReplay) => {
    if (!repositoryRef.current) return
    const record = await repositoryRef.current.getById(id)
    if (!record) return
    await repositoryRef.current.save({
      ...record,
      replay,
      updatedAt: new Date(),
    })
    await refreshExpeditions()
  }, [refreshExpeditions])

  const completeExpeditionRecord = useCallback(async (id: string, replay: ExpeditionReplay) => {
    if (!repositoryRef.current) return
    await repositoryRef.current.complete(id, replay)
    await refreshExpeditions()
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
