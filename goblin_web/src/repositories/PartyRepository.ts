import type { Party, PartyStatus, ExpeditionRequest } from '../shared/types'

export interface PartyRepository {
  getParties(): Party[]
  getParty(id: number): Party | null
  saveParty(party: Party): void
  deleteParty(id: number): void
  updatePartyStatus(id: number, status: PartyStatus): void
  getPartiesByStatus(status: PartyStatus): Party[]
  updateDungeonSettings(id: number, dungeonId: number): void
  updateFloorTarget(id: number, targetFloor: number | null): void
  updateReturnPolicy(id: number, returnPolicy: ExpeditionRequest["returnPolicy"]): void
}