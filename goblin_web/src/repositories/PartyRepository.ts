import type { Party } from '../types/index.ts'

export interface PartyRepository {
  getParties(): Party[]
  getParty(id: number): Party | null
  saveParty(party: Party): void
  deleteParty(id: number): void
}