import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ExpeditionRecord, PartyStatus } from '../../shared/types'
import type { FirestoreExpeditionRepositoryAdapter } from '../../infrastructure/repositories/FirestoreExpeditionRepositoryImpl'

export interface ExpeditionState {
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

export const ExpeditionStateContext = createContext<ExpeditionState | undefined>(undefined)

export const useExpeditionState = (): ExpeditionState => {
  const context = useContext(ExpeditionStateContext)
  if (!context) {
    throw new Error('useExpeditionState must be used within ExpeditionStateProvider')
  }
  return context
}

export type ExpeditionStateProviderProps = {
  children: ReactNode
}
