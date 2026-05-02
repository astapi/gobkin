import type { Goblin, GoblinStats } from '../../shared/types/Goblin'
import type { FactorEffect } from '../../shared/types/Factor'
import { factorDatabase } from '../../shared/data/factors'

/**
 * 親ゴブリンの選出結果
 */
export interface ParentSelection {
  parent1: Goblin | null
  parent2: Goblin | null
}

/**
 * 因子引き継ぎの結果
 * ※ステータス補正はModStatCalculatorで計算時に適用されるため、ここには含めない
 */
export interface InheritanceResult {
  inheritedFactors: string[]   // 引き継いだ因子ID
  isVariant: boolean           // 亜種かどうか
  variantRaceId?: string       // 亜種の場合の種族ID
  variantRace?: string         // 亜種の場合の種族名
  variantAvatar?: string       // 亜種の場合のアバター
  variantFactorId?: string     // 亜種の元となった因子ID
}

/**
 * 因子引き継ぎに関するサービス
 */
export class FactorInheritanceService {
  /**
   * 拠点ゴブリンからランダムに2体の親を選出
   * @param baseGoblins 拠点所属ゴブリン
   * @param rng 乱数生成関数
   */
  static selectParents(baseGoblins: Goblin[], rng: () => number): ParentSelection {
    if (baseGoblins.length === 0) {
      return { parent1: null, parent2: null }
    }

    if (baseGoblins.length === 1) {
      return { parent1: baseGoblins[0], parent2: null }
    }

    // シャッフルして最初の2体を選出
    const shuffled = [...baseGoblins]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    return {
      parent1: shuffled[0],
      parent2: shuffled[1],
    }
  }

  /**
   * 親の因子から引き継ぎ判定を行う
   * @param parents 選出された親ゴブリン
   * @param rng 乱数生成関数
   */
  static evaluateInheritance(
    parents: ParentSelection,
    rng: () => number
  ): InheritanceResult {
    const emptyResult: InheritanceResult = {
      inheritedFactors: [],
      isVariant: false,
    }

    console.log('[FactorInheritance] evaluateInheritance called', {
      parent1: parents.parent1?.name,
      parent1Factors: parents.parent1?.factors,
      parent2: parents.parent2?.name,
      parent2Factors: parents.parent2?.factors,
    })

    // 親がいない場合は引き継ぎなし
    if (!parents.parent1 && !parents.parent2) {
      console.log('[FactorInheritance] No parents, returning empty')
      return emptyResult
    }

    // 親の因子を収集（重複排除）
    const parentFactorIds = new Set<string>()
    if (parents.parent1?.factors) {
      parents.parent1.factors.forEach(f => parentFactorIds.add(f))
    }
    if (parents.parent2?.factors) {
      parents.parent2.factors.forEach(f => parentFactorIds.add(f))
    }

    console.log('[FactorInheritance] Collected parent factors:', [...parentFactorIds])

    // 親が因子を持っていない場合
    if (parentFactorIds.size === 0) {
      console.log('[FactorInheritance] Parents have no factors, returning empty')
      return emptyResult
    }

    // 各因子について引き継ぎ判定
    const inheritedFactors: string[] = []
    for (const factorId of parentFactorIds) {
      const factor = factorDatabase[factorId]
      if (!factor) continue

      // 引き継ぎ確率で判定
      if (rng() < factor.inheritProbability) {
        inheritedFactors.push(factorId)
      }
    }

    // 引き継いだ因子がない場合
    if (inheritedFactors.length === 0) {
      return emptyResult
    }

    // 亜種判定（最初に引き継いだ因子のvariantConfigを使用）
    let isVariant = false
    let variantRaceId: string | undefined
    let variantRace: string | undefined
    let variantAvatar: string | undefined
    let variantFactorId: string | undefined

    const variantCandidateFactorIds = [...inheritedFactors]
    for (let i = variantCandidateFactorIds.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[variantCandidateFactorIds[i], variantCandidateFactorIds[j]] = [
        variantCandidateFactorIds[j],
        variantCandidateFactorIds[i],
      ]
    }

    for (const factorId of variantCandidateFactorIds) {
      const factor = factorDatabase[factorId]
      if (factor?.variantConfig) {
        if (rng() < factor.variantConfig.probability) {
          isVariant = true
          variantRaceId = factor.variantConfig.raceId
          variantRace = factor.variantConfig.raceName
          variantAvatar = factor.variantConfig.avatar
          variantFactorId = factorId
          break  // 最初に成功した亜種のみ適用
        }
      }
    }

    return {
      inheritedFactors,
      isVariant,
      variantRaceId,
      variantRace,
      variantAvatar,
      variantFactorId,
    }
  }

  /**
   * 因子による合計ステータスボーナスを計算
   * @param factorIds 因子IDの配列
   */
  static calculateFactorBonuses(factorIds: string[]): GoblinStats {
    const bonuses: GoblinStats = { hp: 0, atk: 0, magicAtk: 0, def: 0, magicDef: 0, attackCount: 0, accuracy: 0, evasion: 0, magicHeal: 0, criticalRate: 0 }

    // 各因子のeffectsを合算
    for (const factorId of factorIds) {
      const factor = factorDatabase[factorId]
      if (!factor) continue

      this.applyEffects(bonuses, factor.effects)
    }

    return bonuses
  }

  /**
   * 効果をステータスボーナスに適用
   */
  private static applyEffects(bonuses: GoblinStats, effects: FactorEffect[]): void {
    for (const effect of effects) {
      if (effect.type === 'stat_bonus') {
        bonuses[effect.target] += effect.value
      }
    }
  }
}
