import type { Party } from '../../shared/types'
import type { IPartyRepository } from '../repositories'

export class GetPartyByIdUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public async execute(partyId: number): Promise<Party> {
    const party = await this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error(`ID ${partyId} のパーティが見つかりません`)
    }
    return party
  }
}
