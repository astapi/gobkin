import type { ExpeditionRequest, Party } from '../../shared/types'
import type { IPartyRepository } from '../repositories'

export interface CreatePartyInput {
  name: string
  memberIds: number[]
  dungeonId?: string
  returnPolicy?: ExpeditionRequest['returnPolicy']
}

export class CreatePartyUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public async execute(input: CreatePartyInput): Promise<Party> {
    const parties = await this.partyRepository.getParties()
    const nextId =
      parties.length === 0 ? 1 : Math.max(...parties.map(existing => existing.id)) + 1

    const uniqueMembers = Array.from(new Set(input.memberIds))

    const party: Party = {
      id: nextId,
      name: input.name,
      memberIds: uniqueMembers,
      status: 'idle',
      dungeonId: input.dungeonId,
      returnPolicy: input.returnPolicy,
    }

    await this.partyRepository.saveParty(party)
    return party
  }
}
