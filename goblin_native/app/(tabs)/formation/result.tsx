import { useMemo, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { useDungeonProgress } from '@/presentation/hooks/useDungeonProgress'
import { useExpeditionService } from '@/presentation/hooks/useExpeditionService'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { areasData } from '@/shared/data'
import type { Goblin } from '@/shared/types'

export default function ExpeditionResultScreen() {
  const { partyId, dungeonId, success, xpGained, maxFloor, expeditionId } = useLocalSearchParams<{
    partyId: string
    dungeonId: string
    success: string
    xpGained: string
    maxFloor: string
    expeditionId?: string
  }>()

  const { getPartyById } = usePartyService()
  const { goblins } = useGoblinService()
  const { dungeons } = useDungeonProgress()
  const { expeditionRecords, getExpeditionById, isLoading: isExpeditionLoading } = useExpeditionService()

  const expeditionRecord = useMemo(() => {
    if (!expeditionId) return null
    return getExpeditionById(expeditionId)
  }, [expeditionId, getExpeditionById, expeditionRecords])

  const replay = expeditionRecord?.replay ?? null
  const resolvedPartyId = expeditionRecord?.partyId ?? (partyId ? parseInt(partyId, 10) : null)

  const party = useMemo(() => {
    if (!resolvedPartyId) return null
    return getPartyById(resolvedPartyId)
  }, [resolvedPartyId, getPartyById])

  const dungeon = useMemo(() => {
    const id = expeditionRecord?.dungeonId || dungeonId || party?.dungeonId
    return dungeons.find(d => d.id === id)
  }, [dungeons, expeditionRecord?.dungeonId, dungeonId, party?.dungeonId])

  const isSuccess = replay?.summary.success ?? success === 'true'
  const expGained = replay?.summary.xpGained ?? parseInt(xpGained || '0', 10)
  const goldGained = replay?.summary.goldGained ?? 0
  const floorsCleared = replay?.summary.maxFloorReached ?? parseInt(maxFloor || '0', 10)

  const getPartyMember = useCallback((memberId: string) => {
    return goblins.find(g => g.id === parseInt(memberId, 10))
  }, [goblins])

  const isInjured = (memberId: string) => replay?.summary.injuries.includes(memberId) ?? false
  const isDead = (memberId: string) => replay?.summary.casualties.includes(memberId) ?? false

  const getResultText = () => {
    if (!replay) {
      return isSuccess ? 'ダンジョンを踏破しました。' : '帰還しました。'
    }
    if (replay.summary.casualties.length === replay.meta.party.length) {
      return '全滅しました。'
    }
    const area = areasData.find(a => a.id === replay.meta.areaId)
    if (replay.summary.success && replay.summary.maxFloorReached === area?.floors) {
      return 'ダンジョンを踏破しました。'
    }
    if (replay.summary.success) {
      return '目標階層を突破しました。'
    }
    return '帰還しました。'
  }

  const getPartyMemberHp = (memberId: string) => {
    const goblin = getPartyMember(memberId)
    if (!goblin) return { current: 0, max: 0 }

    if (isDead(memberId)) {
      return { current: 0, max: goblin.stats.hp }
    }

    if (isInjured(memberId)) {
      return { current: Math.floor(goblin.stats.hp * 0.5), max: goblin.stats.hp }
    }

    return { current: goblin.stats.hp, max: goblin.stats.hp }
  }

  const handleBackToList = useCallback(() => {
    router.replace('/formation')
  }, [])

  const area = replay ? areasData.find(a => a.id === replay.meta.areaId) : null
  const unlockNext = area?.unlockNext
  const nextAreaName = unlockNext
    ? areasData.find(a => a.id === unlockNext)?.name || unlockNext
    : null

  if (expeditionId && isExpeditionLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (expeditionId && !expeditionRecord) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>遠征結果が見つかりません</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (expeditionId && expeditionRecord && !expeditionRecord.replay) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>遠征結果が見つかりません</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>遠征結果</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>
            {dungeon?.name || '遠征'}: {getResultText()}
          </Text>
        </View>

        <View style={styles.section}>
          {(replay?.meta.party ?? party?.memberIds.map(id => id.toString()) ?? []).map(memberId => {
            const goblin = getPartyMember(memberId)
            const hp = getPartyMemberHp(memberId)
            const dead = isDead(memberId)
            return (
              <View key={memberId} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  {goblin ? (
                    <Image
                      source={getGoblinImage(goblin.avatar)}
                      style={[styles.memberAvatarImage, dead && styles.memberAvatarDead]}
                    />
                  ) : (
                    <Text style={styles.memberAvatarFallback}>?</Text>
                  )}
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{goblin?.name || `ID:${memberId}`}</Text>
                  <Text style={styles.memberHp}>({hp.current}/{hp.max})</Text>
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.summaryText}>経験値 {expGained.toLocaleString()} XP</Text>
          <Text style={styles.summaryText}>{goldGained.toLocaleString()} Gold を獲得</Text>
        </View>

        {nextAreaName && isSuccess && (
          <View style={styles.section}>
            <Text style={styles.summaryText}>次のエリア「{nextAreaName}」が解放されました</Text>
          </View>
        )}

        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.menuButton} onPress={handleBackToList}>
            <Text style={styles.menuButtonText}>メニューに戻る</Text>
          </TouchableOpacity>
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
    fontSize: 14,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  navBack: {
    fontSize: 14,
    color: '#374151',
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  navSpacer: {
    width: 60,
  },
  headerSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
  },
  memberAvatarDead: {
    opacity: 0.5,
  },
  memberAvatarFallback: {
    color: '#6B7280',
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  memberHp: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  summaryText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 6,
  },
  bottomSection: {
    padding: 16,
    backgroundColor: '#F3F4F6',
  },
  menuButton: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
