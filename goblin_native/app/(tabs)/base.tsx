import type { FC } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import type { SvgProps } from 'react-native-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useBaseStore, selectRank, selectMaxParties, selectMaxGoblins, selectCanRankUp } from '@/presentation/stores/useBaseStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { GOBLIN_TRAINING_UNLOCK_RANK } from '@/shared/data/goblinJobs'
import { getBaseLocationName } from '@/shared/i18n/entityLocalization'
import CapacityIcon from '../../assets/base/icon-capacity.svg'
import EquipmentShopIcon from '../../assets/base/icon-equipment-shop.svg'
import HealingIcon from '../../assets/base/icon-healing.svg'
import RankBadgeIcon from '../../assets/base/rank-badge.svg'
import SpecialShopIcon from '../../assets/base/icon-special-shop.svg'
import TrainingIcon from '../../assets/base/icon-training.svg'
import UpgradeIcon from '../../assets/base/icon-upgrade.svg'
import MaxPartiesIcon from '../../assets/tab/tab_hensei.svg'

const EQUIPMENT_SHOP_UNLOCK_RANK = 2
const baseHeaderImages: Record<number, ImageSourcePropType> = {
  1: require('../../assets/base/base-header-rank-1-cave.jpg'),
  2: require('../../assets/base/base-header-rank-2-goblin-settlement.jpg'),
  3: require('../../assets/base/base-header-rank-3-frontier-village.jpg'),
  4: require('../../assets/base/base-header-rank-4-orc-fortress.jpg'),
}
type BaseMenuItem = {
  title: string
  description: string
  href: Extract<Href, string>
  unlockRank: number
  Icon: FC<SvgProps>
  showBadge?: boolean
}

export default function BaseManagementScreen() {
  const { t } = useTranslation()
  const baseLoading = useBaseStore((state) => state.isLoading)
  const rank = useBaseStore(selectRank)
  const maxParties = useBaseStore(selectMaxParties)
  const maxGoblins = useBaseStore(selectMaxGoblins)
  const canRankUp = useBaseStore(selectCanRankUp)
  const goblins = useGoblinStore((state) => state.goblins)
  const baseLocationName = getBaseLocationName(rank) || t('ui.base.locationUnknown')
  const baseHeaderImage = baseHeaderImages[rank] ?? baseHeaderImages[4]

  const menuItems: BaseMenuItem[] = [
    {
      title: t('ui.base.healingTitle'),
      description: t('ui.base.healingDescription'),
      href: '/base/healing' as const,
      unlockRank: 1,
      Icon: HealingIcon,
    },
    {
      title: t('ui.base.upgradeTitle'),
      description: t('ui.base.upgradeDescription'),
      href: '/base/upgrade' as const,
      unlockRank: 1,
      Icon: UpgradeIcon,
      showBadge: canRankUp,
    },
    {
      title: t('ui.base.trainingTitle'),
      description: t('ui.base.trainingDescription'),
      href: '/base/training' as const,
      unlockRank: GOBLIN_TRAINING_UNLOCK_RANK,
      Icon: TrainingIcon,
    },
    {
      title: t('ui.base.shopTitle'),
      description: t('ui.base.shopDescription'),
      href: '/base/shop' as const,
      unlockRank: EQUIPMENT_SHOP_UNLOCK_RANK,
      Icon: EquipmentShopIcon,
    },
    {
      title: t('ui.base.premiumShopTitle'),
      description: t('ui.base.premiumShopDescription'),
      href: '/shop' as const,
      unlockRank: 1,
      Icon: SpecialShopIcon,
    },
  ].filter((item) => rank >= item.unlockRank)

  if (baseLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <ImageBackground source={baseHeaderImage} resizeMode="cover" style={styles.header}>
          <View style={styles.headerOverlay} />
          <View style={styles.headerContent}>
            <Text style={styles.screenTitle}>{t('ui.base.title')}</Text>
            <Text style={styles.screenLead}>{t('ui.base.lead')}</Text>
            <View style={styles.baseOverview}>
              <View style={styles.rankBadgeWrap}>
                <RankBadgeIcon width={104} height={112} style={styles.rankBadgeImage} />
                <View style={styles.rankBadgeTextWrap}>
                  <Text style={styles.rankBadgeLabel}>{t('ui.base.rankLabel')}</Text>
                  <Text style={styles.rankBadgeValue}>{rank}</Text>
                </View>
              </View>
              <View style={styles.heroTextGroup}>
                <Text style={styles.baseName}>{baseLocationName}</Text>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.bodyContent}>
          <View style={styles.metricsGrid}>
            <MetricCard
              Icon={CapacityIcon}
              iconSize={38}
              label={t('ui.base.capacityLabel')}
              value={t('ui.base.capacityValue', { current: goblins.length, max: maxGoblins })}
            />
            <MetricCard
              Icon={MaxPartiesIcon}
              label={t('ui.base.maxPartiesLabel')}
              value={t('ui.base.maxPartiesValue', { maxParties })}
            />
          </View>

          <View style={styles.menuSectionHeader}>
            <Text style={styles.cardTitle}>{t('ui.base.menuTitle')}</Text>
            <View style={styles.menuDivider} />
          </View>

          <View style={styles.menuList}>
            {menuItems.map((item) => (
              <TouchableOpacity key={item.href} style={styles.menuButton} onPress={() => router.push(item.href)}>
                <View style={styles.menuButtonIconWrap}>
                  <item.Icon width={42} height={42} />
                  {item.showBadge ? (
                    <View style={styles.menuButtonBadge} pointerEvents="none">
                      <Text style={styles.menuButtonBadgeText}>!</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.menuButtonTextGroup}>
                  <Text style={styles.menuButtonTitle}>{item.title}</Text>
                  <Text style={styles.menuButtonDescription}>{item.description}</Text>
                </View>
                <Text style={styles.menuButtonArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function MetricCard({ Icon, iconSize = 28, label, value }: { Icon: FC<SvgProps>; iconSize?: number; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Icon width={iconSize} height={iconSize} />
      <View style={styles.metricTextGroup}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 88,
  },
  header: {
    minHeight: 264,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: '#EFE6D3',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 239, 224, 0.28)',
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 11,
  },
  screenTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    color: '#101725',
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  screenLead: {
    width: '68%',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
    color: '#25303D',
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  baseOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  rankBadgeWrap: {
    width: 104,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeImage: {
    position: 'absolute',
  },
  rankBadgeTextWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  rankBadgeLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    color: '#101722',
  },
  rankBadgeValue: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    color: '#101722',
  },
  heroTextGroup: {
    flex: 1,
    gap: 5,
  },
  baseName: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    color: '#101722',
    flexShrink: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bodyContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E7E2D8',
    gap: 8,
    shadowColor: '#2B2112',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  metricTextGroup: {
    alignItems: 'center',
    gap: 1,
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: '#273241',
  },
  metricValue: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    color: '#101623',
  },
  menuSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: '#172033',
  },
  menuDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(122, 105, 69, 0.28)',
  },
  menuList: {
    gap: 8,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E7E2D8',
    gap: 12,
    shadowColor: '#2B2112',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  menuButtonIconWrap: {
    width: 42,
    height: 42,
    position: 'relative',
  },
  menuButtonBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  menuButtonBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  menuButtonTextGroup: {
    flex: 1,
    gap: 3,
  },
  menuButtonTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: '#111722',
  },
  menuButtonDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: '#4F5968',
  },
  menuButtonArrow: {
    fontSize: 26,
    lineHeight: 26,
    color: '#8A919D',
  },
})
