import { useState, useEffect, useMemo, useCallback } from 'react'
import type { PartyStatus, ExpeditionRecord } from '../../shared/types'
import { FirestoreExpeditionRepositoryAdapter } from '../../infrastructure/repositories/FirestoreExpeditionRepositoryImpl'
import {
  ExpeditionStateContext,
  type ExpeditionStateProviderProps,
} from './ExpeditionStateContextValue'

export const ExpeditionStateProvider = ({ children }: ExpeditionStateProviderProps) => {
  const [activeExpeditionPartyIds, setActiveExpeditionPartyIds] = useState<number[]>([])
  const [expeditionRecords, setExpeditionRecords] = useState<ExpeditionRecord[]>([])

  // Firestoreを使用している場合のみリポジトリを初期化
  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'
  const expeditionRepository = useMemo(() =>
    useFirestore ? new FirestoreExpeditionRepositoryAdapter() : null, [useFirestore]
  )

  // 進行中の遠征データを読み込み
  useEffect(() => {
    if (expeditionRepository) {
      expeditionRepository.setOnDataChange(() => {
        const records = expeditionRepository.getOngoingExpeditions()
        setExpeditionRecords(records)
        setActiveExpeditionPartyIds(records.map(record => record.partyId))
      })
    }
  }, [expeditionRepository])

  const setPartyExpeditionStatus = useCallback((partyId: number, status: PartyStatus) => {
    if (status === 'expedition') {
      setActiveExpeditionPartyIds(prev => [...prev.filter(id => id !== partyId), partyId])
    } else {
      setActiveExpeditionPartyIds(prev => prev.filter(id => id !== partyId))
    }
  }, [])

  const isPartyInExpedition = useCallback((partyId: number): boolean => {
    return activeExpeditionPartyIds.includes(partyId)
  }, [activeExpeditionPartyIds])

  const clearExpedition = useCallback((partyId: number) => {
    setActiveExpeditionPartyIds(prev => prev.filter(id => id !== partyId))
    setExpeditionRecords(prev => prev.filter(record => record.partyId !== partyId))
  }, [])

  const getExpeditionByPartyId = useCallback(async (partyId: number): Promise<ExpeditionRecord | null> => {
    console.log('expeditionRepository', expeditionRepository)
    if (expeditionRepository) {
      return await expeditionRepository.getExpeditionByPartyId(partyId)
    }
    return null
  }, [expeditionRepository])

  const getOngoingExpeditions = useCallback((): ExpeditionRecord[] => {
    return expeditionRecords
  }, [expeditionRecords])

  const getPartyExpeditionHistory = useCallback(async (partyId: number): Promise<ExpeditionRecord[]> => {
    if (expeditionRepository) {
      return await expeditionRepository.getPartyExpeditionHistory(partyId, 2)
    }
    return []
  }, [expeditionRepository])

  const contextValue = useMemo(() => ({
    activeExpeditionPartyIds,
    setPartyExpeditionStatus,
    isPartyInExpedition,
    clearExpedition,
    getExpeditionByPartyId,
    getOngoingExpeditions,
    getPartyExpeditionHistory,
    expeditionRecords,
    expeditionRepository
  }), [
    activeExpeditionPartyIds,
    setPartyExpeditionStatus,
    isPartyInExpedition,
    clearExpedition,
    getExpeditionByPartyId,
    getOngoingExpeditions,
    getPartyExpeditionHistory,
    expeditionRecords,
    expeditionRepository
  ])

  return (
    <ExpeditionStateContext.Provider value={contextValue}>
      {children}
    </ExpeditionStateContext.Provider>
  )
}
