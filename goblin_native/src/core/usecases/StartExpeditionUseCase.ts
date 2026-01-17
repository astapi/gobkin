import type {
  ExpeditionReplay,
  ExpeditionRequest,
  Goblin,
  Party,
} from '../../shared/types'
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

    const party = this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error('パーティが見つかりません')
    }

    const partyEntity = new PartyEntity(party)
    if (!partyEntity.canStartExpedition()) {
      throw new Error('パーティが遠征可能な状態ではありません')
    }

    const goblins = this.loadPartyMembers(party)
    if (goblins.length === 0) {
      throw new Error('遠征可能なメンバーがいません')
    }

    const replay = await this.expeditionEngine.generateExpedition(request, goblins)
    this.partyRepository.updatePartyStatus(partyId, 'expedition')
    return replay
  }

  private loadPartyMembers(party: Party): Goblin[] {
    return party.memberIds
      .map(id => this.goblinRepository.getGoblin(id))
      .filter((goblin): goblin is Goblin => Boolean(goblin))
      .map(goblin => new GoblinEntity(goblin).toSnapshot())
  }
}
