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

// 探索時間短縮定数
export const SPEED_HALF_MULTIPLIER = 0.5          // 探索時間1/2
export const SPEED_TWO_THIRDS_MULTIPLIER = 2 / 3  // 探索時間2/3

// 月額パス特典
export const MONTHLY_PASS_GOLD_MULTIPLIER = 1.5     // ゴールド獲得倍率
export const MONTHLY_PASS_SPEED_MULTIPLIER = 0.8    // 遠征時間倍率（0.8 = 20%短縮）

// チケット種別
export const TICKET_TYPES = {
  SPEED: 'speed_ticket',
  BOOST: 'boost_ticket',
} as const

export type TicketType = typeof TICKET_TYPES[keyof typeof TICKET_TYPES]

// チケット効果
export const SPEED_TICKET_MULTIPLIER = 0.5    // 遠征時間倍率（0.5 = 50%短縮）
export const BOOST_TICKET_MULTIPLIER = 2.0    // ドロップ率・経験値倍率

// 商品情報（UI表示用 + Package ID → Entitlement ID マッピング）
export interface PurchaseProduct {
  packageId: string        // RevenueCat Package ID（ストア非依存）
  entitlementId: string | 'bundle'  // Entitlement ID。'bundle'の場合は全買い切りEntitlementが必要
  nameKey: string          // i18nキー
  descriptionKey: string   // i18nキー
  iconName: string         // アイコン名
  section: 'one_time' | 'subscription' | 'ticket'  // 表示セクション
  requiresEntitlement?: string  // この商品を購入するために必要な前提Entitlement
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
  // チケット（Consumable）
  {
    packageId: 'speed_ticket_5',
    entitlementId: TICKET_TYPES.SPEED,
    nameKey: 'shop.speedTicket.name',
    descriptionKey: 'shop.speedTicket.description',
    iconName: 'zap',
    section: 'ticket',
  },
  {
    packageId: 'boost_ticket_5',
    entitlementId: TICKET_TYPES.BOOST,
    nameKey: 'shop.boostTicket.name',
    descriptionKey: 'shop.boostTicket.description',
    iconName: 'trending-up',
    section: 'ticket',
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
