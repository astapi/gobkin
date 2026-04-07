import type { EquipmentTitleId } from './EquipmentTitle'
import type { CharacterSkill } from './CharacterSkill'

/**
 * 装備の種別
 */
export type EquipmentCategory = 'weapon' | 'armor' | 'accessory'

/**
 * 武器のサブカテゴリ
 */
export type WeaponSubCategory = 'sword' | 'axe' | 'spear' | 'bow' | 'staff' | 'claw'

/**
 * 武器の射程
 */
export type WeaponRange = 'melee' | 'ranged'

/**
 * 装備のステータスボーナス種別
 */
export type EquipmentStat =
  | 'hp_flat'
  | 'atk_flat'
  | 'def_flat'
  | 'sp_flat'
  | 'spd_flat'
  | 'attackCount_flat'
  | 'accuracy_flat'
  | 'evasion_flat'
  | 'hp_percent'
  | 'atk_percent'
  | 'def_percent'
  | 'sp_percent'
  | 'spd_percent'
  | 'attackCount_percent'
  | 'accuracy_percent'
  | 'evasion_percent'
  | 'critical_rate_percent'
  | 'damage_reduction'

/**
 * ステータスボーナス1件（ModStatCalculator連携用）
 */
export interface EquipmentStatBonus {
  stat: EquipmentStat
  value: number
  sourceCategory?: EquipmentCategory
}

/**
 * 装備の特殊効果
 * - def_to_hp: 最終防御力のX%をHPに加算（剣の付加効果）
 * - critical_damage_bonus: 必殺威力の増減%（弓の付加効果）
 * - accuracy_boost: 命中精度アップ（弓の付加効果）
 */
export type EquipmentEffectType = 'def_to_hp' | 'critical_damage_bonus' | 'accuracy_boost'

export interface EquipmentEffect {
  type: EquipmentEffectType
  value: number // def_to_hp: %, critical_damage_bonus: %, accuracy_boost: フラット値
  sourceCategory?: EquipmentCategory
}

/**
 * 武器固有ステータス（戦闘システム用）
 */
export interface WeaponStats {
  accuracy: number             // 命中精度
  attackCountModifier: number  // 攻撃回数補正（-0.2 = 重い武器で攻撃頻度低下）
  evasionModifier?: number     // 回避能力補正（-8 = 弓装備時の回避低下）
}

/**
 * 装備テンプレート定義（JSONから読み込み）
 */
export interface EquipmentTemplate {
  id: string
  name: string
  category: EquipmentCategory
  subCategory?: WeaponSubCategory
  statBonuses: EquipmentStatBonus[]
  grantedSkills?: CharacterSkill[]
  weaponStats?: WeaponStats
  effects?: EquipmentEffect[]
  range?: WeaponRange
  price: number
  unlockRank?: number  // 店売り解放に必要な拠点ランク（未設定=店売りなし）
  dropLevelMin?: number  // 宝箱ドロップするダンジョンレベル下限（未設定=ドロップなし）
  dropLevelMax?: number  // 宝箱ドロップするダンジョンレベル上限
  description?: string
}

/**
 * 装備インスタンス（所持/装着している装備1個）
 */
export interface EquipmentInstance {
  id: string
  templateId: string
  slotIndex: number       // 装着スロット (0-based)、-1 = 在庫
  goblinId: number | null // 装着先、null = 在庫
  titleId?: EquipmentTitleId   // 称号ID（未設定 = 称号なし）
  titleName?: string           // 称号の表示名（例: "伝説の"）
}
