import type { EquipmentTitleId } from './EquipmentTitle'
import type { CharacterSkill } from './CharacterSkill'

/**
 * 装備の種別
 */
export type EquipmentCategory = 'weapon' | 'armor' | 'shield' | 'gauntlet' | 'wand' | 'rod' | 'accessory'

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
  | 'magic_atk_flat'
  | 'magic_def_flat'
  | 'attackCount_flat'
  | 'accuracy_flat'
  | 'evasion_flat'
  | 'magicHeal_flat'
  | 'hp_percent'
  | 'atk_percent'
  | 'def_percent'
  | 'critical_rate_percent'
  | 'damage_reduction'

/**
 * ステータスボーナス1件（ModStatCalculator連携用）
 */
export interface EquipmentStatBonus {
  stat: EquipmentStat
  value: number
  sourceCategory?: EquipmentCategory
  sourceSubCategory?: WeaponSubCategory
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
  grantedSkillIds?: string[]
  grantedSkills?: CharacterSkill[]
  range?: WeaponRange
  price: number
  unlockRank?: number  // 店売り解放に必要な拠点ランク（未設定=店売りなし）
  rank?: number  // アイテムランク（敵レベル→ランク抽選時の対象。未設定=敵ドロップ対象外）
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
