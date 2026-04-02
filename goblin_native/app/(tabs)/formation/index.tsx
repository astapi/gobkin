import { useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { useBaseState } from '@/presentation/hooks/useBaseState'
import { useExpeditionFlow, type ExpeditionHistoryDisplay } from '@/presentation/hooks/useExpeditionFlow'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import type { Party, Goblin, ExpeditionRecord } from '@/shared/types'

const MAX_PARTY_SLOTS = 6

interface MemberSlotProps {
  goblin?: Goblin
  isEmpty: boolean
  slotSize: number
  avatarSize: number
}

function MemberSlot({ goblin, isEmpty, slotSize, avatarSize }: MemberSlotProps) {
  if (isEmpty || !goblin) {
    return (
      <View style={[styles.memberSlot, { width: slotSize }]}>
        <View style={[styles.emptySlot, { width: avatarSize, height: avatarSize }]}>
          <Text style={styles.emptySlotText}>+</Text>
        </View>
      </View>
    )
  }

  const stats = getEffectiveStats(goblin)

  return (
    <View style={[styles.memberSlot, { width: slotSize }]}>
      <Text style={styles.memberLevel}>Lv{goblin.level}</Text>
      <Image source={getGoblinImage(goblin.avatar)} style={[styles.memberAvatar, { width: avatarSize, height: avatarSize }]} />
      <Text style={styles.memberHp}>HP{stats.hp}</Text>
    </View>
  )
}

interface PartyCardProps {
  party: Party
  goblins: Goblin[]
  onPress: () => void
  historyDisplays: ExpeditionHistoryDisplay[]
  onHistoryPress: (record: ExpeditionRecord, ongoing: boolean) => void
  onLogPress: (record: ExpeditionRecord) => void
  slotSize: number
  avatarSize: number
}

function PartyCard({
  party,
  goblins,
  onPress,
  historyDisplays,
  onHistoryPress,
  onLogPress,
  slotSize,
  avatarSize,
}: PartyCardProps) {
  const members = useMemo(() => {
    return party.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }, [party.memberIds, goblins])

  // 6スロット分の配列を作成
  const slots = useMemo(() => {
    const result: (Goblin | undefined)[] = []
    for (let i = 0; i < MAX_PARTY_SLOTS; i++) {
      result.push(members[i])
    }
    return result
  }, [members])

  const status = party.status ?? 'idle'
  return (
    <View style={styles.partyCard}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.partyHeader}>
          <Text style={styles.partyName}>{party.name}</Text>
          {status === 'expedition' && (
            <View style={styles.expeditionBadge}>
              <Text style={styles.expeditionBadgeText}>遠征中</Text>
            </View>
          )}
        </View>

        <View style={styles.membersRow}>
          {slots.map((goblin, index) => (
            <MemberSlot key={index} goblin={goblin} isEmpty={!goblin} slotSize={slotSize} avatarSize={avatarSize} />
          ))}
        </View>
      </TouchableOpacity>

      {historyDisplays.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>遠征履歴</Text>
          <View style={styles.historyList}>
            {historyDisplays.map(item => (
              <View key={item.id} style={styles.historyRow}>
                <TouchableOpacity
                  style={styles.historyContent}
                  onPress={() => onHistoryPress(item.record, item.ongoing)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.historyText}>{item.title}</Text>
                  <Text style={styles.historyDungeon}>{item.subtitle}</Text>
                </TouchableOpacity>
                {!item.ongoing && (
                  <TouchableOpacity style={styles.historyArrow} onPress={() => onLogPress(item.record)}>
                    <Text style={styles.historyArrowText}>&gt;</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

export default function FormationScreen() {
  const { width } = useWindowDimensions()
  const { parties, isLoading: partiesLoading, createParty, refreshParties } = usePartyService()
  const { goblins, isLoading: goblinsLoading, refreshGoblins } = useGoblinService()
  const { rank, isLoading: baseLoading } = useBaseState()
  const {
    completeDueExpeditions,
    currentTime,
    partyHistories,
    partyHistoryDisplays,
    formatFullDateTimeWithSeconds,
  } = useExpeditionFlow({ refreshParties, parties, enableAutoCompletion: true })
  const { slotSize, avatarSize } = useMemo(() => {
    const slotGap = 8
    const maxSlotWidth = 50
    const minSlotWidth = 40
    const availableWidth = Math.max(0, width - 64)
    const singleRowSlotWidth = Math.floor((availableWidth - slotGap * (MAX_PARTY_SLOTS - 1)) / MAX_PARTY_SLOTS)
    const shouldWrap = singleRowSlotWidth < minSlotWidth
    const columns = shouldWrap ? 3 : MAX_PARTY_SLOTS
    const rawSlotSize = Math.floor((availableWidth - slotGap * (columns - 1)) / columns)
    const clampedSlotSize = Math.min(maxSlotWidth, rawSlotSize)
    const computedAvatarSize = Math.max(28, clampedSlotSize - 10)
    return { slotSize: clampedSlotSize, avatarSize: computedAvatarSize }
  }, [width])

  // 画面がフォーカスされたときにデータを再取得
  useFocusEffect(
    useCallback(() => {
      void refreshParties()
      refreshGoblins()
    }, [refreshParties, refreshGoblins])
  )

  // 初期パーティ枠を確保（最低3つ）
  const maxPartyCount = Math.max(1, rank)
  const displayParties = useMemo(() => {
    const sortedParties = [...parties].sort((a, b) => a.id - b.id).slice(0, maxPartyCount)
    const result: (Party | null)[] = [...sortedParties]
    while (result.length < maxPartyCount) {
      result.push(null)
    }
    return result
  }, [maxPartyCount, parties])


  const handlePartyPress = useCallback((party: Party | null, index: number) => {
    if (!party) {
      // パーティがない場合は新規作成して遷移
      const newParty = createParty({
        name: `PT${index + 1}`,
        memberIds: [],
      })
      router.push({
        pathname: '/formation/preparation',
        params: { partyId: newParty.id.toString() },
      })
      return
    }

    const status = party.status ?? 'idle'
    if (status === 'expedition') {
      const latestHistory = partyHistories[party.id]?.[0]
      if (latestHistory) {
        router.push({
          pathname: '/formation/playback',
          params: { expeditionId: latestHistory.id, partyId: party.id.toString() },
        })
      } else {
        router.push({
          pathname: '/formation/playback',
          params: { partyId: party.id.toString() },
        })
      }
    } else {
      // 待機中のパーティは遠征準備画面へ
      router.push({
        pathname: '/formation/preparation',
        params: { partyId: party.id.toString() },
      })
    }
  }, [createParty, partyHistories])

  const handleHistoryPress = useCallback((record: ExpeditionRecord, ongoing: boolean) => {
    if (ongoing) {
      router.push({
        pathname: '/formation/playback',
        params: { expeditionId: record.id, partyId: record.partyId.toString() },
      })
    } else {
      router.push({
        pathname: '/formation/result',
        params: { expeditionId: record.id, partyId: record.partyId.toString() },
      })
    }
  }, [])

  const handleLogPress = useCallback((record: ExpeditionRecord) => {
    router.push({
      pathname: '/formation/playback',
      params: { expeditionId: record.id, partyId: record.partyId.toString() },
    })
  }, [])

  if (partiesLoading || goblinsLoading || baseLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </SafeAreaView>
    )
  }

  const currentTimeLabel = formatFullDateTimeWithSeconds(currentTime)

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.prepTitle}>冒険の準備</Text>

        {displayParties.map((party, index) => {
          if (party) {
            return (
              <PartyCard
                key={party.id}
                party={party}
                goblins={goblins}
                onPress={() => handlePartyPress(party, index)}
                historyDisplays={partyHistoryDisplays[party.id] ?? []}
                onHistoryPress={handleHistoryPress}
                onLogPress={handleLogPress}
                slotSize={slotSize}
                avatarSize={avatarSize}
              />
            )
          } else {
            // 空のパーティ枠
            return (
              <TouchableOpacity
                key={`empty-${index}`}
                style={styles.partyCard}
                onPress={() => handlePartyPress(null, index)}
                activeOpacity={0.7}
              >
                <View style={styles.partyHeader}>
                  <Text style={styles.partyName}>PT{index + 1}</Text>
                </View>
                <View style={styles.membersRow}>
                  {Array.from({ length: MAX_PARTY_SLOTS }).map((_, slotIndex) => (
                    <MemberSlot key={slotIndex} isEmpty slotSize={slotSize} avatarSize={avatarSize} />
                  ))}
                </View>
              </TouchableOpacity>
            )
          }
        })}
      </ScrollView>

      <View style={styles.currentTimeBadge} pointerEvents="none">
        <Text style={styles.currentTimeText}>{currentTimeLabel}</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
  },
  prepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  partyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  currentTimeBadge: {
    position: 'absolute',
    left: 12,
    bottom: 8,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  currentTimeText: {
    fontSize: 11,
    color: '#F9FAFB',
  },
  historySection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  historyContent: {
    flex: 1,
  },
  historyText: {
    fontSize: 12,
    color: '#374151',
  },
  historyDungeon: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  historyArrow: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyArrowText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  partyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  partyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  expeditionBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expeditionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  membersRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberSlot: {
    alignItems: 'center',
    width: 50,
  },
  memberLevel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  memberHp: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  emptySlot: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginTop: 17, // memberLevel分の高さを確保
  },
  emptySlotText: {
    fontSize: 20,
    color: '#9CA3AF',
  },
})
