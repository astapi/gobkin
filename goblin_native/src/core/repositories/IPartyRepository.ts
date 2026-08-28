import type { Party, PartyStatus, ExpeditionRequest, DungeonTier } from '../../shared/types'

export interface IPartyRepository {
  getParties(): Promise<Party[]>
  getParty(id: number): Promise<Party | null>
  saveParty(party: Party): Promise<void>
  deleteParty(id: number): Promise<void>
  updatePartyStatus(id: number, status: PartyStatus): Promise<void>
  getPartiesByStatus(status: PartyStatus): Promise<Party[]>
  updateDungeonSettings(id: number, dungeonId: string): Promise<void>
  updateDungeonTier(id: number, tier: DungeonTier): Promise<void>
  updateFloorTarget(id: number, targetFloor: number | null): Promise<void>
  updateReturnPolicy(id: number, returnPolicy: ExpeditionRequest['returnPolicy']): Promise<void>
}
