import type { ExpeditionRequest, Party } from '../../shared/types'
import type { IPartyRepository } from '../repositories'

export class ConfigurePartyUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public setDungeon(partyId: number, dungeonId: string): Party {
    this.partyRepository.updateDungeonSettings(partyId, dungeonId)
    return this.requireParty(partyId)
  }

  public setTargetFloor(partyId: number, targetFloor: number | null): Party {
    this.partyRepository.updateFloorTarget(partyId, targetFloor)
    return this.requireParty(partyId)
  }

  public setReturnPolicy(
    partyId: number,
    returnPolicy: ExpeditionRequest['returnPolicy']
  ): Party {
    this.partyRepository.updateReturnPolicy(partyId, returnPolicy)
    return this.requireParty(partyId)
  }

  private requireParty(partyId: number): Party {
    const party = this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error(`ID ${partyId} のパーティが見つかりません`)
    }
    return party
  }
}
