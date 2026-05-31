/**
 * RevenueCat 課金商品定義
 */

import { Platform } from 'react-native'

// RevenueCat API Keys
// __DEV__ は開発ビルドでtrue、リリースビルドでfalse
export const REVENUECAT_API_KEY = Platform.select({
  ios: __DEV__
    ? 'test_ZxHQADjDPDbpQqNJpUQpnEgeSMq' // Test Store用（開発時）
    : 'appl_XXXXXXXXXXXX', // Production用（リリース時）
  android: 'goog_XXXXXXXXXXXX', // Android用（リリース時に本番キーを設定）
}) as string

// Entitlement IDs（RevenueCatダッシュボードで設定）
export const ENTITLEMENT_IDS = {
  // 買い切り
  GOBLIN_CAPACITY_EXPANSION: 'goblin_capacity_expansion',
  PARTY_SLOT_EXPANSION: 'party_slot_expansion',
  EXP_BOOST: 'exp_boost',
  RARE_BOOST: 'rare_boost',
  TITLE_BOOST: 'title_boost',
  FACTOR_CORE_1: 'factor_core_1',
  FACTOR_CORE_2: 'factor_core_2',
  FACTOR_CORE_3: 'factor_core_3',
  SHADOW_CAT_SIDE_STORY: 'shadow_cat_side_story',
  NECROMANCER_SIDE_STORY: 'necromancer_side_story',
  SPEED_HALF: 'speed_half',           // 探索時間1/2
  SPEED_TWO_THIRDS: 'speed_two_thirds', // 探索時間2/3（SPEED_HALF購入後に解放）
  // サブスクリプション
  MONTHLY_PASS: 'monthly_pass',
} as const

// ゴブリン容量定数
export const GOBLIN_CAPACITY_BASE = 5         // 初期容量（ランクで増える分とは別）
export const GOBLIN_CAPACITY_EXPANSION = 10   // 課金による追加容量

// パーティ枠定数
export const PARTY_SLOT_BASE = 0              // 課金によるボーナス枠（ランクの枠に加算）
export const PARTY_SLOT_EXPANSION = 2         // 課金後のボーナス枠

// 倍率定数
export const EXP_BOOST_MULTIPLIER = 1.5       // 経験値倍率
export const RARE_BOOST_MULTIPLIER = 1.5      // レアドロップ倍率
export const TITLE_BOOST_MULTIPLIER = 1.5     // 称号倍率

export const FACTOR_CORE_TEMPLATE_ID = 'accessory_factor_core'
export const FACTOR_CORE_PURCHASE_LIMIT = 3
export const SHADOW_CAT_SIDE_STORY_ID = 'side_shadow_cat_ruins'
export const SHADOW_CAT_DUNGEON_ID = 'cat_fortress_1'
export const NECROMANCER_SIDE_STORY_ID = 'side_necromancer_crypt'
export const NECROMANCER_DUNGEON_ID = 'necromancer_crypt_1'

// 探索時間短縮定数
export const SPEED_HALF_MULTIPLIER = 0.5          // 探索時間1/2
export const SPEED_TWO_THIRDS_MULTIPLIER = 2 / 3  // 探索時間2/3

// 月額パス特典
export const MONTHLY_PASS_REWARD_MULTIPLIER = 1.5   // レア・Gold・称号・因子獲得倍率
export const MONTHLY_PASS_SPEED_MULTIPLIER = 0.8    // 遠征時間倍率（0.8 = 20%短縮）
export const MONTHLY_PASS_GOLDEN_ACORN_QUANTITY = 50

// チケット種別
export const TICKET_TYPES = {
  SPEED: 'speed_ticket',
  BOOST: 'boost_ticket',
  GOLDEN_ACORN: 'golden_acorn',
} as const

export type TicketType = typeof TICKET_TYPES[keyof typeof TICKET_TYPES]

// チケット効果
export const SPEED_TICKET_MULTIPLIER = 0.5    // 遠征時間倍率（0.5 = 50%短縮）
export const BOOST_TICKET_MULTIPLIER = 2.0    // ドロップ率・経験値倍率

// 金のドングリ効果（出撃時に1個消費する Consumable）
export const GOLDEN_ACORN_SPEED_MULTIPLIER = 0.5   // 探索時間 1/2
export const GOLDEN_ACORN_EXP_MULTIPLIER = 2.0     // 経験値倍率 2倍
export const GOLDEN_ACORN_GOLD_MULTIPLIER = 2.0    // Gold 倍率 2倍
export const GOLDEN_ACORN_RARE_MULTIPLIER = 2.0    // レアドロップ倍率 2倍
export const GOLDEN_ACORN_TITLE_MULTIPLIER = 2.0   // 称号倍率 2倍

// 商品情報（UI表示用 + Package ID → Entitlement ID マッピング）
export interface PurchaseProduct {
  packageId: string        // RevenueCat Package ID（ストア非依存）
  entitlementId: string | 'bundle'  // Entitlement ID。'bundle'の場合は全買い切りEntitlementが必要
  nameKey: string          // i18nキー
  descriptionKey: string   // i18nキー
  iconName: string         // アイコン名
  section: 'one_time' | 'subscription' | 'ticket' | 'equipment' | 'story'  // 表示セクション
  requiresEntitlement?: string  // この商品を購入するために必要な前提Entitlement
  /**
   * Consumable 商品で1回購入したときに付与されるチケット数。
   * section='ticket' のときに必須。purchasePackage 成功時、entitlementId をキーに tickets テーブルへ加算される。
   */
  consumableQuantity?: number
  /**
   * 課金で付与する装備テンプレートID。
   * section='equipment' のときに必須。購入成功時、equipment テーブルへ1個付与される。
   */
  equipmentTemplateId?: string
  /** 同一装備テンプレートの購入/所持上限。装備中と未装備を合算する。 */
  purchaseLimit?: number
  /** 同一上限付き装備商品の購入順。1始まり。 */
  purchaseIndex?: number
  /** 課金で解放するサイドストーリーID。 */
  storyId?: string
  /** 課金で解放するダンジョンID一覧。 */
  unlockDungeonIds?: string[]
}

export const PURCHASE_PRODUCTS: PurchaseProduct[] = [
  // 買い切り商品
  {
    packageId: 'goblin_capacity_expansion',
    entitlementId: ENTITLEMENT_IDS.GOBLIN_CAPACITY_EXPANSION,
    nameKey: 'shop.goblinCapacityExpansion.name',
    descriptionKey: 'shop.goblinCapacityExpansion.description',
    iconName: 'people',
    section: 'one_time',
  },
  {
    packageId: 'party_slot_expansion',
    entitlementId: ENTITLEMENT_IDS.PARTY_SLOT_EXPANSION,
    nameKey: 'shop.partySlotExpansion.name',
    descriptionKey: 'shop.partySlotExpansion.description',
    iconName: 'shield',
    section: 'one_time',
  },
  {
    packageId: 'exp_boost',
    entitlementId: ENTITLEMENT_IDS.EXP_BOOST,
    nameKey: 'shop.expBoost.name',
    descriptionKey: 'shop.expBoost.description',
    iconName: 'star',
    section: 'one_time',
  },
  {
    packageId: 'rare_boost',
    entitlementId: ENTITLEMENT_IDS.RARE_BOOST,
    nameKey: 'shop.rareBoost.name',
    descriptionKey: 'shop.rareBoost.description',
    iconName: 'diamond',
    section: 'one_time',
  },
  {
    packageId: 'title_boost',
    entitlementId: ENTITLEMENT_IDS.TITLE_BOOST,
    nameKey: 'shop.titleBoost.name',
    descriptionKey: 'shop.titleBoost.description',
    iconName: 'award',
    section: 'one_time',
  },
  {
    packageId: 'speed_half',
    entitlementId: ENTITLEMENT_IDS.SPEED_HALF,
    nameKey: 'shop.speedHalf.name',
    descriptionKey: 'shop.speedHalf.description',
    iconName: 'fast-forward',
    section: 'one_time',
  },
  {
    packageId: 'speed_two_thirds',
    entitlementId: ENTITLEMENT_IDS.SPEED_TWO_THIRDS,
    nameKey: 'shop.speedTwoThirds.name',
    descriptionKey: 'shop.speedTwoThirds.description',
    iconName: 'fast-forward',
    section: 'one_time',
    requiresEntitlement: ENTITLEMENT_IDS.SPEED_HALF, // 1/2購入後に解放
  },
  {
    packageId: 'premium_bundle',
    entitlementId: 'bundle', // 特別値：全買い切りEntitlementを含む
    nameKey: 'shop.premiumBundle.name',
    descriptionKey: 'shop.premiumBundle.description',
    iconName: 'crown',
    section: 'one_time',
  },
  // サブスクリプション
  {
    packageId: 'monthly_pass',
    entitlementId: ENTITLEMENT_IDS.MONTHLY_PASS,
    nameKey: 'shop.monthlyPass.name',
    descriptionKey: 'shop.monthlyPass.description',
    iconName: 'calendar',
    section: 'subscription',
  },
  // サイドストーリー/ダンジョン
  {
    packageId: 'shadow_cat_side_story',
    entitlementId: ENTITLEMENT_IDS.SHADOW_CAT_SIDE_STORY,
    nameKey: 'shop.shadowCatSideStory.name',
    descriptionKey: 'shop.shadowCatSideStory.description',
    iconName: 'book',
    section: 'story',
    storyId: SHADOW_CAT_SIDE_STORY_ID,
    unlockDungeonIds: [SHADOW_CAT_DUNGEON_ID],
  },
  {
    packageId: 'necromancer_side_story',
    entitlementId: ENTITLEMENT_IDS.NECROMANCER_SIDE_STORY,
    nameKey: 'shop.necromancerSideStory.name',
    descriptionKey: 'shop.necromancerSideStory.description',
    iconName: 'book',
    section: 'story',
    storyId: NECROMANCER_SIDE_STORY_ID,
    unlockDungeonIds: [NECROMANCER_DUNGEON_ID],
  },
  // チケット（Consumable）
  {
    packageId: 'speed_ticket_5',
    entitlementId: TICKET_TYPES.SPEED,
    nameKey: 'shop.speedTicket.name',
    descriptionKey: 'shop.speedTicket.description',
    iconName: 'zap',
    section: 'ticket',
    consumableQuantity: 5,
  },
  {
    packageId: 'boost_ticket_5',
    entitlementId: TICKET_TYPES.BOOST,
    nameKey: 'shop.boostTicket.name',
    descriptionKey: 'shop.boostTicket.description',
    iconName: 'trending-up',
    section: 'ticket',
    consumableQuantity: 5,
  },
  // 課金装備
  {
    packageId: 'factor_core_1',
    entitlementId: ENTITLEMENT_IDS.FACTOR_CORE_1,
    nameKey: 'shop.factorCore.name',
    descriptionKey: 'shop.factorCore.description',
    iconName: 'sparkles',
    section: 'equipment',
    equipmentTemplateId: FACTOR_CORE_TEMPLATE_ID,
    purchaseLimit: FACTOR_CORE_PURCHASE_LIMIT,
    purchaseIndex: 1,
  },
  {
    packageId: 'factor_core_2',
    entitlementId: ENTITLEMENT_IDS.FACTOR_CORE_2,
    nameKey: 'shop.factorCore.name',
    descriptionKey: 'shop.factorCore.description',
    iconName: 'sparkles',
    section: 'equipment',
    equipmentTemplateId: FACTOR_CORE_TEMPLATE_ID,
    purchaseLimit: FACTOR_CORE_PURCHASE_LIMIT,
    purchaseIndex: 2,
    requiresEntitlement: ENTITLEMENT_IDS.FACTOR_CORE_1,
  },
  {
    packageId: 'factor_core_3',
    entitlementId: ENTITLEMENT_IDS.FACTOR_CORE_3,
    nameKey: 'shop.factorCore.name',
    descriptionKey: 'shop.factorCore.description',
    iconName: 'sparkles',
    section: 'equipment',
    equipmentTemplateId: FACTOR_CORE_TEMPLATE_ID,
    purchaseLimit: FACTOR_CORE_PURCHASE_LIMIT,
    purchaseIndex: 3,
    requiresEntitlement: ENTITLEMENT_IDS.FACTOR_CORE_2,
  },
  // 金のドングリ（バンドルが大きいほど割安）
  {
    packageId: 'golden_acorn_50',
    entitlementId: TICKET_TYPES.GOLDEN_ACORN,
    nameKey: 'shop.goldenAcorn.name50',
    descriptionKey: 'shop.goldenAcorn.description',
    iconName: 'gift',
    section: 'ticket',
    consumableQuantity: 50,
  },
  {
    packageId: 'golden_acorn_100',
    entitlementId: TICKET_TYPES.GOLDEN_ACORN,
    nameKey: 'shop.goldenAcorn.name100',
    descriptionKey: 'shop.goldenAcorn.descriptionDiscount',
    iconName: 'gift',
    section: 'ticket',
    consumableQuantity: 100,
  },
  {
    packageId: 'golden_acorn_200',
    entitlementId: TICKET_TYPES.GOLDEN_ACORN,
    nameKey: 'shop.goldenAcorn.name200',
    descriptionKey: 'shop.goldenAcorn.descriptionDiscount',
    iconName: 'gift',
    section: 'ticket',
    consumableQuantity: 200,
  },
  {
    packageId: 'golden_acorn_500',
    entitlementId: TICKET_TYPES.GOLDEN_ACORN,
    nameKey: 'shop.goldenAcorn.name500',
    descriptionKey: 'shop.goldenAcorn.descriptionDiscount',
    iconName: 'gift',
    section: 'ticket',
    consumableQuantity: 500,
  },
]

// バンドル商品に含まれるEntitlement一覧
export const BUNDLE_ENTITLEMENTS = [
  ENTITLEMENT_IDS.GOBLIN_CAPACITY_EXPANSION,
  ENTITLEMENT_IDS.PARTY_SLOT_EXPANSION,
  ENTITLEMENT_IDS.EXP_BOOST,
  ENTITLEMENT_IDS.RARE_BOOST,
  ENTITLEMENT_IDS.TITLE_BOOST,
  ENTITLEMENT_IDS.SPEED_HALF,
  ENTITLEMENT_IDS.SPEED_TWO_THIRDS,
] as const
