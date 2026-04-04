import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, useWindowDimensions, Modal, Pressable } from 'react-native'
import { router, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { useDungeonProgress } from '@/presentation/hooks/useDungeonProgress'
import { useExpeditionFlow } from '@/presentation/hooks/useExpeditionFlow'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import type { ExpeditionRequest, Goblin, Dungeon, Party } from '@/shared/types'

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

export default function ExpeditionPreparationScreen() {
  const { width } = useWindowDimensions()
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const {
    parties,
    isLoading: partiesLoading,
    getPartyById,
    setDungeon,
    setReturnPolicy,
    setTargetFloor,
    refreshParties,
  } = usePartyService()
  const { goblins, isLoading: goblinsLoading, refreshGoblins } = useGoblinService()
  const { dungeons, isLoading: dungeonsLoading } = useDungeonProgress()
  const { startExpedition, estimateExplorationTime } = useExpeditionFlow()
  const [retryCount, setRetryCount] = useState(0)
  const [party, setParty] = useState<Party | null>(null)

  useEffect(() => {
    if (!partyId) {
      setParty(null)
      return
    }
    void getPartyById(parseInt(partyId, 10)).then(p => setParty(p)).catch(() => setParty(null))
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
      void refreshGoblins()
    }, [refreshParties, refreshGoblins])
  )

  const [selectedDungeonId, setSelectedDungeonId] = useState<string | undefined>(party?.dungeonId)
  const [selectedReturnPolicy, setSelectedReturnPolicy] = useState<ReturnPolicy>(party?.returnPolicy ?? 'never')
  const [selectedTargetFloor, setSelectedTargetFloor] = useState<number | null>(party?.targetFloor ?? null)
  const [isDungeonModalVisible, setIsDungeonModalVisible] = useState(false)
  const [isReturnPolicyModalVisible, setIsReturnPolicyModalVisible] = useState(false)

  // partyが非同期取得された後にローカルstateを同期
  useEffect(() => {
    if (party) {
      setSelectedDungeonId(party.dungeonId)
      setSelectedReturnPolicy(party.returnPolicy ?? 'never')
      setSelectedTargetFloor(party.targetFloor ?? null)
    }
  }, [party])

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

  const estimatedExplorationTime = useMemo(() => {
    if (!selectedDungeon) return null
    return estimateExplorationTime(selectedDungeon, selectedReturnPolicy)
  }, [estimateExplorationTime, selectedDungeon, selectedReturnPolicy])

  const handleEditParty = useCallback(() => {
    router.push({
      pathname: '/formation/edit',
      params: { partyId },
    })
  }, [partyId])

  const handleSelectDungeon = useCallback((dungeon: Dungeon) => {
    setSelectedDungeonId(dungeon.id)
    if (partyId) {
      void setDungeon(parseInt(partyId, 10), dungeon.id)
    }
  }, [partyId, setDungeon])

  const handleSelectReturnPolicy = useCallback((policy: ReturnPolicy) => {
    setSelectedReturnPolicy(policy)
    if (partyId) {
      void setReturnPolicy(parseInt(partyId, 10), policy)
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

    if (!party || !selectedDungeon) {
      Alert.alert('ダンジョン情報が取得できません', 'ダンジョン情報の取得に失敗しました')
      return
    }

    const doStartExpedition = async () => {
      try {
        await startExpedition({
          party,
          dungeon: selectedDungeon,
          returnPolicy: selectedReturnPolicy,
        })

        router.replace('/formation')
      } catch (error) {
        console.error('[Preparation] Failed to start expedition', error)
        Alert.alert('遠征に失敗しました', '遠征開始時にエラーが発生しました')
      }
    }

    void doStartExpedition()
  }, [
    party,
    selectedDungeon,
    selectedDungeonId,
    selectedReturnPolicy,
    partyMembers.length,
    startExpedition,
  ])

  const canStartExpedition = selectedDungeonId && partyMembers.length > 0
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
                <MemberSlot key={index} goblin={goblin} isEmpty={!goblin} slotSize={slotSize} avatarSize={avatarSize} />
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
              <TouchableOpacity
                style={styles.settingValue}
                onPress={() => setIsDungeonModalVisible(true)}
                disabled={unlockedDungeons.length === 0}
              >
                {selectedDungeon ? (
                  <>
                    <Text style={styles.settingValueText}>{selectedDungeon.name}</Text>
                    <Text style={styles.settingValueDescription}>{selectedDungeon.description}</Text>
                  </>
                ) : (
                  <Text style={styles.settingValuePlaceholder}>遠征先が未設定です</Text>
                )}
              </TouchableOpacity>
            </View>

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
              <TouchableOpacity
                style={styles.settingValue}
                onPress={() => setIsReturnPolicyModalVisible(true)}
              >
                <Text style={styles.settingValueText}>
                  {RETURN_POLICIES.find(p => p.value === selectedReturnPolicy)?.label ?? '帰還しない'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 推定探索時間 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>推定探索時間</Text>
              <View style={styles.settingValue}>
                {estimatedExplorationTime !== null ? (
                  <Text style={styles.settingValueText}>{estimatedExplorationTime}秒</Text>
                ) : (
                  <Text style={styles.settingValuePlaceholder}>遠征先が未設定です</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={isDungeonModalVisible}
        animationType="fade"
        onRequestClose={() => setIsDungeonModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsDungeonModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>遠征先を選択</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {unlockedDungeons.length === 0 ? (
                <Text style={styles.modalEmptyText}>選択できるダンジョンがありません</Text>
              ) : (
                unlockedDungeons.map(dungeon => (
                  <TouchableOpacity
                    key={dungeon.id}
                    style={[
                      styles.modalOption,
                      selectedDungeonId === dungeon.id && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      handleSelectDungeon(dungeon)
                      setIsDungeonModalVisible(false)
                    }}
                  >
                    <Text style={[
                      styles.modalOptionTitle,
                      selectedDungeonId === dungeon.id && styles.modalOptionTitleSelected,
                    ]}>
                      {dungeon.name}
                    </Text>
                    <Text style={styles.modalOptionDescription}>{dungeon.description}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsDungeonModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isReturnPolicyModalVisible}
        animationType="fade"
        onRequestClose={() => setIsReturnPolicyModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsReturnPolicyModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>帰還条件を選択</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {RETURN_POLICIES.map(policy => (
                <TouchableOpacity
                  key={policy.value}
                  style={[
                    styles.modalOption,
                    selectedReturnPolicy === policy.value && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    handleSelectReturnPolicy(policy.value)
                    setIsReturnPolicyModalVisible(false)
                  }}
                >
                  <Text style={[
                    styles.modalOptionTitle,
                    selectedReturnPolicy === policy.value && styles.modalOptionTitleSelected,
                  ]}>
                    {policy.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsReturnPolicyModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
    flexWrap: 'wrap',
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
  settingValueDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  settingValuePlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  modalList: {
    marginBottom: 12,
  },
  modalListContent: {
    gap: 8,
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalOptionSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  modalOptionTitle: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 4,
  },
  modalOptionTitleSelected: {
    color: '#1D4ED8',
  },
  modalOptionDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalCloseButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
})
