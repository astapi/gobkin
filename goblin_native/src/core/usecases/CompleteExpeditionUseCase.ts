import type { CharacterSkill, ExpeditionReplay, Goblin, MemberLevelUp, TimelineEvent, TreasureDrop } from '../../shared/types'
import { getEnemyDatabase } from '../../shared/data/enemy'
import { getEffectiveStats } from '../../shared/utils/goblinStats'
import {
  getExpBonusPercentFromSkills,
  getExpMultiplierFromSkills,
  getFactorDropBonusPercentFromSkills,
  getFactorDropMultiplierFromSkills,
  hasUndeadSkill,
} from '../../shared/data/characterSkills'
import { GoblinEntity } from '../domain'
import type { IGoblinRepository, IPartyRepository, IBaseStateRepository } from '../repositories'
import type { IEquipmentRepository } from '../repositories/IEquipmentRepository'
import type { ITransactionRunner } from '../repositories/ITransactionRunner'
import type { IExpeditionCompletionGateway } from '../repositories/IExpeditionCompletionGateway'
import type { LevelUpResult } from '../services/ExperienceSystem'
import type { FactorDropConfig } from '../../shared/types/Factor'
import { FactorService } from '../services/FactorService'
import { EquipmentService } from '../services/EquipmentService'
import { captureDungeon } from '../services/BaseRankSystem'
import { GOLDEN_ACORN_CLEAR_ENCOUNTER_ID, GOLDEN_ACORN_CLEAR_FACTOR_DROPS } from '../services/ExpeditionEngine'
import { isDungeonCompleted } from '../../shared/utils/expeditionClear'
import { getDungeonTierFactorDropMultiplier } from '../../shared/types/DungeonTier'
import { addAutoExpeditionResult } from '../../shared/utils/autoExpeditionSummary'

export interface ExpeditionCompletionResult {
  /** 既に完了処理済み（冪等性ゲートで弾かれた）ため報酬処理をスキップしたか */
  alreadyProcessed: boolean
  levelUps: Map<number, LevelUpResult>
  updatedGoblinIds: number[]
  factorAcquisitions: Map<number, string[]>
  newDungeonCaptured?: string
  goldGained: number
  treasureDrops?: TreasureDrop[]
  enrichedReplay: ExpeditionReplay
}

// transactionRunner 未注入時（単体テスト等）のパススルー実装
const passthroughTransactionRunner: ITransactionRunner = {
  runInTransaction: (fn) => fn(),
}

export class CompleteExpeditionUseCase {
  private readonly goblinRepository: IGoblinRepository
  private readonly partyRepository: IPartyRepository
  private readonly baseStateRepository: IBaseStateRepository
  private readonly equipmentRepository?: IEquipmentRepository
  private readonly expeditionGateway?: IExpeditionCompletionGateway
  private readonly transactionRunner: ITransactionRunner

  constructor(
    goblinRepository: IGoblinRepository,
    partyRepository: IPartyRepository,
    baseStateRepository: IBaseStateRepository,
    equipmentRepository?: IEquipmentRepository,
    expeditionGateway?: IExpeditionCompletionGateway,
    transactionRunner?: ITransactionRunner
  ) {
    this.goblinRepository = goblinRepository
    this.partyRepository = partyRepository
    this.baseStateRepository = baseStateRepository
    this.equipmentRepository = equipmentRepository
    this.expeditionGateway = expeditionGateway
    this.transactionRunner = transactionRunner ?? passthroughTransactionRunner
  }

  /**
   * 遠征完了処理を 1 トランザクションでアトミックに実行する。
   *
   * expeditionId と expeditionGateway が与えられた場合、トランザクションの先頭で
   * status='ongoing'→(completed/failed) の確定を行い、0 行更新（=処理済み）なら
   * 報酬処理をスキップして早期 return する（冪等性ゲート = exactly-once）。
   */
  public async execute(
    partyId: number,
    replay: ExpeditionReplay,
    options?: { isAbort?: boolean; expeditionId?: string }
  ): Promise<ExpeditionCompletionResult> {
    return this.transactionRunner.runInTransaction(() =>
      this.executeInTransaction(partyId, replay, options)
    )
  }

  private async executeInTransaction(
    partyId: number,
    replay: ExpeditionReplay,
    options?: { isAbort?: boolean; expeditionId?: string }
  ): Promise<ExpeditionCompletionResult> {
    const isAbort = options?.isAbort ?? false
    const expeditionId = options?.expeditionId

    // 冪等性ゲート: トランザクション先頭で status を確定。既に完了済みなら報酬処理を行わない。
    if (this.expeditionGateway && expeditionId) {
      const claimed = await this.expeditionGateway.complete(expeditionId, replay)
      if (!claimed) {
        return {
          alreadyProcessed: true,
          levelUps: new Map(),
          updatedGoblinIds: [],
          factorAcquisitions: new Map(),
          goldGained: 0,
          enrichedReplay: replay,
        }
      }
    }

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

    // 装備付与スキルを事前に収集（経験値ボーナス・アンデッド判定・因子ドロップ判定で共通利用）
    const equippedSkillsByGoblinId = new Map<number, CharacterSkill[]>()
    for (const goblin of goblins) {
      const equippedItems = this.equipmentRepository
        ? await this.equipmentRepository.getByGoblinId(goblin.id)
        : []
      equippedSkillsByGoblinId.set(goblin.id, EquipmentService.collectGrantedSkills(equippedItems))
    }
    const getMergedSkills = (goblin: Goblin): CharacterSkill[] => [
      ...goblin.skills,
      ...(equippedSkillsByGoblinId.get(goblin.id) ?? []),
    ]

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
    // 各メンバーの本来の最大HP（純ゴブリン群れボーナス等で膨らんだ戦闘中HPをクランプする上限）
    const maxHPByIndex: number[] = partyIds.map((id) => {
      const goblin = goblins.find(g => g.id === Number.parseInt(id, 10))
      if (!goblin) return 0
      const snapshot = snapshotById.get(goblin.id)
      return snapshot?.effectiveStats?.hp ?? getEffectiveStats(goblin).hp
    })
    const currentHP: number[] = partyIds.map((id, index) => {
      const goblin = goblins.find(g => g.id === Number.parseInt(id, 10))
      if (!goblin) return 0
      const snapshot = snapshotById.get(goblin.id)
      if (snapshot?.currentHp === 0 || goblin.currentHp === 0) return 0
      const startHP = snapshot?.currentHp ?? getEffectiveStats(goblin).hp
      const cap = maxHPByIndex[index]
      return cap > 0 ? Math.min(cap, startHP) : startHP
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

      // 戦闘後のHP更新（本来の最大HPで上限クランプ）
      event.combat.allyHPDelta.forEach((delta, index) => {
        if (index < currentHP.length) {
          const cap = maxHPByIndex[index] > 0 ? maxHPByIndex[index] : Infinity
          currentHP[index] = Math.max(0, Math.min(cap, currentHP[index] + delta))
        }
      })
    }

    // レベルアップ後の最新ゴブリンを保持（因子獲得時に参照）
    const latestGoblins = new Map(goblins.map(g => [g.id, g]))

    for (const goblin of goblins) {
      // 獲得経験値スキルによるボーナス適用（装備付与スキルを含む）
      const mergedSkills = getMergedSkills(goblin)
      const expBonusPercent = getExpBonusPercentFromSkills(mergedSkills)
      const expMultiplier = getExpMultiplierFromSkills(mergedSkills)
      const baseExp = perGoblinExp.get(goblin.id) ?? 0
      const totalMultiplier = (1 + Math.max(0, expBonusPercent) / 100) * expMultiplier
      const expToGain = Math.max(0, Math.floor(baseExp * totalMultiplier))
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
    const dungeonCompleted = isDungeonCompleted(replay)

    // 初回クリア判定（チュートリアル用の確定因子獲得などに使用）
    let isFirstClearSuccess = false
    if (!isAbort && dungeonCompleted) {
      const baseStateBefore = await this.baseStateRepository.getBaseState()
      isFirstClearSuccess =
        baseStateBefore !== null &&
        !baseStateBefore.capturedDungeons.includes(replay.meta.areaId)
    }

    if (!isAbort) {
      const allFactorDrops: FactorDropConfig[] = []

      const ratatoskrEvent = replay.events.find(
        (e): e is Extract<TimelineEvent, { type: 'battle' }> =>
          e.type === 'battle' &&
          e.enemy.id === GOLDEN_ACORN_CLEAR_ENCOUNTER_ID &&
          e.combat.outcome === 'win'
      )
      if (ratatoskrEvent) {
        allFactorDrops.push(...GOLDEN_ACORN_CLEAR_FACTOR_DROPS)
      }

      const enemyDatabase = getEnemyDatabase(replay.meta.areaId)

      if (bossEvent && bossEvent.combat.outcome === 'win' && enemyDatabase) {
        const bossPattern = enemyDatabase.patterns.find(p => p.isBoss)
        const bossEnemyIds = bossPattern?.enemies.flat() ?? [bossEvent.enemy.id]
        const enemiesWithFactorDrops = enemyDatabase.enemies.filter(
          e => bossEnemyIds.includes(e.id) && e.factorDrops && e.factorDrops.length > 0
        )

        if (enemiesWithFactorDrops.length > 0) {
          allFactorDrops.push(...enemiesWithFactorDrops
            .flatMap(e => e.factorDrops!)
            .map(drop => {
              // チュートリアル: スライム洞窟初回クリア時はスライム因子を確定獲得
              if (
                isFirstClearSuccess &&
                replay.meta.areaId === 'slime_cave' &&
                drop.factorId === 'slime'
              ) {
                return { ...drop, probability: 1 }
              }
              return drop
            }))
        }
      } else if (bossEvent && bossEvent.combat.outcome === 'win' && !enemyDatabase) {
        console.warn(`Enemy data not found for area: ${replay.meta.areaId}`)
      }

      if (allFactorDrops.length > 0) {
        const tier = replay.meta.tier ?? 0
        const tierAdjustedFactorDrops = allFactorDrops.map(drop => ({
          ...drop,
          probability: drop.probability * getDungeonTierFactorDropMultiplier(tier, drop.minDungeonTier ?? 0),
        }))

        for (const goblin of goblins) {
          if (replay.summary.casualties.includes(goblin.id.toString())) {
            continue
          }

          const latest = latestGoblins.get(goblin.id)!
          const factorDropSkills = [
            ...latest.skills,
            ...(equippedSkillsByGoblinId.get(goblin.id) ?? []),
          ]
          const factorDropBonusPercent = getFactorDropBonusPercentFromSkills(factorDropSkills)
          const factorDropMultiplier = getFactorDropMultiplierFromSkills(factorDropSkills)
          const expeditionFactorDropMultiplier = replay.meta.expeditionBoost?.factorDropMultiplier ?? 1
          const probabilityMultiplier =
            (1 + Math.max(0, factorDropBonusPercent) / 100) *
            factorDropMultiplier *
            Math.max(0, expeditionFactorDropMultiplier)
          const acquired = FactorService.rollFactorDrops(
            latest,
            tierAdjustedFactorDrops,
            replay.meta.seed,
            probabilityMultiplier
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
    }

    for (let index = 0; index < partyIds.length; index++) {
      const goblinId = Number.parseInt(partyIds[index], 10)
      if (Number.isNaN(goblinId)) continue

      // アンデッドスキル: HP0でも遠征終了時にHP全回復
      const hp = currentHP[index] ?? 0
      if (hp <= 0) {
        const goblin = goblins.find(g => g.id === goblinId)
        if (goblin && hasUndeadSkill(getMergedSkills(goblin))) {
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
    if (!isAbort && treasureDrops.length > 0 && this.equipmentRepository) {
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
    const goldGained = isAbort ? 0 : (replay.summary.goldGained || 0)

    if (!isAbort) {
      const currentBaseState = await this.baseStateRepository.getBaseState()
      if (currentBaseState) {
        let updatedBaseState = {
          ...currentBaseState,
          gold: currentBaseState.gold + goldGained,
        }

        if (dungeonCompleted) {
          const wasCaptured = currentBaseState.capturedDungeons.includes(replay.meta.areaId)
          updatedBaseState = captureDungeon(replay.meta.areaId, updatedBaseState)

          if (!wasCaptured) {
            newDungeonCaptured = replay.meta.areaId
          }
        }

        await this.baseStateRepository.saveBaseState(updatedBaseState)
      }
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

    const factorAcquisitionList = Array.from(factorAcquisitions.entries()).map(
      ([goblinId, factorIds]) => ({ goblinId, factorIds })
    )

    const enrichedReplay: ExpeditionReplay = {
      ...replay,
      summary: {
        ...replay.summary,
        memberLevelUps: memberLevelUps.length > 0 ? memberLevelUps : undefined,
        factorAcquisitions: factorAcquisitionList.length > 0 ? factorAcquisitionList : undefined,
      },
    }

    const autoExpeditionSessionId = replay.meta.autoExpeditionSessionId
    if (!isAbort && autoExpeditionSessionId) {
      const latestParty = await this.partyRepository.getParty(partyId)
      if (latestParty) {
        await this.partyRepository.saveParty({
          ...latestParty,
          autoExpeditionSummary: addAutoExpeditionResult(
            latestParty.autoExpeditionSummary,
            autoExpeditionSessionId,
            enrichedReplay,
          ),
        })
      }
    }

    // レベルアップ等を反映した enrichedReplay を、同一トランザクション内で永続化する。
    if (this.expeditionGateway && expeditionId) {
      await this.expeditionGateway.updateReplay(expeditionId, enrichedReplay)
    }

    return {
      alreadyProcessed: false,
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
