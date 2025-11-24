import type { Goblin } from '../../shared/types'
import { GoblinBirthService, type BirthEvaluationResult } from './GoblinBirthService'

export interface BaseState {
  goblins: Goblin[]
  capacity: number
  rank: number
  now: number
  lastSpawnTime: number
  slimeCaveCleared: boolean
  firstBonusGranted: boolean
  nextGoblinId?: number
}

export type { BirthEvaluationResult }

/**
 * 拠点管理の統合サービス
 * 将来的には拠点のアップグレード、施設管理など他の機能も追加予定
 */
export class BaseManagementService {
  private readonly birthService: GoblinBirthService

  constructor(random: () => number = Math.random) {
    this.birthService = new GoblinBirthService(random)
  }

  /**
   * ゴブリン誕生の評価（GoblinBirthServiceに委譲）
   */
  public evaluateBirths(state: BaseState): BirthEvaluationResult {
    return this.birthService.evaluateBirths({
      currentGoblins: state.goblins,
      capacity: state.capacity,
      rank: state.rank,
      now: state.now,
      lastSpawnTime: state.lastSpawnTime,
      slimeCaveCleared: state.slimeCaveCleared,
      firstBonusGranted: state.firstBonusGranted,
      nextGoblinId: state.nextGoblinId,
    })
  }

  /**
   * ゴブリンを拠点から追放
   */
  public expelGoblin(goblins: Goblin[], goblinId: number): Goblin[] {
    const exists = goblins.some(goblin => goblin.id === goblinId)
    if (!exists) {
      throw new Error(`ID ${goblinId} のゴブリンは存在しません`)
    }
    return goblins.filter(goblin => goblin.id !== goblinId)
  }

  // 将来的に以下のようなメソッドを追加予定:
  // - upgradeBase(baseState: BaseState): BaseUpgradeResult
  // - buildFacility(baseState: BaseState, facilityType: string): BuildResult
  // - repairFacility(baseState: BaseState, facilityId: string): RepairResult
}
