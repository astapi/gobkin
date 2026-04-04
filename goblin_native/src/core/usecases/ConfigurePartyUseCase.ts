import type { ExpeditionRequest, Party } from '../../shared/types'
import type { IPartyRepository } from '../repositories'

export class ConfigurePartyUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public async setDungeon(partyId: number, dungeonId: string): Promise<Party> {
    await this.partyRepository.updateDungeonSettings(partyId, dungeonId)
    return this.requireParty(partyId)
  }

  public async setTargetFloor(partyId: number, targetFloor: number | null): Promise<Party> {
    await this.partyRepository.updateFloorTarget(partyId, targetFloor)
    return this.requireParty(partyId)
  }

  public async setReturnPolicy(
    partyId: number,
    returnPolicy: ExpeditionRequest['returnPolicy']
  ): Promise<Party> {
    await this.partyRepository.updateReturnPolicy(partyId, returnPolicy)
    return this.requireParty(partyId)
  }

  private async requireParty(partyId: number): Promise<Party> {
    const party = await this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error(`ID ${partyId} のパーティが見つかりません`)
    }
    return party
  }
}
