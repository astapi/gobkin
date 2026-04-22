/**
 * 敵レベルに応じて宝箱ドロップのアイテムランクを抽選する。
 *
 * 仕組み:
 *  - 敵レベル L に対し、閾値テーブルから `minLevel <= L` を満たす最上段のステップを選ぶ
 *  - そのステップのランクを `probability` で抽選。成功したらランク確定
 *  - 失敗したら1段下のステップへ落ち、同じ手順を繰り返す
 *  - 最下段はランク0 / 確率100% のため、必ずどこかで確定する
 *
 * テーブルは「下から上に積み上げた」順序で並ぶ（昇順の minLevel）。
 * 同一ランクが複数段ある場合は、そのランクの出現範囲が広いことを意味する。
 */

export interface DropRankStep {
  minLevel: number
  rank: number
  probability: number
}

/**
 * 敵レベル→ランク抽選テーブル。
 * 下から上に並び、配列末尾ほど高いランク／高い敵レベルを示す。
 */
export const DROP_RANK_TABLE: readonly DropRankStep[] = [
  { minLevel: 1, rank: 0, probability: 1.0 },
  { minLevel: 4, rank: 1, probability: 0.7 },
  { minLevel: 12, rank: 1, probability: 0.7 },
  { minLevel: 20, rank: 2, probability: 0.7 },
  { minLevel: 30, rank: 2, probability: 0.7 },
  { minLevel: 30, rank: 3, probability: 0.7 },
  { minLevel: 40, rank: 3, probability: 0.7 },
  { minLevel: 58, rank: 4, probability: 0.7 },
  { minLevel: 70, rank: 4, probability: 0.7 },
  { minLevel: 99, rank: 5, probability: 0.7 },
  { minLevel: 120, rank: 5, probability: 0.7 },
  { minLevel: 150, rank: 6, probability: 0.7 },
  { minLevel: 200, rank: 6, probability: 0.7 },
  { minLevel: 300, rank: 7, probability: 0.7 },
  { minLevel: 500, rank: 7, probability: 0.7 },
]

/**
 * 敵レベルに対応するスタート位置（DROP_RANK_TABLE のインデックス）を返す。
 * `minLevel <= enemyLevel` を満たす最後のステップを選ぶ。
 */
export function findStartStepIndex(enemyLevel: number): number {
  let index = 0
  for (let i = 0; i < DROP_RANK_TABLE.length; i++) {
    if (DROP_RANK_TABLE[i].minLevel <= enemyLevel) {
      index = i
    } else {
      break
    }
  }
  return index
}

/**
 * 敵レベルに応じてドロップアイテムのランクを抽選する。
 * 確率に外れたら1段下のステップに下がり、決まるまで繰り返す。
 */
export function rollDropRank(enemyLevel: number, rng: () => number): number {
  let index = findStartStepIndex(enemyLevel)
  while (index > 0) {
    const step = DROP_RANK_TABLE[index]
    if (rng() < step.probability) {
      return step.rank
    }
    index--
  }
  return DROP_RANK_TABLE[0].rank
}
