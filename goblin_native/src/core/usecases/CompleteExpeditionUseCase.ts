import type { ExpeditionReplay, TimelineEvent, TreasureDrop } from '../../shared/types'
import { getEnemyDatabase } from '../../shared/data/enemy'
import { GoblinEntity } from '../domain'
import type { IGoblinRepository, IPartyRepository, IBaseStateRepository } from '../repositories'
import type { IEquipmentRepository } from '../repositories/IEquipmentRepository'
import type { LevelUpResult } from '../services/ExperienceSystem'
import { FactorService } from '../services/FactorService'
import { captureDungeon } from '../services/BaseRankSystem'

export interface ExpeditionCompletionResult {
  levelUps: Map<number, LevelUpResult>
  updatedGoblinIds: number[]
  factorAcquisitions: Map<number, string[]>
  newDungeonCaptured?: string
  goldGained: number
  treasureDrops?: TreasureDrop[]
}

export class CompleteExpeditionUseCase {
  private readonly goblinRepository: IGoblinRepository
  private readonly partyRepository: IPartyRepository
  private readonly baseStateRepository: IBaseStateRepository
  private readonly equipmentRepository?: IEquipmentRepository

  constructor(
    goblinRepository: IGoblinRepository,
    partyRepository: IPartyRepository,
    baseStateRepository: IBaseStateRepository,
    equipmentRepository?: IEquipmentRepository
  ) {
    this.goblinRepository = goblinRepository
    this.partyRepository = partyRepository
    this.baseStateRepository = baseStateRepository
    this.equipmentRepository = equipmentRepository
  }

  public async execute(
    partyId: number,
    replay: ExpeditionReplay
  ): Promise<ExpeditionCompletionResult> {
    const party = await this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error('パーティが見つかりません')
    }

    const participantIds = replay.meta.party.map(id => Number.parseInt(id, 10))
    const goblins = (
      await Promise.all(participantIds.map(id => this.goblinRepository.getGoblin(id)))
    ).filter((g): g is NonNullable<typeof g> => g !== null)

    if (goblins.length === 0) {
      throw new Error('遠征メンバーが見つかりません')
    }

    const levelUps = new Map<number, LevelUpResult>()
    const updatedGoblinIds: number[] = []

    for (const goblin of goblins) {
      const entity = new GoblinEntity(goblin)

      if (replay.summary.casualties.includes(goblin.id.toString())) {
        continue
      }

      const expToGain = replay.summary.xpGained

      if (expToGain > 0) {
        const levelUpResult = entity.gainExperience(expToGain)
        levelUps.set(goblin.id, levelUpResult)

        const updatedGoblin = entity.toSnapshot()
        await this.goblinRepository.saveGoblin(updatedGoblin)
        updatedGoblinIds.push(goblin.id)
      }
    }

    const factorAcquisitions = new Map<number, string[]>()
    const bossEvent = replay.events.find(
      (e): e is Extract<TimelineEvent, { type: 'boss' }> => e.type === 'boss'
    )

    if (bossEvent && bossEvent.combat.outcome === 'win') {
      const enemyDatabase = getEnemyDatabase(replay.meta.areaId)

      if (enemyDatabase) {
        const bossPattern = enemyDatabase.patterns.find(p => p.isBoss)
        const bossEnemyIds = bossPattern?.enemies.flat() ?? [bossEvent.enemy.id]
        const enemiesWithFactorDrops = enemyDatabase.enemies.filter(
          e => bossEnemyIds.includes(e.id) && e.factorDrops && e.factorDrops.length > 0
        )

        if (enemiesWithFactorDrops.length > 0) {
          const allFactorDrops = enemiesWithFactorDrops.flatMap(e => e.factorDrops!)

          for (const goblin of goblins) {
            if (replay.summary.casualties.includes(goblin.id.toString())) {
              continue
            }

            const acquired = FactorService.rollFactorDrops(
              goblin,
              allFactorDrops,
              replay.meta.seed
            )

            if (acquired.length > 0) {
              const updatedGoblin = FactorService.addFactors(goblin, acquired)
              await this.goblinRepository.saveGoblin(updatedGoblin)
              factorAcquisitions.set(goblin.id, acquired)

              if (!updatedGoblinIds.includes(goblin.id)) {
                updatedGoblinIds.push(goblin.id)
              }
            }
          }
        }
      } else {
        console.warn(`Enemy data not found for area: ${replay.meta.areaId}`)
      }
    }

    const treasureDrops = replay.summary.treasureDrops ?? []
    if (treasureDrops.length > 0 && this.equipmentRepository) {
      for (const drop of treasureDrops) {
        const equipmentId = `eq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await this.equipmentRepository.save({
          id: equipmentId,
          templateId: drop.templateId,
          slotIndex: -1,
          goblinId: null,
          titleId: drop.titleId,
          titleName: drop.titleName,
        })
      }
    }

    let newDungeonCaptured: string | undefined
    const goldGained = replay.summary.goldGained || 0

    const currentBaseState = await this.baseStateRepository.getBaseState()
    if (currentBaseState) {
      let updatedBaseState = {
        ...currentBaseState,
        gold: currentBaseState.gold + goldGained,
      }

      if (replay.summary.success) {
        const wasCaptured = currentBaseState.capturedDungeons.includes(replay.meta.areaId)
        updatedBaseState = captureDungeon(replay.meta.areaId, updatedBaseState)

        if (!wasCaptured) {
          newDungeonCaptured = replay.meta.areaId
        }
      }

      await this.baseStateRepository.saveBaseState(updatedBaseState)
    }

    await this.partyRepository.updatePartyStatus(partyId, 'idle')

    return {
      levelUps,
      updatedGoblinIds,
      factorAcquisitions,
      newDungeonCaptured,
      goldGained,
      treasureDrops: treasureDrops.length > 0 ? treasureDrops : undefined,
    }
  }
}
