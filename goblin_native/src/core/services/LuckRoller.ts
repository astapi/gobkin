/**
 * パーティ平均運値からドロップ判定用の「運乱数」を抽選するためのテーブル。
 *
 * 仕様:
 *  - PTメンバーの基本能力値「運（luck）」の平均（小数切り捨て）から、
 *    閾値テーブル `LUCK_ROLL_TABLE` を切り捨てステップで参照する。
 *  - 閾値以上の運値であれば、そのステップの (min, max) で運乱数を抽選する。
 *  - max は常に 99.99 固定だが、将来の調整を見越してテーブルに含める。
 *
 * 例: 運値 27 → 運値25枠（min 22.00, max 99.99）。
 *     運値  5 → 最下段枠（min  0.00, max 99.99）。
 */
export interface LuckRollStep {
  minLuck: number
  min: number
  max: number
}

/**
 * 運値→運乱数範囲テーブル。
 * minLuck の降順で並べ、`luck >= minLuck` を満たす最初のステップを採用する。
 */
export const LUCK_ROLL_TABLE: readonly LuckRollStep[] = [
  { minLuck: 35, min: 37.0, max: 99.99 },
  { minLuck: 30, min: 30.0, max: 99.99 },
  { minLuck: 25, min: 22.0, max: 99.99 },
  { minLuck: 20, min: 15.0, max: 99.99 },
  { minLuck: 15, min: 7.0, max: 99.99 },
  { minLuck: 0, min: 0.0, max: 99.99 },
]

export interface LuckRollRange {
  min: number
  max: number
}

/**
 * 運値に対応する運乱数の (min, max) を返す。
 * `LUCK_ROLL_TABLE` の上から順に `luck >= minLuck` を判定する切り捨て方式。
 */
export function getLuckRollRange(luck: number): LuckRollRange {
  for (const step of LUCK_ROLL_TABLE) {
    if (luck >= step.minLuck) {
      return { min: step.min, max: step.max }
    }
  }
  const fallback = LUCK_ROLL_TABLE[LUCK_ROLL_TABLE.length - 1]
  return { min: fallback.min, max: fallback.max }
}

/**
 * 運値から運乱数を1回抽選する。返り値は `[min, max)` の連続値。
 */
export function rollLuckValue(luck: number, rng: () => number): number {
  const { min, max } = getLuckRollRange(luck)
  return min + rng() * (max - min)
}
