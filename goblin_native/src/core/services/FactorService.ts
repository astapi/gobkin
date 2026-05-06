import type { Goblin } from '../../shared/types/Goblin'
import type { FactorDropConfig } from '../../shared/types/Factor'
import { GoblinStatCalculator } from './GoblinStatCalculator'

/**
 * シード付き乱数生成器を作成
 */
function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return (state >>> 0) / 0x100000000
  }
}

/**
 * 因子獲得に関するサービス
 */
export class FactorService {
  /**
   * 因子獲得判定
   * @param goblin 対象ゴブリン
   * @param factorDrops ドロップ設定
   * @param seed シード値（再現性のため）
   * @returns 獲得した因子IDの配列
   */
  static rollFactorDrops(
    goblin: Goblin,
    factorDrops: FactorDropConfig[],
    seed: number
  ): string[] {
    const acquired: string[] = []
    const rng = createSeededRandom(seed + goblin.id)

    for (const drop of factorDrops) {
      // 既に持っている因子はスキップ
      if (goblin.factors?.includes(drop.factorId)) {
        continue
      }

      // 確率判定
      if (rng() < drop.probability) {
        acquired.push(drop.factorId)
      }
    }

    return acquired
  }

  /**
   * ゴブリンに因子を追加し、実効ステータスを再計算
   */
  static addFactors(goblin: Goblin, newFactors: string[]): Goblin {
    if (newFactors.length === 0) {
      return goblin
    }

    const existingFactors = goblin.factors ?? []
    // Setを使用して既存因子と新規因子を含むすべての重複を排除
    const uniqueFactors = [...new Set([...existingFactors, ...newFactors])]

    // 変更がない場合は元のゴブリンを返す
    if (uniqueFactors.length === existingFactors.length) {
      return goblin
    }

    const updatedGoblin: Goblin = {
      ...goblin,
      factors: uniqueFactors,
    }

    // 実効ステータスを再計算
    updatedGoblin.effectiveStats = GoblinStatCalculator.calculate(updatedGoblin)

    return updatedGoblin
  }

  /**
   * ゴブリンが特定の因子を持っているか確認
   */
  static hasFactor(goblin: Goblin, factorId: string): boolean {
    return goblin.factors?.includes(factorId) ?? false
  }
}
