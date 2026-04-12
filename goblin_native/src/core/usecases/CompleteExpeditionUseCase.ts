import type { ExpeditionReplay, Goblin, MemberLevelUp, TimelineEvent, TreasureDrop } from '../../shared/types'
import { getEnemyDatabase } from '../../shared/data/enemy'
import { getEffectiveStats } from '../../shared/utils/goblinStats'
import { getExpBonusPercentFromSkills, hasUndeadSkill } from '../../shared/data/characterSkills'
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
  enrichedReplay: ExpeditionReplay
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

    // 戦闘ごとに生存メンバー数で経験値を分配
    const partyIds = replay.meta.party
    const perGoblinExp = new Map<number, number>()
    for (const goblin of goblins) {
      perGoblinExp.set(goblin.id, 0)
    }

    // 各メンバーのHP状態を追跡（戦闘不能判定用）
    const snapshotById = new Map<number, Goblin>(
      (replay.meta.partySnapshot ?? []).map(goblin => [goblin.id, goblin])
    )
    const currentHP: number[] = partyIds.map((id) => {
      const goblin = goblins.find(g => g.id === Number.parseInt(id, 10))
      if (!goblin) return 0
      const snapshot = snapshotById.get(goblin.id)
      if (snapshot?.currentHp === 0 || goblin.currentHp === 0) return 0
      return snapshot?.currentHp ?? getEffectiveStats(goblin).hp
    })

    for (const event of replay.events) {
      if (event.type !== 'battle' && event.type !== 'boss') continue

      // この戦闘時点での生存メンバーを特定
      const aliveIndices: number[] = []
      for (let i = 0; i < partyIds.length; i++) {
        if (currentHP[i] > 0) aliveIndices.push(i)
      }

      // 勝利した戦闘のみ、生存メンバー数で経験値を分配
      const aliveCount = aliveIndices.length
      if (event.combat.outcome === 'win' && aliveCount > 0 && event.xp > 0) {
        const xpPerMember = Math.floor(event.xp / aliveCount)
        for (const idx of aliveIndices) {
          const goblinId = Number.parseInt(partyIds[idx], 10)
          perGoblinExp.set(goblinId, (perGoblinExp.get(goblinId) ?? 0) + xpPerMember)
        }
      }

      // 戦闘後のHP更新
      event.combat.allyHPDelta.forEach((delta, index) => {
        if (index < currentHP.length) {
          currentHP[index] = Math.max(0, currentHP[index] + delta)
        }
      })
    }

    // レベルアップ後の最新ゴブリンを保持（因子獲得時に参照）
    const latestGoblins = new Map(goblins.map(g => [g.id, g]))

    for (const goblin of goblins) {
      // 獲得経験値スキルによるボーナス適用
      const expBonusPercent = getExpBonusPercentFromSkills(goblin.skills)
      const baseExp = perGoblinExp.get(goblin.id) ?? 0
      const expToGain = expBonusPercent > 0
        ? Math.floor(baseExp * (1 + expBonusPercent / 100))
        : baseExp
      if (expToGain <= 0) continue

      const entity = new GoblinEntity(goblin)
      const levelUpResult = entity.gainExperience(expToGain)
      levelUps.set(goblin.id, levelUpResult)

      const updatedGoblin = entity.toSnapshot()
      await this.goblinRepository.saveGoblin(updatedGoblin)
      updatedGoblinIds.push(goblin.id)
      latestGoblins.set(goblin.id, updatedGoblin)
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

            const latest = latestGoblins.get(goblin.id)!
            const acquired = FactorService.rollFactorDrops(
              latest,
              allFactorDrops,
              replay.meta.seed
            )

            if (acquired.length > 0) {
              const withFactors = FactorService.addFactors(latest, acquired)
              // 因子と実効ステータスだけをUPDATEし、レベルアップ等の他データを上書きしない
              await this.goblinRepository.updateGoblinFactors(goblin.id, withFactors.factors!, withFactors.effectiveStats!)
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

    for (let index = 0; index < partyIds.length; index++) {
      const goblinId = Number.parseInt(partyIds[index], 10)
      if (Number.isNaN(goblinId)) continue

      // アンデッドスキル: HP0でも遠征終了時にHP全回復
      const hp = currentHP[index] ?? 0
      if (hp <= 0) {
        const goblin = goblins.find(g => g.id === goblinId)
        if (goblin && hasUndeadSkill(goblin.skills)) {
          await this.goblinRepository.updateGoblinCurrentHp(goblinId, null)
        } else {
          await this.goblinRepository.updateGoblinCurrentHp(goblinId, hp)
        }
      } else {
        await this.goblinRepository.updateGoblinCurrentHp(goblinId, hp)
      }
      if (!updatedGoblinIds.includes(goblinId)) {
        updatedGoblinIds.push(goblinId)
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

    // replayのsummaryにレベルアップ情報を書き込み
    const memberLevelUps: MemberLevelUp[] = []
    for (const [goblinId, levelUp] of levelUps) {
      if (levelUp.didLevelUp) {
        memberLevelUps.push({
          goblinId,
          oldLevel: levelUp.oldLevel,
          newLevel: levelUp.newLevel,
        })
      }
    }

    const enrichedReplay: ExpeditionReplay = {
      ...replay,
      summary: {
        ...replay.summary,
        memberLevelUps: memberLevelUps.length > 0 ? memberLevelUps : undefined,
      },
    }

    return {
      levelUps,
      updatedGoblinIds,
      factorAcquisitions,
      newDungeonCaptured,
      goldGained,
      treasureDrops: treasureDrops.length > 0 ? treasureDrops : undefined,
      enrichedReplay,
    }
  }
}
