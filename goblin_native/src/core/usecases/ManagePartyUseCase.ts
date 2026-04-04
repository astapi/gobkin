import type { Party } from '../../shared/types'
import { PartyEntity } from '../domain'
import type { IPartyRepository } from '../repositories'

export class ManagePartyUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public async addMember(partyId: number, goblinId: string): Promise<Party> {
    const party = await this.requireParty(partyId)
    const partyEntity = new PartyEntity(party)
    partyEntity.addMember(goblinId)
    const updated = partyEntity.toSnapshot()
    await this.partyRepository.saveParty(updated)
    return updated
  }

  public async removeMember(partyId: number, goblinId: string): Promise<Party> {
    const party = await this.requireParty(partyId)
    const partyEntity = new PartyEntity(party)
    partyEntity.removeMember(goblinId)
    const updated = partyEntity.toSnapshot()
    await this.partyRepository.saveParty(updated)
    return updated
  }

  public async markIdle(partyId: number): Promise<void> {
    await this.partyRepository.updatePartyStatus(partyId, 'idle')
  }

  public async markExpedition(partyId: number): Promise<void> {
    await this.partyRepository.updatePartyStatus(partyId, 'expedition')
  }

  private async requireParty(partyId: number): Promise<Party> {
    const party = await this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error(`ID ${partyId} のパーティが見つかりません`)
    }
    return party
  }
}
