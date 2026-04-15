import { useState, useCallback, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { PurchasesPackage } from 'react-native-purchases'
import { usePurchaseStore } from '@/presentation/stores/usePurchaseStore'
import {
  PURCHASE_PRODUCTS,
  ENTITLEMENT_IDS,
  BUNDLE_ENTITLEMENTS,
  GOBLIN_CAPACITY_EXPANSION,
  PARTY_SLOT_EXPANSION,
  EXP_BOOST_MULTIPLIER,
  RARE_BOOST_MULTIPLIER,
  TITLE_BOOST_MULTIPLIER,
  MONTHLY_PASS_GOLD_MULTIPLIER,
  MONTHLY_PASS_SPEED_MULTIPLIER,
  TICKET_TYPES,
  type PurchaseProduct,
} from '@/shared/constants/purchases'

/** 商品のロック状態を判定 */
const isProductLocked = (productInfo: PurchaseProduct | undefined, hasEntitlementFn: (id: string) => boolean): boolean => {
  if (!productInfo?.requiresEntitlement) return false
  return !hasEntitlementFn(productInfo.requiresEntitlement)
}

export default function ShopScreen() {
  const { t } = useTranslation()
  const [isRestoring, setIsRestoring] = useState(false)

  const {
    isInitialized,
    isLoading,
    availablePackages,
    entitlements,
    tickets,
    initialize,
    fetchOfferings,
    purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
    getTicketCount,
  } = usePurchaseStore()

  // Entitlementチェック（状態変化を検知するためローカルで定義）
  const hasEntitlement = useCallback(
    (entitlementId: string) => {
      if (__DEV__ && process.env.EXPO_PUBLIC_ALL_ENTITLEMENTS === 'true') {
        return true
      }
      return entitlements.has(entitlementId)
    },
    [entitlements]
  )

  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [isInitialized, initialize])

  useEffect(() => {
    if (isInitialized && availablePackages.length === 0) {
      fetchOfferings()
    }
  }, [isInitialized, availablePackages.length, fetchOfferings])

  useFocusEffect(
    useCallback(() => {
      if (isInitialized) {
        refreshCustomerInfo()
      }
    }, [isInitialized, refreshCustomerInfo])
  )

  const handlePurchase = async (pkg: PurchasesPackage) => {
    const result = await purchasePackage(pkg)

    if (result.success) {
      Alert.alert(t('shop.purchaseSuccess'), t('shop.purchaseSuccessMessage'))
    } else if (result.error !== 'cancelled') {
      Alert.alert(t('shop.purchaseFailed'), t('shop.purchaseFailedMessage'))
    }
  }

  const handleRestore = async () => {
    setIsRestoring(true)
    const result = await restorePurchases()
    setIsRestoring(false)

    if (result.success) {
      Alert.alert(t('shop.restoreSuccess'), t('shop.restoreSuccessMessage'))
    } else {
      Alert.alert(t('shop.restoreFailed'), t('shop.restoreFailedMessage'))
    }
  }

  // 補間パラメータを取得
  const getDescriptionParams = (descriptionKey: string): Record<string, number | string> | undefined => {
    switch (descriptionKey) {
      case 'shop.goblinCapacityExpansion.description':
        return { count: GOBLIN_CAPACITY_EXPANSION }
      case 'shop.partySlotExpansion.description':
        return { count: PARTY_SLOT_EXPANSION }
      case 'shop.expBoost.description':
        return { multiplier: EXP_BOOST_MULTIPLIER }
      case 'shop.rareBoost.description':
        return { multiplier: RARE_BOOST_MULTIPLIER }
      case 'shop.titleBoost.description':
        return { multiplier: TITLE_BOOST_MULTIPLIER }
      case 'shop.monthlyPass.description':
        return {
          goldMultiplier: MONTHLY_PASS_GOLD_MULTIPLIER,
          speedPercent: Math.round((1 - MONTHLY_PASS_SPEED_MULTIPLIER) * 100),
        }
      default:
        return undefined
    }
  }

  // パッケージの表示情報を取得
  const getPackageDisplayInfo = (pkg: PurchasesPackage) => {
    const packageId = pkg.identifier
    const productInfo = PURCHASE_PRODUCTS.find(p => p.packageId === packageId)
    const entitlementId = productInfo?.entitlementId || packageId
    const descriptionParams = productInfo ? getDescriptionParams(productInfo.descriptionKey) : undefined

    return {
      iconName: productInfo?.iconName || 'star',
      name: productInfo ? t(productInfo.nameKey) : pkg.product.title,
      description: productInfo ? t(productInfo.descriptionKey, descriptionParams) : pkg.product.description || pkg.product.title,
      entitlementId,
      section: productInfo?.section || 'one_time',
    }
  }

  // バンドル商品の購入済み判定
  const isBundlePurchased = () => {
    return BUNDLE_ENTITLEMENTS.every(id => hasEntitlement(id))
  }

  // セクション別にフィルタしたパッケージを取得
  const getPackagesBySection = (section: PurchaseProduct['section']) => {
    return availablePackages.filter(pkg => {
      const productInfo = PURCHASE_PRODUCTS.find(p => p.packageId === pkg.identifier)
      return productInfo?.section === section
    })
  }

  const renderProductCard = (pkg: PurchasesPackage) => {
    const displayInfo = getPackageDisplayInfo(pkg)
    const productInfo = PURCHASE_PRODUCTS.find(p => p.packageId === pkg.identifier)

    const isBundleProduct = displayInfo.entitlementId === 'bundle'
    const isTicket = displayInfo.section === 'ticket'
    const isPurchased = isBundleProduct
      ? isBundlePurchased()
      : !isTicket && hasEntitlement(displayInfo.entitlementId)
    const isSubscriptionActive = displayInfo.section === 'subscription' && hasEntitlement(displayInfo.entitlementId)
    const isLocked = isProductLocked(productInfo, hasEntitlement)
    const isDisabled = isPurchased || isSubscriptionActive || isLocked
    const price = pkg.product.priceString

    // チケットの場合は残数を表示
    const ticketCount = isTicket
      ? getTicketCount(displayInfo.entitlementId as typeof TICKET_TYPES[keyof typeof TICKET_TYPES])
      : 0

    // ロックに必要な前提商品名を取得
    const requiredProductName = isLocked && productInfo?.requiresEntitlement
      ? PURCHASE_PRODUCTS.find(p => p.entitlementId === productInfo.requiresEntitlement)
      : undefined

    return (
      <TouchableOpacity
        key={pkg.identifier}
        style={[
          styles.productCard,
          isDisabled && !isLocked && styles.productCardPurchased,
          isLocked && styles.productCardLocked,
        ]}
        onPress={() => !isDisabled && handlePurchase(pkg)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <View style={styles.productInfo}>
          <View style={styles.productNameRow}>
            <Text style={[
              styles.productName,
              isPurchased && styles.productNamePurchased,
              isLocked && styles.productNameLocked,
            ]}>
              {displayInfo.name}
            </Text>
            {isPurchased && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{t('shop.purchased')}</Text>
              </View>
            )}
            {isSubscriptionActive && (
              <View style={[styles.statusBadge, styles.statusBadgeActive]}>
                <Text style={styles.statusText}>{t('shop.active')}</Text>
              </View>
            )}
            {isLocked && (
              <View style={[styles.statusBadge, styles.statusBadgeLocked]}>
                <Text style={styles.statusTextLocked}>{t('shop.locked')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.productDescription, isLocked && styles.productDescriptionLocked]}>
            {displayInfo.description}
          </Text>
          {isLocked && requiredProductName && (
            <Text style={styles.lockedHint}>
              {t('shop.lockedHint', { name: t(requiredProductName.nameKey) })}
            </Text>
          )}
          {isTicket && ticketCount > 0 && (
            <Text style={styles.ticketCount}>
              {t('shop.ticketCount', { count: ticketCount })}
            </Text>
          )}
        </View>

        {!isPurchased && !isSubscriptionActive && (
          <View style={[styles.priceContainer, isLocked && styles.priceContainerLocked]}>
            <Text style={[styles.priceText, isLocked && styles.priceTextLocked]}>{price}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  const renderSection = (title: string, section: PurchaseProduct['section']) => {
    const packages = getPackagesBySection(section)
    if (packages.length === 0) return null

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {packages.map(renderProductCard)}
      </View>
    )
  }

  if (!isInitialized || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
      </View>
    )
  }

  const hasProducts = availablePackages.some(pkg =>
    PURCHASE_PRODUCTS.some(p => p.packageId === pkg.identifier)
  )

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View>
          <Text style={styles.subtitle}>{t('shop.subtitle')}</Text>
        </View>
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isRestoring}
          activeOpacity={0.7}
        >
          <Text style={styles.restoreButtonText}>{t('shop.restore')}</Text>
        </TouchableOpacity>
      </View>

      {!hasProducts ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('shop.noProducts')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {renderSection(t('shop.sectionSubscription'), 'subscription')}
          {renderSection(t('shop.sectionOneTime'), 'one_time')}
          {renderSection(t('shop.sectionTicket'), 'ticket')}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  restoreButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  restoreButtonText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    paddingLeft: 4,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productCardPurchased: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  productCardLocked: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    opacity: 0.7,
  },
  productInfo: {
    flex: 1,
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  productNamePurchased: {
    color: '#16A34A',
  },
  productNameLocked: {
    color: '#9CA3AF',
  },
  productDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  productDescriptionLocked: {
    color: '#9CA3AF',
  },
  lockedHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  ticketCount: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
  },
  statusBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  statusBadgeLocked: {
    backgroundColor: '#E5E7EB',
  },
  statusTextLocked: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16A34A',
  },
  priceContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginLeft: 12,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B82F6',
  },
  priceContainerLocked: {
    backgroundColor: '#F3F4F6',
  },
  priceTextLocked: {
    color: '#9CA3AF',
  },
})
