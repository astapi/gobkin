import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, useWindowDimensions, Modal, Pressable, TextInput } from 'react-native'
import { router, useLocalSearchParams, Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useBaseStore, selectRank } from '@/presentation/stores/useBaseStore'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { useExpeditionFlow } from '@/presentation/hooks/useExpeditionFlow'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import { normalizePartyRewardMultipliers } from '@/shared/types'
import type { ExpeditionRequest, Goblin, Dungeon, Party } from '@/shared/types'
import { getDungeonDescription, getDungeonName, getReturnPolicyLabel } from '@/shared/i18n/entityLocalization'

type ReturnPolicy = ExpeditionRequest['returnPolicy']

const MAX_PARTY_SLOTS = 6

function formatDungeonLabel(dungeon: Dungeon): string {
  if (dungeon.areaLevel === undefined) return getDungeonName(dungeon)
  return `${getDungeonName(dungeon)} / Area Lv.${dungeon.areaLevel}`
}

function formatMultiplier(value: number): string {
  return value.toFixed(1)
}

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
      <Image source={getGoblinDisplayImage(goblin)} style={[styles.memberAvatar, { width: avatarSize, height: avatarSize }]} />
      <Text style={styles.memberHp}>HP{stats.hp}</Text>
    </View>
  )
}

export default function ExpeditionPreparationScreen() {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const {
    parties,
    isLoading: partiesLoading,
    getPartyById,
    setDungeon,
    setReturnPolicy,
    setTargetFloor,
    updateName,
    refresh: refreshParties,
  } = usePartyStore()
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const pendingGoblins = useBaseStore((state) => state.pendingGoblins)
  const rank = useBaseStore(selectRank)
  const dungeons = useDungeonStore((state) => state.dungeons)
  const dungeonsLoading = useDungeonStore((state) => state.isLoading)
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

  const [selectedDungeonId, setSelectedDungeonId] = useState<string | undefined>(party?.dungeonId)
  const [selectedReturnPolicy, setSelectedReturnPolicy] = useState<ReturnPolicy>(party?.returnPolicy ?? 'never')
  const [selectedTargetFloor, setSelectedTargetFloor] = useState<number | null>(party?.targetFloor ?? null)
  const [isDungeonModalVisible, setIsDungeonModalVisible] = useState(false)
  const [isReturnPolicyModalVisible, setIsReturnPolicyModalVisible] = useState(false)
  const [isPartyNameModalVisible, setIsPartyNameModalVisible] = useState(false)
  const [editingPartyName, setEditingPartyName] = useState('')
  const [isSavingPartyName, setIsSavingPartyName] = useState(false)

  // partyが非同期取得された後にローカルstateを同期
  useEffect(() => {
    if (party) {
      setSelectedDungeonId(party.dungeonId)
      setSelectedReturnPolicy(party.returnPolicy ?? 'never')
      setSelectedTargetFloor(party.targetFloor ?? null)
      setEditingPartyName(party.name)
    }
  }, [party])

  const partyMembers = useMemo(() => {
    if (!party) return []
    return party.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }, [party, goblins])

  const partyRewardText = useMemo(() => {
    if (!party) return ''
    const multipliers = normalizePartyRewardMultipliers(party.rewardMultipliers)
    return t('ui.formation.preparation.rewardText', {
      gold: formatMultiplier(multipliers.gold),
      rare: formatMultiplier(multipliers.rare),
      title: formatMultiplier(multipliers.title),
    })
  }, [party, t])

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

  const handleOpenPartyInfo = useCallback(() => {
    router.push({
      pathname: '/formation/party-info',
      params: { partyId },
    })
  }, [partyId])

  const handleOpenEquipmentList = useCallback(() => {
    router.push({
      pathname: '/formation/equipment-list',
      params: { partyId },
    })
  }, [partyId])

  const handleOpenPartyNameModal = useCallback(() => {
    if (!party) return
    setEditingPartyName(party.name)
    setIsPartyNameModalVisible(true)
  }, [party])

  const handleSavePartyName = useCallback(async () => {
    if (!partyId) return

    const trimmedPartyName = editingPartyName.trim()
    if (!trimmedPartyName) {
      Alert.alert(t('ui.formation.preparation.nameRequiredTitle'), t('ui.formation.preparation.nameRequiredBody'))
      return
    }

    try {
      setIsSavingPartyName(true)
      await updateName(parseInt(partyId, 10), trimmedPartyName)
      setIsPartyNameModalVisible(false)
    } catch (error) {
      console.error('[Preparation] Failed to update party name', error)
      Alert.alert(t('ui.formation.preparation.renameFailedTitle'), t('ui.formation.preparation.renameFailedBody'))
    } finally {
      setIsSavingPartyName(false)
    }
  }, [editingPartyName, partyId, updateName])

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
      Alert.alert(t('ui.formation.preparation.dungeonRequiredTitle'), t('ui.formation.preparation.dungeonRequiredBody'))
      return
    }

    if (partyMembers.length === 0) {
      Alert.alert(t('ui.formation.preparation.noMembersTitle'), t('ui.formation.preparation.noMembersBody'))
      return
    }

    if (!party || !selectedDungeon) {
      Alert.alert(t('ui.formation.preparation.dungeonInfoMissingTitle'), t('ui.formation.preparation.dungeonInfoMissingBody'))
      return
    }

    const doStartExpedition = async () => {
      try {
        await startExpedition({
          party,
          dungeon: selectedDungeon,
          returnPolicy: selectedReturnPolicy,
        })

        router.dismissAll()
      } catch (error) {
        console.error('[Preparation] Failed to start expedition', error)
        Alert.alert(t('ui.formation.preparation.startFailedTitle'), t('ui.formation.preparation.startFailedBody'))
      }
    }

    const maxPendingGoblins = rank * 5
    if (pendingGoblins.length >= maxPendingGoblins) {
      Alert.alert(
        t('ui.formation.common.confirm'),
        t('ui.formation.preparation.pendingOverflowBody'),
        [
          { text: t('ui.common.cancel'), style: 'cancel' },
          { text: t('ui.formation.common.launch'), onPress: () => void doStartExpedition() },
        ],
      )
      return
    }

    void doStartExpedition()
  }, [
    pendingGoblins.length,
    party,
    rank,
    selectedDungeon,
    selectedDungeonId,
    selectedReturnPolicy,
    partyMembers.length,
    startExpedition,
    t,
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
        <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('ui.formation.common.partyNotFound')}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t('ui.formation.common.back')}</Text>
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
              <Text style={styles.headerButton}>← {t('ui.formation.common.back')}</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleStartExpedition}
              disabled={!canStartExpedition}
            >
              <Text style={[styles.headerButton, styles.headerButtonPrimary, !canStartExpedition && styles.headerButtonDisabled]}>
                {t('ui.formation.common.launch')}
              </Text>
            </TouchableOpacity>
          ),
          title: t('ui.formation.preparation.title'),
        }}
      />
      <ScrollView style={styles.container}>
        {/* パーティセクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.formation.preparation.sectionParty')}</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.partyInfoButton} onPress={handleOpenPartyInfo} activeOpacity={0.8}>
              <Text style={styles.partyName}>{party.name}</Text>
              <Text style={styles.partyRewardText}>{partyRewardText}</Text>

              <View style={styles.membersRow}>
                {slots.map((goblin, index) => (
                  <MemberSlot key={index} goblin={goblin} isEmpty={!goblin} slotSize={slotSize} avatarSize={avatarSize} />
                ))}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.editButton} onPress={handleEditParty}>
              <Text style={styles.editButtonText}>{t('ui.formation.preparation.editMembers')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenEquipmentList}>
              <Text style={styles.secondaryButtonText}>{t('ui.formation.preparation.equipmentList')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenPartyNameModal}>
              <Text style={styles.secondaryButtonText}>{t('ui.formation.preparation.renameParty')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 遠征セクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.formation.preparation.sectionExpedition')}</Text>
          <View style={styles.card}>
            {/* 遠征先 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('ui.formation.preparation.dungeon')}</Text>
              <TouchableOpacity
                style={styles.settingValue}
                onPress={() => setIsDungeonModalVisible(true)}
                disabled={unlockedDungeons.length === 0}
              >
                {selectedDungeon ? (
                  <>
                    <Text style={styles.settingValueText}>{formatDungeonLabel(selectedDungeon)}</Text>
                    <Text style={styles.settingValueDescription}>{getDungeonDescription(selectedDungeon)}</Text>
                  </>
                ) : (
                  <Text style={styles.settingValuePlaceholder}>{t('ui.formation.preparation.dungeonUnset')}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 目標階数 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('ui.formation.preparation.targetFloor')}</Text>
              <View style={styles.settingValue}>
                <Text style={styles.settingValueText}>
                  {selectedTargetFloor === null ? t('ui.formation.preparation.targetFloorDeepest') : t('ui.formation.preparation.targetFloorUntil', { floor: selectedTargetFloor })}
                </Text>
              </View>
            </View>

            {/* 帰還条件 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('ui.formation.preparation.returnPolicy')}</Text>
              <TouchableOpacity
                style={styles.settingValue}
                onPress={() => setIsReturnPolicyModalVisible(true)}
              >
                <Text style={styles.settingValueText}>
                  {getReturnPolicyLabel(selectedReturnPolicy)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 推定探索時間 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('ui.formation.preparation.estimatedTime')}</Text>
              <View style={styles.settingValue}>
                {estimatedExplorationTime !== null ? (
                  <Text style={styles.settingValueText}>{t('ui.formation.preparation.seconds', { value: estimatedExplorationTime })}</Text>
                ) : (
                  <Text style={styles.settingValuePlaceholder}>{t('ui.formation.preparation.dungeonUnset')}</Text>
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
            <Text style={styles.modalTitle}>{t('ui.formation.preparation.selectDungeonTitle')}</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {unlockedDungeons.length === 0 ? (
                <Text style={styles.modalEmptyText}>{t('ui.formation.preparation.noDungeon')}</Text>
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
                      {formatDungeonLabel(dungeon)}
                    </Text>
                    <Text style={styles.modalOptionDescription}>{getDungeonDescription(dungeon)}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsDungeonModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>{t('ui.formation.common.close')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isPartyNameModalVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!isSavingPartyName) {
            setIsPartyNameModalVisible(false)
          }
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!isSavingPartyName) {
              setIsPartyNameModalVisible(false)
            }
          }}
        >
          <Pressable style={styles.modalContent} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t('ui.formation.preparation.renameTitle')}</Text>
            <TextInput
              value={editingPartyName}
              onChangeText={setEditingPartyName}
              placeholder={t('ui.formation.preparation.renamePlaceholder')}
              maxLength={30}
              editable={!isSavingPartyName}
              style={styles.partyNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleSavePartyName()
              }}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={() => setIsPartyNameModalVisible(false)}
                disabled={isSavingPartyName}
              >
                <Text style={styles.modalCancelButtonText}>{t('ui.common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalPrimaryButton, isSavingPartyName && styles.modalPrimaryButtonDisabled]}
                onPress={() => void handleSavePartyName()}
                disabled={isSavingPartyName}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {isSavingPartyName ? t('ui.formation.common.saving') : t('ui.formation.common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
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
            <Text style={styles.modalTitle}>{t('ui.formation.preparation.selectReturnPolicyTitle')}</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {(['never', 'until_floor2', 'until_floor3', 'if_any_ko', 'last_one'] as ReturnPolicy[]).map(policy => (
                <TouchableOpacity
                  key={policy}
                  style={[
                    styles.modalOption,
                    selectedReturnPolicy === policy && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    handleSelectReturnPolicy(policy)
                    setIsReturnPolicyModalVisible(false)
                  }}
                >
                  <Text style={[
                    styles.modalOptionTitle,
                    selectedReturnPolicy === policy && styles.modalOptionTitleSelected,
                  ]}>
                    {getReturnPolicyLabel(policy)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsReturnPolicyModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>{t('ui.formation.common.close')}</Text>
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
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  partyInfoButton: {
    marginBottom: 4,
  },
  partyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  partyRewardText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  membersRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
    marginBottom: 10,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  secondaryButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
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
  partyNameInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E5E7EB',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  modalPrimaryButton: {
    backgroundColor: '#2563EB',
  },
  modalPrimaryButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  modalPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
