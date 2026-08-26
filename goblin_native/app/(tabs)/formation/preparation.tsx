import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, useWindowDimensions, Modal, Pressable, TextInput, Switch } from 'react-native'
import { router, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { BOTTOM_INFO_SPACING } from '@/shared/constants/layout'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'
import { useTutorialTarget } from '@/presentation/hooks/useTutorialTarget'
import { useExpeditionFlow } from '@/presentation/hooks/useExpeditionFlow'
import { getGoldenAcornCount } from '@/presentation/stores/usePurchaseStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getPartyEffectiveStats } from '@/shared/utils/goblinStats'
import {
  getGoldBonusPercentFromSkills,
  getPartyRareMultiplierFromSkills,
  getPartyTitleMultiplierFromSkills,
} from '@/shared/data/characterSkills'
import { normalizePartyRewardMultipliers, DUNGEON_TIER_META, DUNGEON_TIER_SELECTABLE_MAX, getDungeonTierAreaLevel, getDungeonTierDisplayName } from '@/shared/types'
import type { ExpeditionRequest, Goblin, Dungeon, Party, DungeonTier } from '@/shared/types'
import { getDungeonDescription, getDungeonName, getReturnPolicyLabel } from '@/shared/i18n/entityLocalization'
import { isAutoExpeditionDungeonCleared } from '@/shared/utils/autoExpedition'

type ReturnPolicy = ExpeditionRequest['returnPolicy']

const MAX_PARTY_SLOTS = 6

function clampSelectableTier(tier: number | undefined): DungeonTier {
  return Math.min(Math.max(tier ?? 0, 0), DUNGEON_TIER_SELECTABLE_MAX) as DungeonTier
}

function formatDungeonLabel(dungeon: Dungeon, tier: DungeonTier = 0): string {
  if (dungeon.areaLevel === undefined) return getDungeonName(dungeon)
  return `${getDungeonName(dungeon)} / Area Lv.${getDungeonTierAreaLevel(dungeon.areaLevel, tier)}`
}

function formatMultiplier(value: number): string {
  return value.toFixed(1)
}

interface MemberSlotProps {
  goblin?: Goblin
  partyMembers: readonly Goblin[]
  isEmpty: boolean
  slotSize: number
  avatarSize: number
}

function MemberSlot({ goblin, partyMembers, isEmpty, slotSize, avatarSize }: MemberSlotProps) {
  if (isEmpty || !goblin) {
    return (
      <View style={[styles.memberSlot, { width: slotSize }]}>
        <View style={[styles.emptySlot, { width: avatarSize, height: avatarSize }]}>
          <Text style={styles.emptySlotText}>+</Text>
        </View>
      </View>
    )
  }

  const stats = getPartyEffectiveStats(goblin, partyMembers)
  const currentHp = goblin.currentHp ?? stats.hp
  const isInjured = currentHp === 0

  return (
    <View style={[styles.memberSlot, { width: slotSize }]}>
      <Text style={styles.memberLevel}>Lv{goblin.level}</Text>
      <Image
        source={getGoblinDisplayImage(goblin)}
        style={[
          styles.memberAvatar,
          { width: avatarSize, height: avatarSize },
          isInjured && styles.memberAvatarInjured,
        ]}
      />
      <Text style={[styles.memberHp, isInjured && styles.memberHpInjured]}>HP{currentHp}</Text>
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
    setDungeonTier,
    setReturnPolicy,
    setTargetFloor,
    updateName,
    setAutoExpedition,
    refresh: refreshParties,
  } = usePartyStore()
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const dungeons = useDungeonStore((state) => state.dungeons)
  const dungeonsLoading = useDungeonStore((state) => state.isLoading)
  const { startExpedition, estimateExplorationTime, getPartyExpeditionTimeMultiplier, isProcessing } = useExpeditionFlow()
  const [retryCount, setRetryCount] = useState(0)
  const [party, setParty] = useState<Party | null>(null)
  const [partyTimeMultiplier, setPartyTimeMultiplier] = useState(1)

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
  const [selectedTier, setSelectedTier] = useState<DungeonTier>(clampSelectableTier(party?.dungeonTier))
  const [selectedReturnPolicy, setSelectedReturnPolicy] = useState<ReturnPolicy>(party?.returnPolicy ?? 'never')
  const [selectedTargetFloor, setSelectedTargetFloor] = useState<number | null>(party?.targetFloor ?? null)
  const [isDungeonModalVisible, setIsDungeonModalVisible] = useState(false)
  const [isTargetFloorModalVisible, setIsTargetFloorModalVisible] = useState(false)
  const [isReturnPolicyModalVisible, setIsReturnPolicyModalVisible] = useState(false)
  const [isPartyNameModalVisible, setIsPartyNameModalVisible] = useState(false)
  const [editingPartyName, setEditingPartyName] = useState('')
  const [isSavingPartyName, setIsSavingPartyName] = useState(false)

  // partyが非同期取得された後にローカルstateを同期
  useEffect(() => {
    if (party) {
      setSelectedDungeonId(party.dungeonId)
      setSelectedTier(clampSelectableTier(party.dungeonTier))
      setSelectedReturnPolicy(party.returnPolicy ?? 'never')
      setSelectedTargetFloor(party.targetFloor ?? null)
      setEditingPartyName(party.name)
    }
  }, [party])

  const advanceTutorial = useTutorialStore((state) => state.advanceTo)

  // 直前ステップ (open_formation) のときだけ進める（飛ばし防止）。
  useFocusEffect(
    useCallback(() => {
      const current = useTutorialStore.getState().step
      if (current === 'open_formation') {
        void advanceTutorial('edit_party')
      }
    }, [advanceTutorial]),
  )

  const editPartyRef = useTutorialTarget<View>({
    activeOn: ['edit_party'],
    messageKey: 'ui.tutorial.banner.editParty',
    placement: 'above',
  })
  const selectDungeonRef = useTutorialTarget<View>({
    activeOn: ['select_dungeon'],
    messageKey: 'ui.tutorial.banner.selectDungeon',
    placement: 'below',
  })
  const launchButtonRef = useTutorialTarget<View>({
    activeOn: ['start_expedition'],
    messageKey: 'ui.tutorial.banner.startExpedition',
    placement: 'below',
  })

  useEffect(() => {
    if (!party) return
    if (party.memberIds.length > 0) {
      void advanceTutorial('select_dungeon')
    }
    if (party.memberIds.length > 0 && party.dungeonId === 'slime_cave') {
      void advanceTutorial('start_expedition')
    }
  }, [party, advanceTutorial])

  const partyMembers = useMemo(() => {
    if (!party) return []
    return party.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }, [party, goblins])

  const partyRewardText = useMemo(() => {
    if (!party) return ''
    const multipliers = normalizePartyRewardMultipliers(party.rewardMultipliers)
    // スキル由来のGoldボーナスは PT 内で1つのみ有効（最大値）
    const maxGoldBonusPercent = partyMembers.reduce(
      (max, member) => Math.max(max, getGoldBonusPercentFromSkills(member.skills)),
      0,
    )
    const skillRareMultiplier = partyMembers.reduce(
      (product, member) => product * getPartyRareMultiplierFromSkills(member.skills),
      1,
    )
    const skillTitleMultiplier = partyMembers.reduce(
      (product, member) => product * getPartyTitleMultiplierFromSkills(member.skills),
      1,
    )
    const goldMultiplier = multipliers.gold * (1 + maxGoldBonusPercent / 100)
    return t('ui.formation.preparation.rewardText', {
      gold: formatMultiplier(goldMultiplier),
      rare: formatMultiplier(multipliers.rare * skillRareMultiplier),
      title: formatMultiplier(multipliers.title * skillTitleMultiplier),
    })
  }, [party, partyMembers, t])

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

  // 実際の出撃と同じパーティのスキル由来時間倍率を推定時間へ反映する
  useEffect(() => {
    if (!party) {
      setPartyTimeMultiplier(1)
      return
    }
    let active = true
    void getPartyExpeditionTimeMultiplier(party)
      .then((multiplier) => {
        if (active) setPartyTimeMultiplier(multiplier)
      })
      .catch(() => {
        if (active) setPartyTimeMultiplier(1)
      })
    return () => {
      active = false
    }
  }, [party, getPartyExpeditionTimeMultiplier])

  const estimatedExplorationTime = useMemo(() => {
    if (!selectedDungeon) return null
    return estimateExplorationTime(selectedDungeon, selectedReturnPolicy, selectedTargetFloor, partyTimeMultiplier, false, selectedTier)
  }, [estimateExplorationTime, selectedDungeon, selectedReturnPolicy, selectedTargetFloor, partyTimeMultiplier, selectedTier])

  const autoExpeditionDuration = useMemo(() => {
    if (!selectedDungeon) return null
    return estimateExplorationTime(
      selectedDungeon,
      selectedReturnPolicy,
      selectedTargetFloor,
      partyTimeMultiplier,
      false,
      selectedTier,
      true,
    )
  }, [estimateExplorationTime, partyTimeMultiplier, selectedDungeon, selectedReturnPolicy, selectedTargetFloor, selectedTier])

  const canEnableAutoExpedition = isAutoExpeditionDungeonCleared(selectedDungeon, selectedTier) &&
    autoExpeditionDuration !== null &&
    autoExpeditionDuration > 0

  const handleToggleAutoExpedition = useCallback(async (enabled: boolean) => {
    if (!party) return
    if (enabled && !canEnableAutoExpedition) {
      Alert.alert(
        t('ui.formation.preparation.autoExpeditionUnavailableTitle'),
        t('ui.formation.preparation.autoExpeditionUnavailableBody'),
      )
      return
    }

    try {
      await setAutoExpedition(party.id, enabled)
    } catch (error) {
      console.error('[Preparation] Failed to update auto expedition', error)
      Alert.alert(
        t('ui.formation.preparation.autoExpeditionFailedTitle'),
        t('ui.formation.preparation.autoExpeditionFailedBody'),
      )
    }
  }, [canEnableAutoExpedition, party, setAutoExpedition, t])

  const handleEditParty = useCallback(() => {
    void advanceTutorial('select_party_member')
    router.push({
      pathname: '/formation/edit',
      params: { partyId },
    })
  }, [advanceTutorial, partyId])

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

  // 選択中ダンジョンの最大解放ティアを計算
  const maxUnlockedTier = useMemo((): DungeonTier => {
    if (!selectedDungeon) return 0
    const maxCleared = selectedDungeon.maxClearedTier ?? 0
    // maxClearedTier=1 → 通常クリア済み → 魔性(tier=1)まで解放
    // maxClearedTier=0 → 未クリア → 通常(tier=0)のみ
    return clampSelectableTier(maxCleared)
  }, [selectedDungeon])

  // ダンジョン変更時にティアをデフォルト選択（クリア済みの最高ティア）
  const autoSelectTier = useCallback((dungeon: Dungeon) => {
    const maxCleared = dungeon.maxClearedTier ?? 0
    // maxClearedTier は「次に解放されるティア番号」なので、クリア済み最高は -1
    const defaultTier = clampSelectableTier(maxCleared - 1)
    setSelectedTier(defaultTier)
    if (partyId) {
      void setDungeonTier(parseInt(partyId, 10), defaultTier)
    }
  }, [partyId, setDungeonTier])

  const handleSelectDungeon = useCallback((dungeon: Dungeon) => {
    setSelectedDungeonId(dungeon.id)
    if (partyId) {
      void setDungeon(parseInt(partyId, 10), dungeon.id)
    }
    if (selectedTargetFloor !== null && selectedTargetFloor > dungeon.floors) {
      setSelectedTargetFloor(null)
      if (partyId) {
        void setTargetFloor(parseInt(partyId, 10), null)
      }
    }
    autoSelectTier(dungeon)
  }, [partyId, selectedTargetFloor, setDungeon, setTargetFloor, autoSelectTier])

  const handleSelectTier = useCallback((tier: DungeonTier) => {
    const selectableTier = clampSelectableTier(tier)
    setSelectedTier(selectableTier)
    if (partyId) {
      void setDungeonTier(parseInt(partyId, 10), selectableTier)
    }
  }, [partyId, setDungeonTier])

  const handleSelectReturnPolicy = useCallback((policy: ReturnPolicy) => {
    setSelectedReturnPolicy(policy)
    if (partyId) {
      void setReturnPolicy(parseInt(partyId, 10), policy)
    }
  }, [partyId, setReturnPolicy])

  const handleSelectTargetFloor = useCallback((floor: number | null) => {
    setSelectedTargetFloor(floor)
    if (partyId) {
      void setTargetFloor(parseInt(partyId, 10), floor)
    }
  }, [partyId, setTargetFloor])

  const handleStartExpedition = useCallback(() => {
    // 出撃処理中の二重タップで遠征レコードが二重生成されるのを防ぐ
    if (isProcessing) return
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

    const doStartExpedition = async (useGoldenAcorn: boolean) => {
      try {
        await startExpedition({
          party,
          dungeon: selectedDungeon,
          returnPolicy: selectedReturnPolicy,
          targetFloor: selectedTargetFloor,
          tier: selectedTier,
          useGoldenAcorn,
        })

        router.dismissAll()
      } catch (error) {
        console.error('[Preparation] Failed to start expedition', error)
        Alert.alert(t('ui.formation.preparation.startFailedTitle'), t('ui.formation.preparation.startFailedBody'))
      }
    }

    const promptGoldenAcornDetails = () => {
      const acornCount = getGoldenAcornCount()
      Alert.alert(
        t('ui.formation.preparation.goldenAcornPromptTitle'),
        t('ui.formation.preparation.goldenAcornPromptBody', { count: acornCount }),
        [
          { text: t('ui.common.cancel'), style: 'cancel' },
          { text: t('ui.formation.preparation.goldenAcornUseAndStart'), onPress: () => void doStartExpedition(true) },
        ],
      )
    }

    const showLaunchConfirmation = () => {
      const dungeonLabel = getDungeonTierDisplayName(
        formatDungeonLabel(selectedDungeon, selectedTier),
        selectedTier,
      )
      const targetText = selectedTargetFloor === null
        ? t('ui.formation.preparation.launchConfirmTargetDeepest')
        : t('ui.formation.preparation.launchConfirmTargetUntil', { floor: selectedTargetFloor })
      const returnPolicyText = getReturnPolicyLabel(selectedReturnPolicy)
      const totalSeconds = estimatedExplorationTime ?? 0
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      const explorationTimeText = t('ui.formation.preparation.launchConfirmDurationFormat', {
        hours,
        minutes,
        seconds,
      })
      const body = t('ui.formation.preparation.launchConfirmBody', {
        target: targetText,
        returnPolicy: returnPolicyText,
        explorationTime: explorationTimeText,
      })

      const acornCount = getGoldenAcornCount()
      const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
        { text: t('ui.formation.common.launch'), onPress: () => void doStartExpedition(false) },
      ]
      if (acornCount > 0) {
        buttons.push({
          text: t('ui.formation.preparation.launchConfirmGoldenAcornButton'),
          onPress: promptGoldenAcornDetails,
        })
      }
      buttons.push({ text: t('ui.common.cancel'), style: 'cancel' })

      Alert.alert(dungeonLabel, body, buttons)
    }

    showLaunchConfirmation()
  }, [
    estimatedExplorationTime,
    isProcessing,
    party,
    selectedDungeon,
    selectedDungeonId,
    selectedReturnPolicy,
    selectedTargetFloor,
    selectedTier,
    partyMembers.length,
    startExpedition,
    t,
  ])

  const canStartExpedition = Boolean(selectedDungeonId) &&
    partyMembers.length > 0 &&
    !isProcessing &&
    (party?.status ?? 'idle') === 'idle'
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
            <View ref={launchButtonRef} collapsable={false}>
              <TouchableOpacity
                onPress={handleStartExpedition}
                disabled={!canStartExpedition}
              >
                <Text style={[styles.headerButton, styles.headerButtonPrimary, !canStartExpedition && styles.headerButtonDisabled]}>
                  {t('ui.formation.common.launch')}
                </Text>
              </TouchableOpacity>
            </View>
          ),
          title: t('ui.formation.preparation.title'),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: BOTTOM_INFO_SPACING }}>
        {/* パーティセクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.formation.preparation.sectionParty')}</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.partyInfoButton} onPress={handleOpenPartyInfo} activeOpacity={0.8}>
              <Text style={styles.partyName}>{party.name}</Text>
              <Text style={styles.partyRewardText}>{partyRewardText}</Text>

              <View style={styles.membersRow}>
                {slots.map((goblin, index) => (
                  <MemberSlot key={index} goblin={goblin} partyMembers={partyMembers} isEmpty={!goblin} slotSize={slotSize} avatarSize={avatarSize} />
                ))}
              </View>
            </TouchableOpacity>

            <View ref={editPartyRef} collapsable={false}>
              <TouchableOpacity style={styles.editButton} onPress={handleEditParty}>
                <Text style={styles.editButtonText}>{t('ui.formation.preparation.editMembers')}</Text>
              </TouchableOpacity>
            </View>

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
            <View style={styles.settingItem} ref={selectDungeonRef} collapsable={false}>
              <Text style={styles.settingLabel}>{t('ui.formation.preparation.dungeon')}</Text>
              <TouchableOpacity
                style={styles.settingValue}
                onPress={() => setIsDungeonModalVisible(true)}
                disabled={unlockedDungeons.length === 0}
              >
                {selectedDungeon ? (
                  <>
                    <Text style={styles.settingValueText}>
                      {getDungeonTierDisplayName(formatDungeonLabel(selectedDungeon, selectedTier), selectedTier)}
                    </Text>
                    <Text style={styles.settingValueDescription}>{getDungeonDescription(selectedDungeon)}</Text>
                  </>
                ) : (
                  <Text style={styles.settingValuePlaceholder}>{t('ui.formation.preparation.dungeonUnset')}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* ティア（称号） */}
            {selectedDungeon && (
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>{t('ui.formation.preparation.dungeonTier')}</Text>
                <View style={styles.tierSelector}>
                  {DUNGEON_TIER_META.map((meta) => {
                    const isUnlocked = meta.tier <= maxUnlockedTier
                    const isSelected = selectedTier === meta.tier
                    return (
                      <TouchableOpacity
                        key={meta.tier}
                        style={[
                          styles.tierButton,
                          isSelected && styles.tierButtonSelected,
                          !isUnlocked && styles.tierButtonLocked,
                        ]}
                        onPress={() => isUnlocked && handleSelectTier(meta.tier as DungeonTier)}
                        disabled={!isUnlocked}
                      >
                        <Text style={[
                          styles.tierButtonText,
                          isSelected && styles.tierButtonTextSelected,
                          !isUnlocked && styles.tierButtonTextLocked,
                        ]}>
                          {t(meta.labelKey)}
                        </Text>
                        {!isUnlocked && <Text style={styles.tierLockIcon}>🔒</Text>}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* 目標階数 */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('ui.formation.preparation.targetFloor')}</Text>
              <TouchableOpacity
                style={styles.settingValue}
                onPress={() => setIsTargetFloorModalVisible(true)}
                disabled={!selectedDungeon}
              >
                <Text style={styles.settingValueText}>
                  {selectedTargetFloor === null ? t('ui.formation.preparation.targetFloorDeepest') : t('ui.formation.preparation.targetFloorUntil', { floor: selectedTargetFloor })}
                </Text>
              </TouchableOpacity>
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

            {/* 自動周回 */}
            <View style={styles.autoExpeditionRow}>
              <View style={styles.autoExpeditionText}>
                <Text style={styles.settingLabel}>{t('ui.formation.preparation.autoExpedition')}</Text>
                {canEnableAutoExpedition ? (
                  <>
                    <Text style={styles.settingValueDescription}>
                      {t('ui.formation.preparation.autoExpeditionDescription')}
                    </Text>
                    <Text style={styles.autoExpeditionLimitText}>
                      {t('ui.formation.preparation.autoExpeditionDayBoundary')}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.settingValueDescription}>
                    {t('ui.formation.preparation.autoExpeditionLocked')}
                  </Text>
                )}
              </View>
              <Switch
                testID="auto-expedition-switch"
                accessibilityLabel={t('ui.formation.preparation.autoExpedition')}
                value={party.autoExpeditionEnabled === true}
                onValueChange={(enabled) => void handleToggleAutoExpedition(enabled)}
                disabled={!canEnableAutoExpedition && party.autoExpeditionEnabled !== true}
                trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                thumbColor={party.autoExpeditionEnabled ? '#16A34A' : '#F9FAFB'}
              />
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
        visible={isTargetFloorModalVisible}
        animationType="fade"
        onRequestClose={() => setIsTargetFloorModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsTargetFloorModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('ui.formation.preparation.selectTargetFloorTitle')}</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  selectedTargetFloor === null && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  handleSelectTargetFloor(null)
                  setIsTargetFloorModalVisible(false)
                }}
              >
                <Text style={[
                  styles.modalOptionTitle,
                  selectedTargetFloor === null && styles.modalOptionTitleSelected,
                ]}>
                  {t('ui.formation.preparation.targetFloorDeepest')}
                </Text>
              </TouchableOpacity>
              {selectedDungeon ? Array.from({ length: selectedDungeon.floors }, (_, index) => index + 1).map(floor => (
                <TouchableOpacity
                  key={floor}
                  style={[
                    styles.modalOption,
                    selectedTargetFloor === floor && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    handleSelectTargetFloor(floor)
                    setIsTargetFloorModalVisible(false)
                  }}
                >
                  <Text style={[
                    styles.modalOptionTitle,
                    selectedTargetFloor === floor && styles.modalOptionTitleSelected,
                  ]}>
                    {t('ui.formation.preparation.targetFloorUntil', { floor })}
                  </Text>
                </TouchableOpacity>
              )) : null}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsTargetFloorModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>{t('ui.formation.common.close')}</Text>
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
            <Text style={styles.modalTitle}>{t('ui.formation.preparation.selectReturnPolicyTitle')}</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {(['if_any_ko', 'if_two_ko', 'last_one', 'never'] as ReturnPolicy[]).map(policy => (
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
  memberAvatarInjured: {
    opacity: 0.45,
  },
  memberHp: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  memberHpInjured: {
    color: '#9CA3AF',
    fontWeight: '700',
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
  tierSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  tierButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tierButtonSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  tierButtonLocked: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.5,
  },
  tierButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  tierButtonTextSelected: {
    color: '#1D4ED8',
  },
  tierButtonTextLocked: {
    color: '#9CA3AF',
  },
  tierLockIcon: {
    fontSize: 10,
    marginTop: 2,
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
  autoExpeditionLimitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4,
  },
  settingValuePlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  autoExpeditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  autoExpeditionText: {
    flex: 1,
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
