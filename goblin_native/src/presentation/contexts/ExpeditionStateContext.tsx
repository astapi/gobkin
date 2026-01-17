import { useState, useMemo, useCallback } from 'react'
import type { PartyStatus, ExpeditionRecord } from '../../shared/types'
import {
  ExpeditionStateContext,
  type ExpeditionStateProviderProps,
} from './ExpeditionStateContextValue'

export const ExpeditionStateProvider = ({ children }: ExpeditionStateProviderProps) => {
  const [activeExpeditionPartyIds, setActiveExpeditionPartyIds] = useState<number[]>([])
  const [expeditionRecords, setExpeditionRecords] = useState<ExpeditionRecord[]>([])

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
    return expeditionRecords.find(record => record.partyId === partyId) ?? null
  }, [expeditionRecords])

  const getOngoingExpeditions = useCallback((): ExpeditionRecord[] => {
    return expeditionRecords
  }, [expeditionRecords])

  const getPartyExpeditionHistory = useCallback(async (_partyId: number): Promise<ExpeditionRecord[]> => {
    // TODO: Implement with AsyncStorage repository
    return []
  }, [])

  const contextValue = useMemo(() => ({
    activeExpeditionPartyIds,
    setPartyExpeditionStatus,
    isPartyInExpedition,
    clearExpedition,
    getExpeditionByPartyId,
    getOngoingExpeditions,
    getPartyExpeditionHistory,
    expeditionRecords,
    expeditionRepository: null
  }), [
    activeExpeditionPartyIds,
    setPartyExpeditionStatus,
    isPartyInExpedition,
    clearExpedition,
    getExpeditionByPartyId,
    getOngoingExpeditions,
    getPartyExpeditionHistory,
    expeditionRecords,
  ])

  return (
    <ExpeditionStateContext.Provider value={contextValue}>
      {children}
    </ExpeditionStateContext.Provider>
  )
}
