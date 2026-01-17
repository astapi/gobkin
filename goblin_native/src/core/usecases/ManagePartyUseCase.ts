import type { Party } from '../../shared/types'
import { PartyEntity } from '../domain'
import type { IPartyRepository } from '../repositories'

export class ManagePartyUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public addMember(partyId: number, goblinId: string): Party {
    const party = this.requireParty(partyId)
    const partyEntity = new PartyEntity(party)
    partyEntity.addMember(goblinId)
    const updated = partyEntity.toSnapshot()
    this.partyRepository.saveParty(updated)
    return updated
  }

  public removeMember(partyId: number, goblinId: string): Party {
    const party = this.requireParty(partyId)
    const partyEntity = new PartyEntity(party)
    partyEntity.removeMember(goblinId)
    const updated = partyEntity.toSnapshot()
    this.partyRepository.saveParty(updated)
    return updated
  }

  public markIdle(partyId: number): void {
    this.partyRepository.updatePartyStatus(partyId, 'idle')
  }

  public markExpedition(partyId: number): void {
    this.partyRepository.updatePartyStatus(partyId, 'expedition')
  }

  private requireParty(partyId: number): Party {
    const party = this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error(`ID ${partyId} のパーティが見つかりません`)
    }
    return party
  }
}
