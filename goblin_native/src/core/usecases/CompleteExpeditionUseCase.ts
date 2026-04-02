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
  factorAcquisitions: Map<number, string[]>  // ゴブリンID -> 獲得因子ID[]
  newDungeonCaptured?: string  // 新しく制圧したダンジョンID
  goldGained: number  // 獲得したゴールド
  treasureDrops?: TreasureDrop[]  // 宝箱から獲得した装備
}

/**
 * 遠征完了時の処理を行うUseCase
 * - 経験値の付与とレベルアップ
 * - パーティステータスの更新
 */
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
    const party = this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error('パーティが見つかりません')
    }

    // 遠征に参加したゴブリンを取得
    const participantIds = replay.meta.party.map(id => Number.parseInt(id, 10))
    const goblins = participantIds
      .map(id => this.goblinRepository.getGoblin(id))
      .filter((g): g is NonNullable<typeof g> => g !== null)

    if (goblins.length === 0) {
      throw new Error('遠征メンバーが見つかりません')
    }

    // 各ゴブリンに経験値を付与
    const levelUps = new Map<number, LevelUpResult>()
    const updatedGoblinIds: number[] = []

    for (const goblin of goblins) {
      const entity = new GoblinEntity(goblin)

      // 死亡者には経験値を付与しない
      if (replay.summary.casualties.includes(goblin.id.toString())) {
        continue
      }

      // 負傷者は経験値50%
      const expMultiplier = replay.summary.injuries.includes(goblin.id.toString()) ? 0.5 : 1.0
      const expToGain = Math.floor(replay.summary.xpGained * expMultiplier)

      if (expToGain > 0) {
        const levelUpResult = entity.gainExperience(expToGain)
        levelUps.set(goblin.id, levelUpResult)

        // ゴブリンデータを更新
        const updatedGoblin = entity.toSnapshot()
        await this.goblinRepository.saveGoblin(updatedGoblin)
        updatedGoblinIds.push(goblin.id)
      }
    }

    // 因子獲得処理
    const factorAcquisitions = new Map<number, string[]>()
    const bossEvent = replay.events.find(
      (e): e is Extract<TimelineEvent, { type: 'boss' }> => e.type === 'boss'
    )

    if (bossEvent && bossEvent.combat.outcome === 'win') {
      // 敵データを取得してボスの因子ドロップを取得
      const enemyDatabase = getEnemyDatabase(replay.meta.areaId)

      if (enemyDatabase) {
        // ボスパターンの敵の中からfactorDropsを持つ敵を全て取得
        const bossPattern = enemyDatabase.patterns.find(p => p.isBoss)
        const bossEnemyIds = bossPattern?.enemies.flat() ?? [bossEvent.enemy.id]
        const enemiesWithFactorDrops = enemyDatabase.enemies.filter(
          e => bossEnemyIds.includes(e.id) && e.factorDrops && e.factorDrops.length > 0
        )

        if (enemiesWithFactorDrops.length > 0) {
          // 全ての敵のfactorDropsを結合
          const allFactorDrops = enemiesWithFactorDrops.flatMap(e => e.factorDrops!)

          // 生存しているゴブリンごとに因子獲得判定
          for (const goblin of goblins) {
            // 死亡者はスキップ
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

    // 宝箱装備をインベントリに保存
    const treasureDrops = replay.summary.treasureDrops ?? []
    if (treasureDrops.length > 0 && this.equipmentRepository) {
      for (const drop of treasureDrops) {
        const equipmentId = `eq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        this.equipmentRepository.save({
          id: equipmentId,
          templateId: drop.templateId,
          slotIndex: -1,    // 在庫
          goblinId: null,
          titleId: drop.titleId,
          titleName: drop.titleName,
        })
      }
    }

    // ゴールド付与とダンジョン制圧記録
    let newDungeonCaptured: string | undefined
    const goldGained = replay.summary.goldGained || 0

    const currentBaseState = this.baseStateRepository.getBaseState()
    if (currentBaseState) {
      // ゴールドを追加
      let updatedBaseState = {
        ...currentBaseState,
        gold: currentBaseState.gold + goldGained,
      }

      // 遠征成功時にダンジョン制圧を記録
      if (replay.summary.success) {
        const wasCaptured = currentBaseState.capturedDungeons.includes(replay.meta.areaId)
        updatedBaseState = captureDungeon(replay.meta.areaId, updatedBaseState)

        // 新しく制圧した場合
        if (!wasCaptured) {
          newDungeonCaptured = replay.meta.areaId
        }
      }

      // 拠点状態を保存
      this.baseStateRepository.saveBaseState(updatedBaseState)
    }

    // パーティステータスを待機中に戻す
    this.partyRepository.updatePartyStatus(partyId, 'idle')

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
