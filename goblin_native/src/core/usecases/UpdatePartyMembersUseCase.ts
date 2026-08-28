import type { Party } from '../../shared/types'
import type { IPartyRepository } from '../repositories'

const MAX_PARTY_MEMBERS = 6

export class UpdatePartyMembersUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public async execute(partyId: number, memberIds: number[]): Promise<Party> {
    const party = await this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error('パーティが見つかりません')
    }

    const uniqueMembers = Array.from(new Set(memberIds))
    if (uniqueMembers.length > MAX_PARTY_MEMBERS) {
      throw new Error('パーティメンバーが上限を超えています')
    }

    const updated: Party = {
      ...party,
      memberIds: uniqueMembers,
    }

    await this.partyRepository.saveParty(updated)
    return updated
  }
}
