/**
 * 因子の基本定義
 */
export interface Factor {
  id: string           // 例: "slime", "golem", "dragon"
  name: string         // 表示名: "スライムの因子", "ゴーレムの因子"
  description: string  // 説明文
  effects?: FactorEffect[]  // 将来的なステータス効果用（拡張）
}

/**
 * 因子の効果（将来拡張用）
 */
export interface FactorEffect {
  type: 'stat_bonus' | 'resistance' | 'skill_unlock'
  target?: 'hp' | 'atk' | 'def' | 'sp' | 'spd'
  value?: number
}

/**
 * ダンジョンボスからの因子ドロップ設定
 */
export interface FactorDropConfig {
  factorId: string     // 獲得できる因子のID
  probability: number  // 獲得確率 (0.0 ~ 1.0)  例: 0.03 = 3%
}
