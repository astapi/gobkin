import { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBaseStore, selectRank, selectCapacity, selectMaxParties, selectMaxGoblins, selectIvBonus, selectGold } from '@/presentation/stores/useBaseStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { checkRankUpAvailable, BASE_RANK_CONFIGS } from '@/core/services/BaseRankSystem'
import { areasData } from '@/shared/data'

export default function BaseManagementScreen() {
  const { isLoading: baseLoading, baseState, performRankUp } = useBaseStore()
  const rank = useBaseStore(selectRank)
  const capacity = useBaseStore(selectCapacity)
  const maxParties = useBaseStore(selectMaxParties)
  const maxGoblins = useBaseStore(selectMaxGoblins)
  const ivBonus = useBaseStore(selectIvBonus)
  const gold = useBaseStore(selectGold)
  const { goblins } = useGoblinStore()

  const [isRankingUp, setIsRankingUp] = useState(false)

  const currentGoblinCount = goblins.length

  // 次のランクアップ情報を計算
  const nextRankInfo = useMemo(() => {
    if (!baseState) return null
    const nextConfig = BASE_RANK_CONFIGS.find(c => c.rank === rank + 1)
    if (!nextConfig) return null

    const targetDungeon = areasData.find(d => d.id === nextConfig.unlockCondition.dungeonId)
    const isCaptured = baseState.capturedDungeons.includes(nextConfig.unlockCondition.dungeonId)

    return {
      nextRank: nextConfig.rank,
      dungeonName: targetDungeon?.name || nextConfig.unlockCondition.dungeonId,
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
                'ランクアップ成功！',
                `拠点がランク${nextRankInfo.nextRank}になりました！\n\n新しい能力が解放されました。`,
                [{ text: 'OK' }]
              )
            } else {
              Alert.alert('ランクアップ失敗', result.error, [{ text: 'OK' }])
            }
          },
        },
      ]
    )
  }, [nextRankInfo, gold, performRankUp])

  if (baseLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.screenTitle}>拠点管理</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>拠点ステータス</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>拠点ランク</Text>
              <View style={styles.statusValueBox}>
                <Text style={styles.statusValueText}>Lv. {rank}</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>所持ゴールド</Text>
              <View style={styles.statusValueBox}>
                <Text style={styles.statusValueText}>{gold}G</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>最大PT数</Text>
              <View style={styles.statusValueBox}>
                <Text style={styles.statusValueText}>{maxParties}</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>収容数</Text>
              <View style={styles.statusValueBox}>
                <Text style={styles.statusValueText}>{maxGoblins}</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>個体値ボーナス</Text>
              <View style={styles.statusValueBox}>
                <Text style={styles.statusValueText}>+{ivBonus}</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>現在のゴブリン</Text>
              <Text style={styles.statusValuePlain}>{currentGoblinCount} / {maxGoblins}</Text>
            </View>
          </View>
        </View>

        {nextRankInfo && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>次のランクアップ</Text>
            <View style={styles.rankUpInfo}>
              <View style={styles.rankUpRow}>
                <Text style={styles.rankUpLabel}>目標拠点ランク:</Text>
                <Text style={styles.rankUpValue}>Lv. {nextRankInfo.nextRank}</Text>
              </View>
              <View style={styles.rankUpRow}>
                <Text style={styles.rankUpLabel}>引っ越し資金:</Text>
                <Text style={styles.rankUpValue}>{nextRankInfo.upgradeCost}G</Text>
              </View>
              <View style={styles.rankUpRow}>
                <Text style={styles.rankUpLabel}>必要な制圧:</Text>
                <View style={styles.rankUpDungeonRow}>
                  <Text style={[styles.rankUpValue, nextRankInfo.isCaptured && styles.rankUpCompleted]}>
                    {nextRankInfo.dungeonName}
                  </Text>
                  {nextRankInfo.isCaptured && (
                    <Text style={styles.rankUpCheck}>✓</Text>
                  )}
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={styles.rankUpBenefitsTitle}>ランクアップ時の効果:</Text>
              <View style={styles.rankUpBenefits}>
                <Text style={styles.rankUpBenefit}>• 最大PT数: {maxParties} → {nextRankInfo.maxParties}</Text>
                <Text style={styles.rankUpBenefit}>• 収容数: {maxGoblins} → {nextRankInfo.maxGoblins}</Text>
                <Text style={styles.rankUpBenefit}>• 個体値ボーナス: +{ivBonus} → +{nextRankInfo.ivBonus}</Text>
              </View>

              {nextRankInfo.isCaptured && (
                <TouchableOpacity
                  style={[
                    styles.rankUpButton,
                    (gold < nextRankInfo.upgradeCost || isRankingUp) && styles.rankUpButtonDisabled
                  ]}
                  onPress={handleRankUp}
                  disabled={gold < nextRankInfo.upgradeCost || isRankingUp}
                >
                  <Text style={[
                    styles.rankUpButtonText,
                    (gold < nextRankInfo.upgradeCost || isRankingUp) && styles.rankUpButtonTextDisabled
                  ]}>
                    {isRankingUp ? '実行中...' : `ランク${nextRankInfo.nextRank}にランクアップ (${nextRankInfo.upgradeCost}G)`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>• 遠征成功時にゴブリンが自動で拠点に追加されます</Text>
          <Text style={styles.noteText}>• 拠点がいっぱいの場合は待機リストに追加されます</Text>
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
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusItem: {
    flexBasis: '48%',
  },
  statusLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  statusValueBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusValueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statusValuePlain: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  noteCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  noteText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  rankUpInfo: {
    gap: 10,
  },
  rankUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankUpLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  rankUpValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  rankUpDungeonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankUpCompleted: {
    color: '#10B981',
    textDecorationLine: 'line-through',
  },
  rankUpCheck: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  rankUpBenefitsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  rankUpBenefits: {
    gap: 4,
  },
  rankUpBenefit: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  rankUpButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  rankUpButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  rankUpButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rankUpButtonTextDisabled: {
    color: '#9CA3AF',
  },
})
