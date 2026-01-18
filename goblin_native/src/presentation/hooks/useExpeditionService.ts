import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExpeditionRecord, ExpeditionReplay } from '@/shared/types'
import { SQLiteExpeditionRepository } from '@/infrastructure/repositories'

let repositoryInstance: SQLiteExpeditionRepository | null = null
let dataChangeSubscribers: Set<() => void> = new Set()
let dataChangeListenerBound = false

const getRepository = (): SQLiteExpeditionRepository => {
  if (!repositoryInstance) {
    repositoryInstance = new SQLiteExpeditionRepository()
  }
  return repositoryInstance
}

export const useExpeditionService = () => {
  const [expeditionRecords, setExpeditionRecords] = useState<ExpeditionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const repositoryRef = useRef<SQLiteExpeditionRepository | null>(null)

  const bindDataChangeListener = useCallback((repository: SQLiteExpeditionRepository) => {
    if (dataChangeListenerBound) return
    repository.setOnDataChange(() => {
      dataChangeSubscribers.forEach(callback => callback())
    })
    dataChangeListenerBound = true
  }, [])

  const refreshExpeditions = useCallback(() => {
    if (!repositoryRef.current) return
    setExpeditionRecords(repositoryRef.current.getAll())
  }, [])

  useEffect(() => {
    const repository = getRepository()
    repositoryRef.current = repository

    const initializeAndLoad = async () => {
      try {
        await repository.initialize()
        setExpeditionRecords(repository.getAll())
      } catch (error) {
        console.error('[useExpeditionService] Failed to initialize:', error)
      } finally {
        setIsLoading(false)
      }
    }

    bindDataChangeListener(repository)
    const handleDataChange = () => {
      setExpeditionRecords(repository.getAll())
    }
    dataChangeSubscribers.add(handleDataChange)

    initializeAndLoad()

    return () => {
      dataChangeSubscribers.delete(handleDataChange)
    }
  }, [bindDataChangeListener])

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
  }, [])

  const updateExpeditionReplay = useCallback((id: string, replay: ExpeditionReplay) => {
    if (!repositoryRef.current) return
    const record = repositoryRef.current.getById(id)
    if (!record) return
    repositoryRef.current.save({
      ...record,
      replay,
      updatedAt: new Date(),
    })
  }, [])

  const completeExpeditionRecord = useCallback((id: string, replay: ExpeditionReplay) => {
    if (!repositoryRef.current) return
    repositoryRef.current.complete(id, replay)
  }, [])

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
