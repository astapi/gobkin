/**
 * Modの種別
 * - prefix: ステータス増加系（HP%, ATK%, DEF%, SPD%, SP%, フラット増加）
 * - suffix: 軽減・特殊効果系（被ダメージ軽減など）
 */
export type ModType = 'prefix' | 'suffix'

/**
 * Modが影響するステータス
 */
export type ModStat =
  | 'hp_percent'
  | 'hp_flat'
  | 'atk_percent'
  | 'atk_flat'
  | 'def_percent'
  | 'def_flat'
  | 'spd_percent'
  | 'sp_percent'
  | 'sp_flat'
  | 'damage_reduction'

/**
 * Modテンプレート定義（JSONから読み込み）
 */
export interface ModTemplate {
  id: string
  name: string
  group: string
  type: ModType
  stat: ModStat
  tier: number
  valueRange: [number, number]
  weight: number
  requiredIndividual: number
}

/**
 * ゴブリンに付与されたMod実体
 */
export interface ModInstance {
  templateId: string
  value: number
}

/**
 * Mod生成設定
 */
export interface ModGenerationConfig {
  minMods: number
  maxMods: number
}

export const DEFAULT_MOD_CONFIG: ModGenerationConfig = {
  minMods: 0,
  maxMods: 4,
}

/**
 * ModプールのJSONデータ構造
 */
export interface ModPoolData {
  version: string
  config: {
    minMods: number
    maxMods: number
    damageReductionCap: number
  }
  templates: ModTemplate[]
}
