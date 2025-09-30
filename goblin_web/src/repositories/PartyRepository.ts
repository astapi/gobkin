import type { Party, PartyStatus } from '../types/index.ts'

export interface PartyRepository {
  getParties(): Party[]
  getParty(id: number): Party | null
  saveParty(party: Party): void
  deleteParty(id: number): void
  updatePartyStatus(id: number, status: PartyStatus): void
  getPartiesByStatus(status: PartyStatus): Party[]
}