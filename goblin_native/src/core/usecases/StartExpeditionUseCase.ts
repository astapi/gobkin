import type {
  ExpeditionReplay,
  ExpeditionRequest,
  Goblin,
  Party,
} from '../../shared/types'
import { normalizePartyRewardMultipliers } from '../../shared/types'
import { GoblinEntity, PartyEntity } from '../domain'
import type { IGoblinRepository, IPartyRepository } from '../repositories'
import { ExpeditionEngine } from '../services'

export class StartExpeditionUseCase {
  private readonly partyRepository: IPartyRepository
  private readonly goblinRepository: IGoblinRepository
  private readonly expeditionEngine: ExpeditionEngine

  constructor(
    partyRepository: IPartyRepository,
    goblinRepository: IGoblinRepository,
    expeditionEngine: ExpeditionEngine,
  ) {
    this.partyRepository = partyRepository
    this.goblinRepository = goblinRepository
    this.expeditionEngine = expeditionEngine
  }

  public async execute(request: ExpeditionRequest): Promise<ExpeditionReplay> {
    const partyId = Number.parseInt(request.partyId, 10)
    if (Number.isNaN(partyId)) {
      throw new Error('パーティIDが不正です')
    }

    const party = await this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error('パーティが見つかりません')
    }

    const partyEntity = new PartyEntity(party)
    if (!partyEntity.canStartExpedition()) {
      throw new Error('パーティが遠征可能な状態ではありません')
    }

    const goblins = await this.loadPartyMembers(party)
    if (goblins.length === 0) {
      throw new Error('遠征可能なメンバーがいません')
    }

    const replay = await this.expeditionEngine.generateExpedition(
      request,
      goblins,
      normalizePartyRewardMultipliers(party.rewardMultipliers)
    )
    await this.partyRepository.updatePartyStatus(partyId, 'expedition')
    return replay
  }

  private async loadPartyMembers(party: Party): Promise<Goblin[]> {
    const goblins: Goblin[] = []
    for (const id of party.memberIds) {
      const goblin = await this.goblinRepository.getGoblin(id)
      if (goblin) {
        goblins.push(new GoblinEntity(goblin).toSnapshot())
      }
    }
    return goblins
  }
}
