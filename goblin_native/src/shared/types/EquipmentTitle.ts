/**
 * 装備の称号ID
 *
 * worst / stinky は廃止済みの称号。新規ドロップでは付与されないが、
 * 既存セーブデータの表示・整合のために ID と表示名だけ残している。
 */
export type EquipmentTitleId =
  | 'worst'      // 最低な（廃止済み・既存データ互換用）
  | 'stinky'     // 臭い（廃止済み・既存データ互換用）
  | 'none'       // 称号なし
  | 'masterwork' // 名工の
  | 'magical'    // 魔性の
  | 'imbued'     // 宿った
  | 'legendary'  // 伝説の
  | 'terrifying' // 恐ろしい
  | 'broken'     // 壊れた

/**
 * 称号の定義
 *
 * 抽選フロー:
 *   1. 付与判定（運乱数 > 100 - effectiveTitleMultiplier × 30）
 *   2. 付与する場合のみ、Tier 別の判定回数だけ rollWeight に基づき抽選し、
 *      最も rank の高い称号を採用する
 *
 * - rollWeight は「称号付き」の中での重み（none は 0、抽選対象外）
 * - rank は称号の優劣順（大きいほど高位／良い称号）
 */
export interface EquipmentTitleDef {
  id: EquipmentTitleId
  name: string           // 表示名（接頭辞）
  plusMultiplier: number  // プラス補正の倍率
  minusMultiplier: number // マイナス補正の倍率
  priceMultiplier: number // 価格倍率
  rollWeight: number      // 称号抽選時の重み（none は 0 で抽選対象外）
  rank: number            // 称号の優劣順（大きいほど高位）
}

/**
 * 装備に付与された称号インスタンス
 */
export interface EquipmentTitleInstance {
  titleId: EquipmentTitleId
  titleName: string // 表示名（例: "伝説の"）
}
