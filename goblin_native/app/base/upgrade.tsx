import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { FC } from 'react'
import type { ImageSourcePropType } from 'react-native'
import type { SvgProps } from 'react-native-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useBaseStore, selectGold, selectMaxGoblins, selectMaxParties, selectRank } from '@/presentation/stores/useBaseStore'
import { BASE_RANK_CONFIGS } from '@/core/services/BaseRankSystem'
import { areasData } from '@/shared/data'
import { getBaseLocationName, getDungeonName } from '@/shared/i18n/entityLocalization'
import CapacityIcon from '../../assets/base/icon-capacity.svg'
import RankBadgeIcon from '../../assets/base/rank-badge.svg'
import MaxPartiesIcon from '../../assets/tab/tab_hensei.svg'

const baseHeaderImages: Record<number, ImageSourcePropType> = {
  1: require('../../assets/base/base-header-rank-1-cave.jpg'),
  2: require('../../assets/base/base-header-rank-2-goblin-settlement.jpg'),
  3: require('../../assets/base/base-header-rank-3-frontier-village.jpg'),
  4: require('../../assets/base/base-header-rank-4-orc-fortress.jpg'),
}

export default function BaseUpgradeScreen() {
  const { t } = useTranslation()
  const baseState = useBaseStore((state) => state.baseState)
  const baseLoading = useBaseStore((state) => state.isLoading)
  const performRankUp = useBaseStore((state) => state.performRankUp)
  const rank = useBaseStore(selectRank)
  const maxParties = useBaseStore(selectMaxParties)
  const maxGoblins = useBaseStore(selectMaxGoblins)
  const gold = useBaseStore(selectGold)
  const [isRankingUp, setIsRankingUp] = useState(false)
  const baseLocationName = getBaseLocationName(rank) || t('ui.base.locationUnknown')
  const baseHeaderImage = baseHeaderImages[rank] ?? baseHeaderImages[4]

  const nextRankInfo = useMemo(() => {
    if (!baseState) return null
    const nextConfig = BASE_RANK_CONFIGS.find((config) => config.rank === rank + 1)
    if (!nextConfig) return null

    const targetDungeon = areasData.find((dungeon) => dungeon.id === nextConfig.unlockCondition.dungeonId)
    const isCaptured = baseState.capturedDungeons.includes(nextConfig.unlockCondition.dungeonId)

    return {
      nextRank: nextConfig.rank,
      dungeonName: targetDungeon ? getDungeonName(targetDungeon) : nextConfig.unlockCondition.dungeonId,
      isCaptured,
      maxParties: nextConfig.maxParties,
      maxGoblins: nextConfig.maxGoblins,
      upgradeCost: nextConfig.upgradeCost,
    }
  }, [baseState, rank])

  const handleRankUp = useCallback(() => {
    if (!nextRankInfo) return

    Alert.alert(
      t('ui.baseUpgrade.confirmTitle'),
      t('ui.baseUpgrade.confirmBody', {
        nextRank: nextRankInfo.nextRank,
        upgradeCost: nextRankInfo.upgradeCost,
        gold,
      }),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.baseUpgrade.rankUpAction'),
          onPress: async () => {
            setIsRankingUp(true)
            const result = await performRankUp()
            setIsRankingUp(false)

            if (result.success) {
              Alert.alert(
                t('ui.baseUpgrade.successTitle'),
                t('ui.baseUpgrade.successBody')
              )
            } else {
              Alert.alert(t('ui.baseUpgrade.failureTitle'), result.error)
            }
          },
        },
      ]
    )
  }, [gold, nextRankInfo, performRankUp, t])

  if (baseLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <ImageBackground source={baseHeaderImage} resizeMode="cover" style={styles.header}>
          <View style={styles.headerOverlay} />
          <View style={styles.headerContent}>
            <Text style={styles.screenTitle}>{t('ui.root.baseUpgrade')}</Text>
            <Text style={styles.summaryGold}>{t('ui.baseUpgrade.goldValue', { gold })}</Text>
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
          {nextRankInfo ? (
            <>
              <View style={styles.metricsGrid}>
                <ChangeMetricCard
                  Icon={CapacityIcon}
                  iconSize={38}
                  label={t('ui.base.capacityLabel')}
                  current={maxGoblins}
                  next={nextRankInfo.maxGoblins}
                />
                <ChangeMetricCard
                  Icon={MaxPartiesIcon}
                  label={t('ui.base.maxPartiesLabel')}
                  current={maxParties}
                  next={nextRankInfo.maxParties}
                />
              </View>

              <View style={styles.menuSectionHeader}>
                <Text style={styles.cardTitle}>{t('ui.baseUpgrade.planTitle')}</Text>
                <View style={styles.menuDivider} />
              </View>

              <View style={styles.card}>
                <View style={styles.upgradeSummary}>
                  <View style={styles.upgradeItem}>
                    <Text style={styles.upgradeLabel}>{t('ui.baseUpgrade.targetRankLabel')}</Text>
                    <Text style={styles.upgradeValue}>{t('ui.baseUpgrade.rankValue', { rank: nextRankInfo.nextRank })}</Text>
                  </View>
                  <View style={styles.upgradeItem}>
                    <Text style={styles.upgradeLabel}>{t('ui.baseUpgrade.costLabel')}</Text>
                    <Text style={styles.upgradeValue}>{t('ui.baseUpgrade.costValue', { cost: nextRankInfo.upgradeCost })}</Text>
                  </View>
                  <View style={styles.upgradeItemWide}>
                    <Text style={styles.upgradeLabel}>{t('ui.baseUpgrade.requiredCaptureLabel')}</Text>
                    <Text style={[styles.upgradeRequirement, nextRankInfo.isCaptured && styles.upgradeRequirementDone]}>
                      {nextRankInfo.dungeonName}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  testID="base-rank-up"
                  accessibilityRole="button"
                  accessibilityLabel={t('ui.baseUpgrade.rankUpButton', { nextRank: nextRankInfo.nextRank })}
                  accessibilityState={{
                    disabled: !nextRankInfo.isCaptured || gold < nextRankInfo.upgradeCost || isRankingUp,
                    busy: isRankingUp,
                  }}
                  style={[
                    styles.primaryButton,
                    (!nextRankInfo.isCaptured || gold < nextRankInfo.upgradeCost || isRankingUp) && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleRankUp}
                  disabled={!nextRankInfo.isCaptured || gold < nextRankInfo.upgradeCost || isRankingUp}
                >
                  <Text style={styles.primaryButtonText}>
                    {isRankingUp ? t('ui.baseUpgrade.processing') : t('ui.baseUpgrade.rankUpButton', { nextRank: nextRankInfo.nextRank })}
                  </Text>
                </TouchableOpacity>

                {!nextRankInfo.isCaptured && (
                  <Text style={styles.helperText}>{t('ui.baseUpgrade.captureRequiredHelp', { dungeonName: nextRankInfo.dungeonName })}</Text>
                )}
                {nextRankInfo.isCaptured && gold < nextRankInfo.upgradeCost && (
                  <Text style={styles.helperText}>{t('ui.baseUpgrade.insufficientGoldHelp', { upgradeCost: nextRankInfo.upgradeCost })}</Text>
                )}
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.helperText}>{t('ui.baseUpgrade.maxRankHelp')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function ChangeMetricCard({
  Icon,
  iconSize = 30,
  label,
  current,
  next,
}: {
  Icon: FC<SvgProps>
  iconSize?: number
  label: string
  current: number
  next: number
}) {
  return (
    <View style={styles.metricCard}>
      <Icon width={iconSize} height={iconSize} />
      <View style={styles.metricTextGroup}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>
          {current} <Text style={styles.metricArrow}>-&gt;</Text> {next}
        </Text>
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
  summaryGold: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
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
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
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
    lineHeight: 23,
    fontWeight: '800',
    color: '#101623',
    fontVariant: ['tabular-nums'],
  },
  metricArrow: {
    fontSize: 14,
    color: '#6B7280',
  },
  menuSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  menuDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(122, 105, 69, 0.28)',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E2D8',
    gap: 12,
    shadowColor: '#2B2112',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: '#172033',
  },
  upgradeSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  upgradeItem: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  upgradeItemWide: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  upgradeLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  upgradeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  upgradeRequirement: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  upgradeRequirementDone: {
    color: '#059669',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
})
