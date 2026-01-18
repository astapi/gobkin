import { useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import type { Party, Goblin, PartyStatus } from '@/shared/types'

const MAX_PARTY_SLOTS = 6
const INITIAL_PARTY_COUNT = 3

interface MemberSlotProps {
  goblin?: Goblin
  isEmpty: boolean
}

function MemberSlot({ goblin, isEmpty }: MemberSlotProps) {
  if (isEmpty || !goblin) {
    return (
      <View style={styles.memberSlot}>
        <View style={styles.emptySlot}>
          <Text style={styles.emptySlotText}>+</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.memberSlot}>
      <Text style={styles.memberLevel}>Lv{goblin.level}</Text>
      <Image source={getGoblinImage(goblin.avatar)} style={styles.memberAvatar} />
      <Text style={styles.memberHp}>HP{goblin.stats.hp}</Text>
    </View>
  )
}

interface PartyCardProps {
  party: Party
  goblins: Goblin[]
  onPress: () => void
}

function PartyCard({ party, goblins, onPress }: PartyCardProps) {
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
    <TouchableOpacity style={styles.partyCard} onPress={onPress} activeOpacity={0.7}>
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
          <MemberSlot key={index} goblin={goblin} isEmpty={!goblin} />
        ))}
      </View>

      {/* 遠征履歴セクション（将来実装） */}
      {/* <View style={styles.historySection}>
        <Text style={styles.historyTitle}>遠征履歴</Text>
      </View> */}
    </TouchableOpacity>
  )
}

export default function FormationScreen() {
  const { parties, isLoading: partiesLoading, createParty, refreshParties } = usePartyService()
  const { goblins, isLoading: goblinsLoading, refreshGoblins } = useGoblinService()

  // 画面がフォーカスされたときにデータを再取得
  useFocusEffect(
    useCallback(() => {
      void refreshParties()
      refreshGoblins()
    }, [refreshParties, refreshGoblins])
  )

  // 初期パーティ枠を確保（最低3つ）
  const displayParties = useMemo(() => {
    const result: (Party | null)[] = [...parties]
    while (result.length < INITIAL_PARTY_COUNT) {
      result.push(null)
    }
    return result
  }, [parties])

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
      // 遠征中のパーティはプレイバック画面へ
      router.push({
        pathname: '/formation/playback',
        params: { partyId: party.id.toString() },
      })
    } else {
      // 待機中のパーティは遠征準備画面へ
      router.push({
        pathname: '/formation/preparation',
        params: { partyId: party.id.toString() },
      })
    }
  }, [createParty])

  if (partiesLoading || goblinsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.screenTitle}>パーティ選択</Text>

      {displayParties.map((party, index) => {
        if (party) {
          return (
            <PartyCard
              key={party.id}
              party={party}
              goblins={goblins}
              onPress={() => handlePartyPress(party, index)}
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
                  <MemberSlot key={slotIndex} isEmpty />
                ))}
              </View>
            </TouchableOpacity>
          )
        }
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  contentContainer: {
    padding: 16,
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
  partyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  partyName: {
    fontSize: 20,
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
})
