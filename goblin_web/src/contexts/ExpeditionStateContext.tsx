import { createContext, useContext, useState, ReactNode } from 'react'
import type { PartyStatus } from '../types/index.ts'

interface ExpeditionState {
  activeExpeditionPartyIds: number[]
  setPartyExpeditionStatus: (partyId: number, status: PartyStatus) => void
  isPartyInExpedition: (partyId: number) => boolean
  clearExpedition: (partyId: number) => void
}

const ExpeditionStateContext = createContext<ExpeditionState | undefined>(undefined)

export const ExpeditionStateProvider = ({ children }: { children: ReactNode }) => {
  const [activeExpeditionPartyIds, setActiveExpeditionPartyIds] = useState<number[]>([])

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
  }

  return (
    <ExpeditionStateContext.Provider value={{
      activeExpeditionPartyIds,
      setPartyExpeditionStatus,
      isPartyInExpedition,
      clearExpedition
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