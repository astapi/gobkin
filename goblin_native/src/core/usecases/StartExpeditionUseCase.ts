import type {
  ExpeditionMeta,
  ExpeditionRequest,
  Goblin,
  Party,
} from '../../shared/types'
import { normalizePartyRewardMultipliers } from '../../shared/types'
import { getEffectiveStats } from '../../shared/utils/goblinStats'
import { GoblinEntity, PartyEntity } from '../domain'
import type { IGoblinRepository, IPartyRepository } from '../repositories'

export class StartExpeditionUseCase {
  private readonly partyRepository: IPartyRepository
  private readonly goblinRepository: IGoblinRepository

  constructor(
    partyRepository: IPartyRepository,
    goblinRepository: IGoblinRepository,
  ) {
    this.partyRepository = partyRepository
    this.goblinRepository = goblinRepository
  }

  public async execute(request: ExpeditionRequest): Promise<ExpeditionMeta> {
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

    const departingGoblins = goblins.map(goblin => ({
      ...goblin,
      currentHp: goblin.currentHp === 0 ? 0 : getEffectiveStats(goblin).hp,
    }))

    await Promise.all(
      departingGoblins.map(goblin => this.goblinRepository.updateGoblinCurrentHp(goblin.id, goblin.currentHp!))
    )

    const seed = Math.floor(Math.random() * 0x7FFFFFFF)
    await this.partyRepository.updatePartyStatus(partyId, 'expedition')

    return {
      seed,
      request,
      departingGoblins,
      rewardMultipliers: normalizePartyRewardMultipliers(party.rewardMultipliers),
    }
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
