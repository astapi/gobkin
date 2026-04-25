import type { GoblinRaceId } from './Race'

/**
 * 因子の基本定義
 */
export interface Factor {
  id: string           // 例: "slime", "golem", "dragon"
  name: string         // 表示名: "スライムの因子", "ゴーレムの因子"
  description: string  // 説明文
  effects: FactorEffect[]  // ステータス効果
  inheritProbability: number  // 引き継ぎ確率 (0.0 ~ 1.0) 例: 0.3 = 30%
  variantConfig?: FactorVariantConfig  // 亜種設定（オプション）
}

/**
 * 因子の効果
 */
export interface FactorEffect {
  type: 'stat_bonus' | 'resistance' | 'skill_unlock'
  target: 'hp' | 'atk' | 'magicAtk' | 'def' | 'magicDef' | 'attackCount' | 'accuracy' | 'evasion' | 'magicHeal'
  value: number  // フラット値（+100など）
}

/**
 * 亜種ゴブリン設定
 */
export interface FactorVariantConfig {
  probability: number  // 亜種発生確率 (0.0 ~ 1.0)
  raceId: GoblinRaceId
  raceName: string     // 亜種の種族名 例: "スライムゴブリン"
  avatar: string       // 亜種専用アバター画像パス
}

/**
 * ダンジョンボスからの因子ドロップ設定
 */
export interface FactorDropConfig {
  factorId: string     // 獲得できる因子のID
  probability: number  // 獲得確率 (0.0 ~ 1.0)  例: 0.03 = 3%
}
