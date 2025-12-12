import type { ExpeditionReplay } from '../../shared/types'
import { GoblinEntity } from '../domain'
import type { IGoblinRepository, IPartyRepository } from '../repositories'
import type { LevelUpResult } from '../services/ExperienceSystem'

export interface ExpeditionCompletionResult {
  levelUps: Map<number, LevelUpResult>
  updatedGoblinIds: number[]
}

/**
 * 遠征完了時の処理を行うUseCase
 * - 経験値の付与とレベルアップ
 * - パーティステータスの更新
 */
export class CompleteExpeditionUseCase {
  private readonly goblinRepository: IGoblinRepository
  private readonly partyRepository: IPartyRepository

  constructor(
    goblinRepository: IGoblinRepository,
    partyRepository: IPartyRepository
  ) {
    this.goblinRepository = goblinRepository
    this.partyRepository = partyRepository
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

    // パーティステータスを待機中に戻す
    this.partyRepository.updatePartyStatus(partyId, 'idle')

    return {
      levelUps,
      updatedGoblinIds
    }
  }
}
