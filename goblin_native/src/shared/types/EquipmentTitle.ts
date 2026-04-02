/**
 * 装備の称号ID
 */
export type EquipmentTitleId =
  | 'worst'      // 最低な
  | 'stinky'     // 臭い
  | 'none'       // 称号なし
  | 'masterwork' // 名工の
  | 'magical'    // 魔性の
  | 'imbued'     // 宿った
  | 'legendary'  // 伝説の
  | 'terrifying' // 恐ろしい
  | 'broken'     // 壊れた

/**
 * 称号の定義
 */
export interface EquipmentTitleDef {
  id: EquipmentTitleId
  name: string           // 表示名（接頭辞）
  plusMultiplier: number  // プラス補正の倍率
  minusMultiplier: number // マイナス補正の倍率
  priceMultiplier: number // 価格倍率
  baseWeight: number      // 基本重み（倍率1倍時）
  power: number           // 倍率に対するスケーリング指数
}

/**
 * 装備に付与された称号インスタンス
 */
export interface EquipmentTitleInstance {
  titleId: EquipmentTitleId
  titleName: string // 表示名（例: "伝説の"）
}
