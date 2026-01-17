import { useMemo, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { useDungeonProgress } from '@/presentation/hooks/useDungeonProgress'
import type { Goblin } from '@/shared/types'

export default function ExpeditionResultScreen() {
  const { partyId, dungeonId, success, xpGained, maxFloor } = useLocalSearchParams<{
    partyId: string
    dungeonId: string
    success: string
    xpGained: string
    maxFloor: string
  }>()

  const { getPartyById } = usePartyService()
  const { goblins } = useGoblinService()
  const { dungeons } = useDungeonProgress()

  const party = useMemo(() => {
    if (!partyId) return null
    return getPartyById(parseInt(partyId, 10))
  }, [partyId, getPartyById])

  const dungeon = useMemo(() => {
    const id = dungeonId || party?.dungeonId
    return dungeons.find(d => d.id === id)
  }, [dungeons, dungeonId, party?.dungeonId])

  const partyMembers = useMemo(() => {
    if (!party) return []
    return party.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }, [party, goblins])

  const isSuccess = success === 'true'
  const expGained = parseInt(xpGained || '0', 10)
  const floorsCleared = parseInt(maxFloor || '0', 10)

  const handleViewLog = useCallback(() => {
    router.push({
      pathname: '/formation/log',
      params: { partyId },
    })
  }, [partyId])

  const handleBackToList = useCallback(() => {
    router.replace('/formation')
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={[styles.resultBadge, isSuccess ? styles.successBadge : styles.failureBadge]}>
            <Text style={styles.resultText}>{isSuccess ? '踏破成功' : '撤退'}</Text>
          </View>
          <Text style={styles.title}>遠征完了</Text>
          {party && dungeon && (
            <Text style={styles.subtitle}>{party.name} → {dungeon.name}</Text>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, isSuccess ? styles.successValue : styles.failureValue]}>
              {floorsCleared}
            </Text>
            <Text style={styles.statLabel}>到達階層</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.expValue]}>{expGained}</Text>
            <Text style={styles.statLabel}>獲得経験値</Text>
          </View>
        </View>

        {/* パーティメンバー */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>参加メンバー</Text>
          <View style={styles.memberList}>
            {partyMembers.map(member => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>G</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberLevel}>Lv.{member.level}</Text>
                </View>
                <View style={styles.expBadge}>
                  <Text style={styles.expBadgeText}>+{Math.floor(expGained / Math.max(partyMembers.length, 1))} EXP</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 結果サマリー */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ダンジョン</Text>
            <Text style={styles.summaryValue}>{dungeon?.name || '不明'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>総階層</Text>
            <Text style={styles.summaryValue}>{dungeon?.floors || 0}階</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>結果</Text>
            <Text style={[styles.summaryValue, isSuccess ? styles.successText : styles.failureText]}>
              {isSuccess ? '完全踏破' : `${floorsCleared}階で撤退`}
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.logButton} onPress={handleViewLog}>
            <Text style={styles.logButtonText}>詳細ログを見る</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneButton} onPress={handleBackToList}>
            <Text style={styles.doneButtonText}>完了</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 24,
  },
  resultBadge: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 16,
  },
  successBadge: {
    backgroundColor: '#10B981',
  },
  failureBadge: {
    backgroundColor: '#EF4444',
  },
  resultText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  successValue: {
    color: '#10B981',
  },
  failureValue: {
    color: '#F59E0B',
  },
  expValue: {
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  memberList: {
    gap: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberLevel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  expBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  expBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summarySection: {
    backgroundColor: '#111827',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successText: {
    color: '#10B981',
  },
  failureText: {
    color: '#F59E0B',
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  logButton: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  doneButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
})
