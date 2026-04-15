import { create } from 'zustand'
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases'
import {
  REVENUECAT_API_KEY,
  ENTITLEMENT_IDS,
  TICKET_TYPES,
  SPEED_HALF_MULTIPLIER,
  SPEED_TWO_THIRDS_MULTIPLIER,
  type TicketType,
} from '@/shared/constants/purchases'
import { SQLiteTicketRepository } from '@/infrastructure/repositories/SQLiteTicketRepository'
import type { TicketBalance } from '@/shared/types/Ticket'

/**
 * 課金状態管理ストア
 * RevenueCatのEntitlement + チケット残数を管理
 */

interface PurchaseState {
  isInitialized: boolean
  isLoading: boolean
  entitlements: Set<string>
  availablePackages: PurchasesPackage[]
  currentOffering: any | null
  customerInfo: CustomerInfo | null
  tickets: TicketBalance[]
}

interface PurchaseActions {
  initialize: () => Promise<void>
  hasEntitlement: (entitlementId: string) => boolean
  fetchOfferings: () => Promise<void>
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ success: boolean; error?: string }>
  restorePurchases: () => Promise<{ success: boolean; error?: string }>
  refreshCustomerInfo: () => Promise<void>
  // チケット操作
  refreshTickets: () => Promise<void>
  addTickets: (type: TicketType, count: number) => Promise<void>
  useTicket: (type: TicketType) => Promise<boolean>
  getTicketCount: (type: TicketType) => number
  clear: () => void
}

const initialState: PurchaseState = {
  isInitialized: false,
  isLoading: false,
  entitlements: new Set(),
  availablePackages: [],
  currentOffering: null,
  customerInfo: null,
  tickets: [],
}

const ticketRepository = SQLiteTicketRepository.getInstance()

export const usePurchaseStore = create<PurchaseState & PurchaseActions>()((set, get) => ({
  ...initialState,

  initialize: async () => {
    if (get().isInitialized) return

    try {
      // デバッグモードでは初期化をスキップ（課金なしでテスト可能）
      if (__DEV__ && process.env.EXPO_PUBLIC_SKIP_PURCHASES === 'true') {
        console.log('[Purchase] Skipping RevenueCat initialization in dev mode')
        // チケットだけはロードする
        await get().refreshTickets()
        set({ isInitialized: true })
        return
      }

      await Purchases.configure({ apiKey: REVENUECAT_API_KEY })

      if (__DEV__) {
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG)
      }

      await get().refreshCustomerInfo()
      await get().refreshTickets()

      set({ isInitialized: true })
      console.log('[Purchase] RevenueCat initialized successfully')
    } catch (error) {
      console.error('[Purchase] Failed to initialize RevenueCat:', error)
      // 初期化失敗でもアプリは動作させる
      await get().refreshTickets()
      set({ isInitialized: true })
    }
  },

  hasEntitlement: (entitlementId: string) => {
    // デバッグモードでは全て有効
    if (__DEV__ && process.env.EXPO_PUBLIC_ALL_ENTITLEMENTS === 'true') {
      return true
    }

    return get().entitlements.has(entitlementId)
  },

  fetchOfferings: async () => {
    try {
      set({ isLoading: true })
      const offerings = await Purchases.getOfferings()

      if (offerings.current && offerings.current.availablePackages.length > 0) {
        set({
          availablePackages: offerings.current.availablePackages,
          currentOffering: offerings.current,
        })
        console.log('[Purchase] Loaded offering:', offerings.current.identifier)
        console.log('[Purchase] Available packages:', offerings.current.availablePackages.length)
      } else {
        console.log('[Purchase] No current offering available')
      }
    } catch (error) {
      console.error('[Purchase] Failed to fetch offerings:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  purchasePackage: async (pkg: PurchasesPackage) => {
    try {
      set({ isLoading: true })
      console.log('[Purchase] Purchasing package:', pkg.identifier)

      const { customerInfo } = await Purchases.purchasePackage(pkg)

      // Entitlementsを更新
      const newEntitlements = new Set<string>()
      Object.keys(customerInfo.entitlements.active).forEach((key) => {
        if (customerInfo.entitlements.active[key].isActive) {
          newEntitlements.add(key)
        }
      })

      set({
        customerInfo,
        entitlements: newEntitlements,
      })

      console.log('[Purchase] Purchase successful! Active entitlements:', Array.from(newEntitlements))

      return { success: true }
    } catch (error: any) {
      console.error('[Purchase] Purchase failed:', error)

      if (error.userCancelled) {
        return { success: false, error: 'cancelled' }
      }

      return { success: false, error: error.message || 'unknown_error' }
    } finally {
      set({ isLoading: false })
    }
  },

  restorePurchases: async () => {
    try {
      set({ isLoading: true })
      const customerInfo = await Purchases.restorePurchases()

      const newEntitlements = new Set<string>()
      Object.keys(customerInfo.entitlements.active).forEach((key) => {
        if (customerInfo.entitlements.active[key].isActive) {
          newEntitlements.add(key)
        }
      })

      set({
        customerInfo,
        entitlements: newEntitlements,
      })

      return { success: true }
    } catch (error: any) {
      console.error('[Purchase] Restore failed:', error)
      return { success: false, error: error.message || 'unknown_error' }
    } finally {
      set({ isLoading: false })
    }
  },

  refreshCustomerInfo: async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo()

      const newEntitlements = new Set<string>()
      Object.keys(customerInfo.entitlements.active).forEach((key) => {
        if (customerInfo.entitlements.active[key].isActive) {
          newEntitlements.add(key)
        }
      })

      set({
        customerInfo,
        entitlements: newEntitlements,
      })

      console.log('[Purchase] Active entitlements:', Array.from(newEntitlements))
    } catch (error) {
      console.error('[Purchase] Failed to refresh customer info:', error)
    }
  },

  // チケット操作
  refreshTickets: async () => {
    try {
      const tickets = await ticketRepository.getAllTickets()
      set({ tickets })
    } catch (error) {
      console.error('[Purchase] Failed to refresh tickets:', error)
    }
  },

  addTickets: async (type: TicketType, count: number) => {
    await ticketRepository.addTickets(type, count)
    await get().refreshTickets()
  },

  useTicket: async (type: TicketType) => {
    const result = await ticketRepository.useTicket(type)
    if (result) {
      await get().refreshTickets()
    }
    return result
  },

  getTicketCount: (type: TicketType) => {
    const ticket = get().tickets.find(t => t.ticketType === type)
    return ticket?.quantity ?? 0
  },

  clear: () => {
    set(initialState)
  },
}))

// ヘルパー関数: 特定のEntitlementを持っているか確認
export const hasEntitlement = (entitlementId: string): boolean => {
  return usePurchaseStore.getState().hasEntitlement(entitlementId)
}

// 買い切り商品ヘルパー
export const hasGoblinCapacityExpansion = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.GOBLIN_CAPACITY_EXPANSION)
}

export const hasPartySlotExpansion = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.PARTY_SLOT_EXPANSION)
}

export const hasExpBoost = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.EXP_BOOST)
}

export const hasRareBoost = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.RARE_BOOST)
}

export const hasTitleBoost = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.TITLE_BOOST)
}

// 探索時間短縮ヘルパー
export const hasSpeedHalf = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.SPEED_HALF)
}

export const hasSpeedTwoThirds = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.SPEED_TWO_THIRDS)
}

/** 探索時間短縮の合算倍率を取得（買い切り分のみ） */
export const getSpeedMultiplier = (): number => {
  let multiplier = 1.0
  if (hasSpeedHalf()) multiplier *= SPEED_HALF_MULTIPLIER
  if (hasSpeedTwoThirds()) multiplier *= SPEED_TWO_THIRDS_MULTIPLIER
  return multiplier
}

// サブスクリプションヘルパー
export const hasMonthlyPass = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.MONTHLY_PASS)
}

// チケットヘルパー
export const getSpeedTicketCount = (): number => {
  return usePurchaseStore.getState().getTicketCount(TICKET_TYPES.SPEED)
}

export const getBoostTicketCount = (): number => {
  return usePurchaseStore.getState().getTicketCount(TICKET_TYPES.BOOST)
}
