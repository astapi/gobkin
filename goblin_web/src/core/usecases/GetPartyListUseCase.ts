import type { Party } from '../../shared/types'
import type { IPartyRepository } from '../repositories'

export class GetPartyListUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public execute(): Party[] {
    return this.partyRepository.getParties()
  }
}
