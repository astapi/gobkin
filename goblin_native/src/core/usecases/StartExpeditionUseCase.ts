import type {
  ExpeditionBoost,
  ExpeditionMeta,
  ExpeditionRequest,
  Goblin,
  Party,
} from '../../shared/types'
import { normalizePartyRewardMultipliers } from '../../shared/types'
import { calculateGoblinEffectiveStats } from '../../shared/utils/goblinStats'
import { EquipmentService } from '../services/EquipmentService'
import { PartyEntity } from '../domain'
import type { IGoblinRepository, IPartyRepository, IEquipmentRepository } from '../repositories'

export class StartExpeditionUseCase {
  private readonly partyRepository: IPartyRepository
  private readonly goblinRepository: IGoblinRepository
  private readonly equipmentRepository: IEquipmentRepository

  constructor(
    partyRepository: IPartyRepository,
    goblinRepository: IGoblinRepository,
    equipmentRepository: IEquipmentRepository,
  ) {
    this.partyRepository = partyRepository
    this.goblinRepository = goblinRepository
    this.equipmentRepository = equipmentRepository
  }

  public async execute(
    request: ExpeditionRequest,
    expeditionBoost?: ExpeditionBoost,
  ): Promise<ExpeditionMeta> {
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

    const departingGoblins = await this.prepareDepartingGoblins(goblins)

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
      expeditionBoost,
    }
  }

  /**
   * 遠征出発時のゴブリンデータを準備する。
   * 遠征開始時点の装備状態から実効ステータスを再計算する。
   * DB の effectiveStats が古い場合でも、戦闘には現在の装備を反映する。
   */
  private async prepareDepartingGoblins(goblins: Goblin[]): Promise<Goblin[]> {
    return Promise.all(goblins.map(async goblin => {
      const equippedItems = await this.equipmentRepository.getByGoblinId(goblin.id)
      const equipmentSkills = EquipmentService.collectGrantedSkills(equippedItems)
      const mergedSkills = [...goblin.skills, ...equipmentSkills]
      const effectiveStats = calculateGoblinEffectiveStats(
        { ...goblin, skills: mergedSkills },
        equippedItems,
      )
      return {
        ...goblin,
        skills: mergedSkills,
        effectiveStats,
        // 遠征開始時はHP0を含む全員を復活・全回復する。
        currentHp: effectiveStats.hp,
      }
    }))
  }

  private async loadPartyMembers(party: Party): Promise<Goblin[]> {
    const goblins: Goblin[] = []
    for (const id of party.memberIds) {
      const goblin = await this.goblinRepository.getGoblin(id)
      if (goblin) {
        goblins.push(goblin)
      }
    }
    return goblins
  }
}
