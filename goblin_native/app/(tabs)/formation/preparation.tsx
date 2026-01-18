import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native'
import { router, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { useDungeonProgress } from '@/presentation/hooks/useDungeonProgress'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import type { ExpeditionRequest, Goblin, Dungeon } from '@/shared/types'

type ReturnPolicy = ExpeditionRequest['returnPolicy']

const MAX_PARTY_SLOTS = 6

const RETURN_POLICIES: { value: ReturnPolicy; label: string }[] = [
  { value: 'never', label: '帰還しない' },
  { value: 'until_floor2', label: '2階で帰還' },
  { value: 'until_floor3', label: '3階で帰還' },
  { value: 'if_any_ko', label: '誰か倒れたら' },
  { value: 'last_one', label: '最後の1人まで' },
]

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

export default function ExpeditionPreparationScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const { parties, isLoading: partiesLoading, getPartyById, setDungeon, setReturnPolicy, setTargetFloor, refreshParties } = usePartyService()
  const { goblins, isLoading: goblinsLoading, refreshGoblins } = useGoblinService()
  const { dungeons, isLoading: dungeonsLoading } = useDungeonProgress()
  const [retryCount, setRetryCount] = useState(0)

  const party = useMemo(() => {
    if (!partyId) return null
    try {
      return getPartyById(parseInt(partyId, 10))
    } catch {
      return null
    }
  }, [partyId, parties, getPartyById])

  // パーティが見つからない場合にリトライ
  useEffect(() => {
    if (!party && !partiesLoading && partyId && retryCount < 5) {
      const timer = setTimeout(() => {
        void refreshParties()
        setRetryCount(prev => prev + 1)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [party, partiesLoading, partyId, retryCount, refreshParties])

  // 画面がフォーカスされたときにデータを再取得
  useFocusEffect(
    useCallback(() => {
      void refreshParties()
      refreshGoblins()
    }, [refreshParties, refreshGoblins])
  )

  const [selectedDungeonId, setSelectedDungeonId] = useState<string | undefined>(party?.dungeonId)
  const [selectedReturnPolicy, setSelectedReturnPolicy] = useState<ReturnPolicy>(party?.returnPolicy ?? 'never')
  const [selectedTargetFloor, setSelectedTargetFloor] = useState<number | null>(party?.targetFloor ?? null)

  const partyMembers = useMemo(() => {
    if (!party) return []
    return party.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }, [party, goblins])

  // 6スロット分の配列を作成
  const slots = useMemo(() => {
    const result: (Goblin | undefined)[] = []
    for (let i = 0; i < MAX_PARTY_SLOTS; i++) {
      result.push(partyMembers[i])
    }
    return result
  }, [partyMembers])

  const unlockedDungeons = useMemo(() => {
    return dungeons.filter(d => d.unlocked)
  }, [dungeons])

  const selectedDungeon = useMemo(() => {
    return dungeons.find(d => d.id === selectedDungeonId)
  }, [dungeons, selectedDungeonId])

  const handleEditParty = useCallback(() => {
    router.push({
      pathname: '/formation/edit',
      params: { partyId },
    })
  }, [partyId])

  const handleSelectDungeon = useCallback((dungeon: Dungeon) => {
    setSelectedDungeonId(dungeon.id)
    if (partyId) {
      setDungeon(parseInt(partyId, 10), dungeon.id)
    }
  }, [partyId, setDungeon])

  const handleSelectReturnPolicy = useCallback((policy: ReturnPolicy) => {
    setSelectedReturnPolicy(policy)
    if (partyId) {
      setReturnPolicy(parseInt(partyId, 10), policy)
    }
  }, [partyId, setReturnPolicy])

  const handleStartExpedition = useCallback(() => {
    if (!selectedDungeonId) {
      Alert.alert('ダンジョンを選択してください', '遠征先のダンジョンを選択する必要があります')
      return
    }

    if (partyMembers.length === 0) {
      Alert.alert('メンバーがいません', 'パーティにメンバーを追加してください')
      return
    }

    router.push({
      pathname: '/formation/playback',
      params: {
        partyId,
        dungeonId: selectedDungeonId,
        returnPolicy: selectedReturnPolicy,
      },
    })
  }, [partyId, selectedDungeonId, selectedReturnPolicy, partyMembers.length])

  const canStartExpedition = selectedDungeonId && partyMembers.length > 0

  // ローディング中またはパーティ取得のリトライ中
  if (partiesLoading || goblinsLoading || dungeonsLoading || (!party && retryCount < 5)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>パーティが見つかりません</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.headerButton}>← 戻る</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleStartExpedition}
              disabled={!canStartExpedition}
            >
              <Text style={[styles.headerButton, styles.headerButtonPrimary, !canStartExpedition && styles.headerButtonDisabled]}>
                出撃
              </Text>
            </TouchableOpacity>
          ),
          title: '冒険準備',
        }}
      />
      <ScrollView style={styles.container}>
        {/* パーティセクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>パーティ</Text>
          <View style={styles.card}>
            <Text style={styles.partyName}>{party.name}</Text>

            <View style={styles.membersRow}>
              {slots.map((goblin, index) => (
                <MemberSlot key={index} goblin={goblin} isEmpty={!goblin} />
              ))}
            </View>

            <TouchableOpacity style={styles.editButton} onPress={handleEditParty}>
              <Text style={styles.editButtonText}>メンバーを変更する</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 遠征セクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>遠征</Text>
          <View style={styles.card}>
            {/* 遠征先 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>遠征先</Text>
              <View style={styles.settingValue}>
                {selectedDungeon ? (
                  <Text style={styles.settingValueText}>{selectedDungeon.name}</Text>
                ) : (
                  <Text style={styles.settingValuePlaceholder}>遠征先が未設定です</Text>
                )}
              </View>
            </View>

            {/* ダンジョン選択リスト */}
            {unlockedDungeons.length > 0 && (
              <View style={styles.dungeonList}>
                {unlockedDungeons.map(dungeon => (
                  <TouchableOpacity
                    key={dungeon.id}
                    style={[
                      styles.dungeonOption,
                      selectedDungeonId === dungeon.id && styles.dungeonSelected,
                    ]}
                    onPress={() => handleSelectDungeon(dungeon)}
                  >
                    <Text style={[
                      styles.dungeonName,
                      selectedDungeonId === dungeon.id && styles.dungeonNameSelected,
                    ]}>
                      {dungeon.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 目標階数 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>目標階数</Text>
              <View style={styles.settingValue}>
                <Text style={styles.settingValueText}>
                  {selectedTargetFloor === null ? '最下層まで探索' : `${selectedTargetFloor}階まで`}
                </Text>
              </View>
            </View>

            {/* 帰還条件 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>帰還条件</Text>
              <View style={styles.settingValue}>
                <Text style={styles.settingValueText}>
                  {RETURN_POLICIES.find(p => p.value === selectedReturnPolicy)?.label ?? '帰還しない'}
                </Text>
              </View>
            </View>

            {/* 帰還条件選択リスト */}
            <View style={styles.policyList}>
              {RETURN_POLICIES.map(policy => (
                <TouchableOpacity
                  key={policy.value}
                  style={[
                    styles.policyOption,
                    selectedReturnPolicy === policy.value && styles.policySelected,
                  ]}
                  onPress={() => handleSelectReturnPolicy(policy.value)}
                >
                  <Text style={[
                    styles.policyName,
                    selectedReturnPolicy === policy.value && styles.policyNameSelected,
                  ]}>
                    {policy.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
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
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerButton: {
    fontSize: 16,
    color: '#374151',
    paddingHorizontal: 8,
  },
  headerButtonPrimary: {
    color: '#3B82F6',
    fontWeight: '600',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerButtonDisabled: {
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
    paddingBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  partyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  membersRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 16,
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
    marginTop: 17,
  },
  emptySlotText: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  editButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  settingItem: {
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  settingValue: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
  },
  settingValueText: {
    fontSize: 14,
    color: '#1F2937',
  },
  settingValuePlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  dungeonList: {
    marginBottom: 16,
  },
  dungeonOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dungeonSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  dungeonName: {
    fontSize: 14,
    color: '#374151',
  },
  dungeonNameSelected: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  policyList: {
    marginTop: 8,
  },
  policyOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  policySelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  policyName: {
    fontSize: 14,
    color: '#374151',
  },
  policyNameSelected: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
})
