import { createContext, useContext, useState, type ReactNode, useEffect, useMemo } from 'react'
import type { PartyStatus, ExpeditionRecord } from '../types/index.ts'
import { FirestoreExpeditionRepositoryAdapter } from '../repositories/FirestoreExpeditionRepositoryImpl.ts'

interface ExpeditionState {
  activeExpeditionPartyIds: number[]
  setPartyExpeditionStatus: (partyId: number, status: PartyStatus) => void
  isPartyInExpedition: (partyId: number) => boolean
  clearExpedition: (partyId: number) => void
  getExpeditionByPartyId: (partyId: number) => Promise<ExpeditionRecord | null>
  getOngoingExpeditions: () => ExpeditionRecord[]
  getPartyExpeditionHistory: (partyId: number) => Promise<ExpeditionRecord[]>
  expeditionRecords: ExpeditionRecord[]
  expeditionRepository: FirestoreExpeditionRepositoryAdapter | null
}

const ExpeditionStateContext = createContext<ExpeditionState | undefined>(undefined)

export const ExpeditionStateProvider = ({ children }: { children: ReactNode }) => {
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

  const setPartyExpeditionStatus = (partyId: number, status: PartyStatus) => {
    if (status === 'expedition') {
      setActiveExpeditionPartyIds(prev => [...prev.filter(id => id !== partyId), partyId])
    } else {
      setActiveExpeditionPartyIds(prev => prev.filter(id => id !== partyId))
    }
  }

  const isPartyInExpedition = (partyId: number): boolean => {
    return activeExpeditionPartyIds.includes(partyId)
  }

  const clearExpedition = (partyId: number) => {
    setActiveExpeditionPartyIds(prev => prev.filter(id => id !== partyId))
    setExpeditionRecords(prev => prev.filter(record => record.partyId !== partyId))
  }

  const getExpeditionByPartyId = async (partyId: number): Promise<ExpeditionRecord | null> => {
    console.log('expeditionRepository', expeditionRepository)
    if (expeditionRepository) {
      return await expeditionRepository.getExpeditionByPartyId(partyId)
    }
    return null
  }

  const getOngoingExpeditions = (): ExpeditionRecord[] => {
    return expeditionRecords
  }

  const getPartyExpeditionHistory = async (partyId: number): Promise<ExpeditionRecord[]> => {
    if (expeditionRepository) {
      return await expeditionRepository.getPartyExpeditionHistory(partyId, 2)
    }
    return []
  }

  return (
    <ExpeditionStateContext.Provider value={{
      activeExpeditionPartyIds,
      setPartyExpeditionStatus,
      isPartyInExpedition,
      clearExpedition,
      getExpeditionByPartyId,
      getOngoingExpeditions,
      getPartyExpeditionHistory,
      expeditionRecords,
      expeditionRepository
    }}>
      {children}
    </ExpeditionStateContext.Provider>
  )
}

export const useExpeditionState = () => {
  const context = useContext(ExpeditionStateContext)
  if (!context) {
    throw new Error('useExpeditionState must be used within ExpeditionStateProvider')
  }
  return context
}