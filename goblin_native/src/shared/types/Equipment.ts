import type { EquipmentTitleId } from './EquipmentTitle'
import type { CharacterSkill } from './CharacterSkill'

/**
 * 装備の種別
 */
export type EquipmentCategory = 'weapon' | 'armor' | 'robe' | 'shield' | 'large_shield' | 'gauntlet' | 'wand' | 'rod' | 'accessory'

/**
 * 武器のサブカテゴリ
 */
export type WeaponSubCategory = 'sword' | 'axe' | 'spear' | 'bow' | 'staff' | 'claw' | 'hidden'

/**
 * 武器の射程
 */
export type WeaponRange = 'melee' | 'ranged'

/**
 * 装備のステータスボーナス種別
 */
export type EquipmentStat =
  | 'power_flat'
  | 'wisdom_flat'
  | 'spirit_flat'
  | 'vitality_flat'
  | 'agility_flat'
  | 'luck_flat'
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
 * ステータスボーナス1件（GoblinStatCalculator連携用）
 */
export interface EquipmentStatBonus {
  stat: EquipmentStat
  value: number
  sourceCategory?: EquipmentCategory
  sourceSubCategory?: WeaponSubCategory
  sourceModSlot?: EquipmentModSlot
  sourceModTier?: EquipmentModTier
  sourceModId?: EquipmentModId
}

export type EquipmentModSlot = 'prefix' | 'suffix'

export type EquipmentModId =
  | 'power'
  | 'wisdom'
  | 'spirit'
  | 'vitality'
  | 'agility'
  | 'luck'

/** PoE形式。T1が最高、T10が最低。 */
export type EquipmentModTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/** 装備に確定したMOD。値とprefix/suffix種別は定義から解決する。 */
export interface EquipmentModRoll {
  id: EquipmentModId
  tier: EquipmentModTier
}

export interface EquipmentModDef {
  id: EquipmentModId
  slot: EquipmentModSlot
  stat: EquipmentStat
}

export type EquipmentAutoSellMode = 'keep_all' | 'sell_all' | 'rules'
export type EquipmentAutoSellModId = EquipmentModId | 'none'

/**
 * 詳細設定で装備を「残す」条件。
 * 配列が空の項目は不問。1ルール内はAND、複数ルール間はORで判定する。
 */
export interface EquipmentAutoSellKeepRule {
  titleIds: EquipmentTitleId[]
  prefixModIds: EquipmentAutoSellModId[]
  prefixTiers: EquipmentModTier[]
  suffixModIds: EquipmentAutoSellModId[]
  suffixTiers: EquipmentModTier[]
}

export interface EquipmentAutoSellPolicy {
  mode: EquipmentAutoSellMode
  keepRules: EquipmentAutoSellKeepRule[]
  /** 手動売却時に追加した、完全一致する装備を売る条件。残す条件より優先する。 */
  sellRules?: EquipmentAutoSellKeepRule[]
}

/**
 * 倉庫の一括売却から追加した自動売却条件。
 * 名前・カテゴリは保存時点で templateIds に解決し、称号とMOD数は今後のドロップにも適用する。
 */
export interface EquipmentAutoSellBulkFilter {
  templateIds: string[]
  titleIds: EquipmentTitleId[]
  modCount: 'all' | 1 | 2
}

export interface EquipmentAutoSellSettings {
  version: 1
  policies: Record<string, EquipmentAutoSellPolicy>
  bulkSellFilters?: EquipmentAutoSellBulkFilter[]
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
  isRare?: boolean  // レアアイテム判定（true なら装備一覧で同カテゴリ内のレア枠に並ぶ）
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
  prefixMod?: EquipmentModRoll
  suffixMod?: EquipmentModRoll
}
