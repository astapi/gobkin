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
 * 32bitアバランシェミキサー（splitmix32系のfinalizer）
 * 入力の1bitの変化が出力全体に波及するため、連番の入力からでも
 * 無相関に近いハッシュ値を得られる。
 */
function mix32(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return (x ^ (x >>> 16)) >>> 0
}

/**
 * シード値とゴブリンIDからLCGの初期状態を導出する。
 * `seed + goblin.id` のような単純な合算では、初期状態が近い値同士が
 * LCG1ステップ後もほぼ同じ乱数を返してしまう（連番IDでの相関）ため、
 * ミキサーを通してから合成することで両者の1bit差分を全体に拡散させる。
 */
function deriveRandomSeed(seed: number, goblinId: number): number {
  return mix32(mix32(seed) ^ Math.imul(goblinId, 0x9e3779b9))
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
    seed: number,
    probabilityMultiplier = 1
  ): string[] {
    const acquired: string[] = []
    const rng = createSeededRandom(deriveRandomSeed(seed, goblin.id))
    const clampedMultiplier = Math.max(0, probabilityMultiplier)

    for (const drop of factorDrops) {
      // 既に持っている因子はスキップ
      if (goblin.factors?.includes(drop.factorId)) {
        continue
      }

      // 確率判定
      if (rng() < Math.min(1, drop.probability * clampedMultiplier)) {
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
