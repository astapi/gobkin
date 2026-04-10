import { useCallback, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBaseStore, selectGold, selectIvBonus, selectMaxGoblins, selectMaxParties, selectRank } from '@/presentation/stores/useBaseStore'
import { BASE_RANK_CONFIGS } from '@/core/services/BaseRankSystem'
import { areasData } from '@/shared/data'
import { getDungeonName } from '@/shared/i18n/entityLocalization'

export default function BaseUpgradeScreen() {
  const baseState = useBaseStore((state) => state.baseState)
  const performRankUp = useBaseStore((state) => state.performRankUp)
  const rank = useBaseStore(selectRank)
  const maxParties = useBaseStore(selectMaxParties)
  const maxGoblins = useBaseStore(selectMaxGoblins)
  const ivBonus = useBaseStore(selectIvBonus)
  const gold = useBaseStore(selectGold)
  const [isRankingUp, setIsRankingUp] = useState(false)

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
      ivBonus: nextConfig.ivBonus,
      upgradeCost: nextConfig.upgradeCost,
    }
  }, [baseState, rank])

  const handleRankUp = useCallback(() => {
    if (!nextRankInfo) return

    Alert.alert(
      'ランクアップ確認',
      `拠点をランク${nextRankInfo.nextRank}にランクアップしますか？\n\n引っ越し資金: ${nextRankInfo.upgradeCost}G\n所持ゴールド: ${gold}G`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ランクアップ',
          onPress: async () => {
            setIsRankingUp(true)
            const result = await performRankUp()
            setIsRankingUp(false)

            if (result.success) {
              Alert.alert(
                'ランクアップ成功',
                `拠点がランク${nextRankInfo.nextRank}になりました。\n新しい施設機能が解放されています。`
              )
            } else {
              Alert.alert('ランクアップ失敗', result.error)
            }
          },
        },
      ]
    )
  }, [gold, nextRankInfo, performRankUp])

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>現在の拠点</Text>
          <Text style={styles.summaryRank}>ランク {rank}</Text>
          <Text style={styles.summaryGold}>所持ゴールド {gold}G</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>拡張計画</Text>
          {nextRankInfo ? (
            <>
              <View style={styles.upgradeSummary}>
                <View style={styles.upgradeItem}>
                  <Text style={styles.upgradeLabel}>目標ランク</Text>
                  <Text style={styles.upgradeValue}>ランク {nextRankInfo.nextRank}</Text>
                </View>
                <View style={styles.upgradeItem}>
                  <Text style={styles.upgradeLabel}>必要資金</Text>
                  <Text style={styles.upgradeValue}>{nextRankInfo.upgradeCost}G</Text>
                </View>
                <View style={styles.upgradeItemWide}>
                  <Text style={styles.upgradeLabel}>必要な制圧</Text>
                  <Text style={[styles.upgradeRequirement, nextRankInfo.isCaptured && styles.upgradeRequirementDone]}>
                    {nextRankInfo.dungeonName}
                  </Text>
                </View>
              </View>

              <View style={styles.benefitList}>
                <Text style={styles.benefitItem}>最大PT数 {maxParties} → {nextRankInfo.maxParties}</Text>
                <Text style={styles.benefitItem}>収容数 {maxGoblins} → {nextRankInfo.maxGoblins}</Text>
                <Text style={styles.benefitItem}>個体値補正 +{ivBonus} → +{nextRankInfo.ivBonus}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!nextRankInfo.isCaptured || gold < nextRankInfo.upgradeCost || isRankingUp) && styles.primaryButtonDisabled,
                ]}
                onPress={handleRankUp}
                disabled={!nextRankInfo.isCaptured || gold < nextRankInfo.upgradeCost || isRankingUp}
              >
                <Text style={styles.primaryButtonText}>
                  {isRankingUp ? '実行中...' : `ランク${nextRankInfo.nextRank}へ拡張する`}
                </Text>
              </TouchableOpacity>

              {!nextRankInfo.isCaptured && (
                <Text style={styles.helperText}>まずは {nextRankInfo.dungeonName} を制圧してください。</Text>
              )}
              {nextRankInfo.isCaptured && gold < nextRankInfo.upgradeCost && (
                <Text style={styles.helperText}>資金が足りません。必要額は {nextRankInfo.upgradeCost}G です。</Text>
              )}
            </>
          ) : (
            <Text style={styles.helperText}>現在の拠点は最大ランクです。</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 16,
    gap: 6,
  },
  summaryEyebrow: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  summaryRank: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryGold: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
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
  benefitList: {
    gap: 6,
  },
  benefitItem: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
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
