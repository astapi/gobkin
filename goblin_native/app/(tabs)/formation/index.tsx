import { memo, useMemo, useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useExpeditionStore } from '@/presentation/stores/useExpeditionStore'
import { BOTTOM_INFO_SPACING } from '@/shared/constants/layout'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useExpeditionFlow, type ExpeditionHistoryDisplay } from '@/presentation/hooks/useExpeditionFlow'
import { getGoldenAcornCount } from '@/presentation/stores/usePurchaseStore'
import { useCurrentTime } from '@/presentation/hooks/useCurrentTime'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'
import { useTutorialTarget } from '@/presentation/hooks/useTutorialTarget'
import { selectRank, useBaseStore } from '@/presentation/stores/useBaseStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getPartyEffectiveStats } from '@/shared/utils/goblinStats'
import {
  getGoldBonusPercentFromSkills,
  getPartyRareMultiplierFromSkills,
  getPartyTitleMultiplierFromSkills,
} from '@/shared/data/characterSkills'
import { normalizePartyRewardMultipliers } from '@/shared/types'
import { isAutoExpeditionStopPending } from '@/shared/utils/autoExpedition'
import type { Party, Goblin, Dungeon, DungeonTier, ExpeditionRequest, ExpeditionRecord } from '@/shared/types'

const MAX_PARTY_SLOTS = 6

function formatMultiplier(value: number): string {
  return value.toFixed(1)
}

function isGoldenAcornExpedition(record?: ExpeditionRecord): boolean {
  return record?.expeditionMeta?.expeditionBoost?.goldenAcornUsed === true
}

interface MemberSlotProps {
  goblin?: Goblin
  partyMembers: readonly Goblin[]
  isEmpty: boolean
  slotSize: number
  avatarSize: number
}

const MemberSlot = memo(function MemberSlot({ goblin, partyMembers, isEmpty, slotSize, avatarSize }: MemberSlotProps) {
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
})

interface PartyCardProps {
  party: Party
  index: number
  goblins: Goblin[]
  onPress: (party: Party, index: number) => void
  onAbort: (party: Party) => void
  onStopAuto: (party: Party) => void
  onAutoSummaryPress: (party: Party) => void
  historyDisplays: ExpeditionHistoryDisplay[]
  onHistoryPress: (record: ExpeditionRecord, ongoing: boolean) => void
  onLogPress: (record: ExpeditionRecord) => void
  slotSize: number
  avatarSize: number
  usedGoldenAcorn: boolean
  isCatchingUp: boolean
}

const PartyCard = memo(function PartyCard({
  party,
  index,
  goblins,
  onPress,
  onAbort,
  onStopAuto,
  onAutoSummaryPress,
  historyDisplays,
  onHistoryPress,
  onLogPress,
  slotSize,
  avatarSize,
  usedGoldenAcorn,
  isCatchingUp,
}: PartyCardProps) {
  const { t } = useTranslation()
  const members = useMemo(() => {
    return party.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }, [party.memberIds, goblins])

  const partyRewardText = useMemo(() => {
    const multipliers = normalizePartyRewardMultipliers(party.rewardMultipliers)
    // スキル由来のGoldボーナスは PT 内で1つのみ有効（最大値）
    const maxGoldBonusPercent = members.reduce(
      (max, member) => Math.max(max, getGoldBonusPercentFromSkills(member.skills)),
      0,
    )
    const skillRareMultiplier = members.reduce(
      (product, member) => product * getPartyRareMultiplierFromSkills(member.skills),
      1,
    )
    const skillTitleMultiplier = members.reduce(
      (product, member) => product * getPartyTitleMultiplierFromSkills(member.skills),
      1,
    )
    const goldMultiplier = multipliers.gold * (1 + maxGoldBonusPercent / 100)
    return t('ui.formation.index.rewardText', {
      gold: formatMultiplier(goldMultiplier),
      rare: formatMultiplier(multipliers.rare * skillRareMultiplier),
      title: formatMultiplier(multipliers.title * skillTitleMultiplier),
    })
  }, [party.rewardMultipliers, members, t])

  // 6スロット分の配列を作成
  const slots = useMemo(() => {
    const result: (Goblin | undefined)[] = []
    for (let i = 0; i < MAX_PARTY_SLOTS; i++) {
      result.push(members[i])
    }
    return result
  }, [members])

  const status = party.status ?? 'idle'
  const ongoingExpedition = historyDisplays.find(item => item.record.status === 'ongoing')?.record
  const isStoppingAutoExpedition = isAutoExpeditionStopPending(party, ongoingExpedition)
  return (
    <View style={[styles.partyCard, status === 'expedition' && usedGoldenAcorn && styles.partyCardGoldenAcorn]}>
      <TouchableOpacity
        testID={`party-card-${party.id}`}
        onPress={() => onPress(party, index)}
        disabled={isCatchingUp}
        activeOpacity={0.7}
      >
        <View style={styles.partyHeader}>
          <Text style={styles.partyName}>{party.name}</Text>
          <View style={styles.partyHeaderActions}>
            {isCatchingUp ? (
              <View style={styles.autoExpeditionCatchingUpBadge}>
                <Text style={styles.autoExpeditionCatchingUpBadgeText}>
                  {t('ui.formation.index.autoExpeditionCatchingUp')}
                </Text>
              </View>
            ) : party.autoExpeditionEnabled ? (
              <TouchableOpacity
                testID={`auto-expedition-badge-${party.id}`}
                style={status === 'expedition'
                  ? styles.autoExpeditionBadge
                  : styles.autoExpeditionWaitingBadge}
                onPress={(event) => {
                  event.stopPropagation()
                  onStopAuto(party)
                }}
                activeOpacity={0.7}
              >
                <Text style={status === 'expedition'
                  ? styles.autoExpeditionBadgeText
                  : styles.autoExpeditionWaitingBadgeText}
                >
                  {t(status === 'expedition'
                    ? 'ui.formation.index.autoExpeditionRunning'
                    : 'ui.formation.index.autoExpeditionWaiting')}
                </Text>
              </TouchableOpacity>
            ) : null}
            {!isCatchingUp && isStoppingAutoExpedition ? (
              <View style={styles.autoExpeditionPendingBadge}>
                <Text style={styles.autoExpeditionPendingBadgeText}>
                  {t('ui.formation.index.autoExpeditionStopPending')}
                </Text>
              </View>
            ) : null}
            {!isCatchingUp && !party.autoExpeditionEnabled && party.autoExpeditionSessionId && status === 'idle' && (
              <TouchableOpacity
                testID={`auto-expedition-summary-${party.id}`}
                style={styles.autoExpeditionSummaryBadge}
                onPress={(event) => {
                  event.stopPropagation()
                  onAutoSummaryPress(party)
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.autoExpeditionSummaryBadgeText}>
                  {t('ui.formation.index.autoExpeditionSummary')}
                </Text>
              </TouchableOpacity>
            )}
            {!isCatchingUp && status === 'expedition' && (
              <TouchableOpacity
                style={styles.expeditionBadge}
                onPress={(event) => {
                  event.stopPropagation()
                  onAbort(party)
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.expeditionBadgeText}>{t('ui.formation.index.abortButton')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.partyRewardText}>{partyRewardText}</Text>

        <View style={styles.membersRow}>
          {slots.map((goblin, index) => (
            <MemberSlot key={index} goblin={goblin} partyMembers={members} isEmpty={!goblin} slotSize={slotSize} avatarSize={avatarSize} />
          ))}
        </View>
      </TouchableOpacity>

      {historyDisplays.length > 0 && (
        <View style={styles.historySection}>
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
})

export default function FormationScreen() {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const advanceTutorial = useTutorialStore((state) => state.advanceTo)
  const parties = usePartyStore((state) => state.parties)
  const partiesLoading = usePartyStore((state) => state.isLoading)
  const catchUpPartyIds = useExpeditionStore((state) => state.catchUpPartyIds)
  const createParty = usePartyStore((state) => state.createParty)
  const setAutoExpedition = usePartyStore((state) => state.setAutoExpedition)
  const acknowledgeAutoExpeditionSummary = usePartyStore((state) => state.acknowledgeAutoExpeditionSummary)
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const dungeons = useDungeonStore((state) => state.dungeons)
  const dungeonsLoading = useDungeonStore((state) => state.isLoading)
  const baseLoading = useBaseStore((state) => state.isLoading)
  const rank = useBaseStore(selectRank)
  const currentTime = useCurrentTime({ enabled: true })
  const {
    partyHistories,
    partyHistoryDisplays,
    startExpedition,
    startBulkExpedition,
    abortExpedition,
  } = useExpeditionFlow({ parties, currentTime })
  const [isBulkLaunching, setIsBulkLaunching] = useState(false)
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

  // 直前ステップ (view_first_goblin) のときだけ進める（飛ばし防止）。
  useFocusEffect(
    useCallback(() => {
      const current = useTutorialStore.getState().step
      if (current === 'view_first_goblin') {
        void advanceTutorial('open_formation')
      }
    }, [advanceTutorial]),
  )

  const pt1Ref = useTutorialTarget<View>({
    activeOn: ['open_formation', 'edit_party'],
    messageKey: 'ui.tutorial.banner.openFormation',
    placement: 'auto',
  })

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


  const isCreatingPartyRef = useRef(false)

  const handlePartyPress = useCallback(async (party: Party | null, index: number) => {
    void advanceTutorial('edit_party')
    if (!party) {
      // 連打で空パーティが二重生成されるのを防ぐ
      if (isCreatingPartyRef.current) return
      isCreatingPartyRef.current = true
      try {
        // パーティがない場合は新規作成して遷移
        const newParty = await createParty({
          name: t('ui.formation.index.partyDefaultName', { index: index + 1 }),
          memberIds: [],
        })
        router.push({
          pathname: '/formation/preparation',
          params: { partyId: newParty.id.toString() },
        })
      } finally {
        isCreatingPartyRef.current = false
      }
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
  }, [createParty, partyHistories, t])

  const handleAbort = useCallback((party: Party) => {
    const latestHistory = partyHistories[party.id]?.[0]
    if (!latestHistory || latestHistory.status !== 'ongoing') return

    Alert.alert(
      t('ui.formation.index.abortConfirmTitle'),
      t('ui.formation.index.abortConfirmBody'),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.formation.index.abortConfirmOk'),
          style: 'destructive',
          onPress: () => void abortExpedition(latestHistory),
        },
      ],
    )
  }, [abortExpedition, partyHistories, t])

  const handleStopAuto = useCallback((party: Party) => {
    Alert.alert(
      t('ui.formation.index.stopAutoExpeditionTitle'),
      t('ui.formation.index.stopAutoExpeditionBody'),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.formation.index.stopAutoExpeditionAction'),
          onPress: () => void setAutoExpedition(party.id, false),
        },
      ],
    )
  }, [setAutoExpedition, t])

  const handleAutoSummaryPress = useCallback((party: Party) => {
    router.push({
      pathname: '/formation/auto-summary',
      params: { partyId: party.id.toString() },
    })
    void acknowledgeAutoExpeditionSummary(party.id).catch(error => {
      console.error('[Formation] Failed to acknowledge auto expedition summary', error)
    })
  }, [acknowledgeAutoExpeditionSummary])

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

  const handleBulkLaunch = useCallback(() => {
    const skippedReasons: string[] = []
    const inputs: Array<{ party: Party; dungeon: Dungeon; returnPolicy: ExpeditionRequest['returnPolicy']; targetFloor?: number | null; tier: DungeonTier }> = []

    for (const party of parties) {
      if ((party.status ?? 'idle') === 'expedition') {
        skippedReasons.push(`${party.name}: ${t('ui.formation.index.reasonExpedition')}`)
        continue
      }
      if (party.memberIds.length === 0) {
        skippedReasons.push(`${party.name}: ${t('ui.formation.index.reasonNoMembers')}`)
        continue
      }
      if (!party.dungeonId) {
        skippedReasons.push(`${party.name}: ${t('ui.formation.index.reasonNoDungeon')}`)
        continue
      }
      const dungeon = dungeons.find((item) => item.id === party.dungeonId)
      if (!dungeon || !dungeon.unlocked) {
        skippedReasons.push(`${party.name}: ${t('ui.formation.index.reasonCannotLaunch')}`)
        continue
      }
      inputs.push({
        party,
        dungeon,
        returnPolicy: party.returnPolicy ?? 'never',
        targetFloor: party.targetFloor ?? null,
        tier: party.dungeonTier ?? 0,
      })
    }

    const doBulkLaunch = async (useGoldenAcorn: boolean) => {
      setIsBulkLaunching(true)
      try {
        const inputsWithFlag = inputs.map((input) => ({ ...input, useGoldenAcorn }))
        const result = await startBulkExpedition(inputsWithFlag)
        const allSkipped = [...skippedReasons, ...result.skippedReasons]

        if (result.startedCount === 0) {
          Alert.alert(t('ui.formation.index.bulkCannotTitle'), allSkipped.join('\n') || t('ui.formation.index.bulkNoLaunchable'))
          return
        }

        const message = allSkipped.length > 0
          ? t('ui.formation.index.bulkStartedWithSkipped', { count: result.startedCount, reasons: allSkipped.join('\n') })
          : t('ui.formation.index.bulkStarted', { count: result.startedCount })

        Alert.alert(t('ui.formation.index.bulkLaunch'), message)
      } finally {
        setIsBulkLaunching(false)
      }
    }

    if (inputs.length === 0) {
      Alert.alert(t('ui.formation.index.bulkCannotTitle'), skippedReasons.join('\n') || t('ui.formation.index.bulkNoLaunchable'))
      return
    }

    const promptGoldenAcornBulkDetails = () => {
      const acornCount = getGoldenAcornCount()
      Alert.alert(
        t('ui.formation.index.goldenAcornBulkPromptTitle'),
        t('ui.formation.index.goldenAcornBulkPromptBody', {
          count: inputs.length,
          remaining: acornCount,
        }),
        [
          { text: t('ui.common.cancel'), style: 'cancel' },
          { text: t('ui.formation.index.goldenAcornBulkUseAndStart'), onPress: () => void doBulkLaunch(true) },
        ],
      )
    }

    const showBulkLaunchConfirmation = () => {
      const names = inputs.map((input) => input.party.name).join('\n')
      const body = t('ui.formation.index.bulkLaunchConfirmBody', { names })
      const acornCount = getGoldenAcornCount()
      const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
        { text: t('ui.formation.common.launch'), onPress: () => void doBulkLaunch(false) },
      ]
      if (acornCount >= inputs.length) {
        buttons.push({
          text: t('ui.formation.index.bulkLaunchGoldenAcornButton'),
          onPress: promptGoldenAcornBulkDetails,
        })
      }
      buttons.push({ text: t('ui.common.cancel'), style: 'cancel' })

      Alert.alert(t('ui.formation.index.bulkLaunchConfirmTitle'), body, buttons)
    }

    showBulkLaunchConfirmation()
  }, [dungeons, parties, startBulkExpedition, t])

  const canBulkLaunch = useMemo(() => {
    return parties.some((party) => {
      if ((party.status ?? 'idle') === 'expedition') return false
      if (party.memberIds.length === 0) return false
      if (!party.dungeonId) return false
      const dungeon = dungeons.find((item) => item.id === party.dungeonId)
      return Boolean(dungeon?.unlocked)
    })
  }, [dungeons, parties])

  const showSinglePartyTutorial = maxPartyCount === 1

  // Rules of Hooks 遵守のため、フック定義はローディングによる early return より前に置く
  const renderPartyItem = useCallback(({ item, index }: { item: Party | null; index: number }) => {
    const wrapperRef = index === 0 ? pt1Ref : undefined
    if (item) {
      const latestHistory = partyHistories[item.id]?.[0]
      const usedGoldenAcorn = (item.status ?? 'idle') === 'expedition' && isGoldenAcornExpedition(latestHistory)
      return (
        <View ref={wrapperRef} collapsable={false}>
          <PartyCard
            party={item}
            index={index}
            goblins={goblins}
            onPress={handlePartyPress}
            onAbort={handleAbort}
            onStopAuto={handleStopAuto}
            onAutoSummaryPress={handleAutoSummaryPress}
            historyDisplays={partyHistoryDisplays[item.id] ?? []}
            onHistoryPress={handleHistoryPress}
            onLogPress={handleLogPress}
            slotSize={slotSize}
            avatarSize={avatarSize}
            usedGoldenAcorn={usedGoldenAcorn}
            isCatchingUp={catchUpPartyIds.includes(item.id)}
          />
        </View>
      )
    }

    return (
      <View ref={wrapperRef} collapsable={false}>
        <TouchableOpacity
          style={styles.partyCard}
          onPress={() => handlePartyPress(null, index)}
          activeOpacity={0.7}
        >
          <View style={styles.partyHeader}>
            <Text style={styles.partyName}>{t('ui.formation.index.partyDefaultName', { index: index + 1 })}</Text>
          </View>
          <View style={styles.membersRow}>
            {Array.from({ length: MAX_PARTY_SLOTS }).map((_, slotIndex) => (
              <MemberSlot key={slotIndex} partyMembers={[]} isEmpty slotSize={slotSize} avatarSize={avatarSize} />
            ))}
          </View>
        </TouchableOpacity>
      </View>
    )
  }, [avatarSize, catchUpPartyIds, goblins, handleAbort, handleAutoSummaryPress, handleHistoryPress, handleLogPress, handlePartyPress, handleStopAuto, partyHistories, partyHistoryDisplays, pt1Ref, slotSize, t])

  if (partiesLoading || goblinsLoading || dungeonsLoading || baseLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <TouchableOpacity onPress={handleBulkLaunch} disabled={!canBulkLaunch || isBulkLaunching}>
              <Text style={[
                styles.headerAction,
                (!canBulkLaunch || isBulkLaunching) && styles.headerActionDisabled,
              ]}>
                {isBulkLaunching ? t('ui.formation.common.launching') : t('ui.formation.index.bulkLaunch')}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={displayParties}
        keyExtractor={(item, index) => item?.id.toString() ?? `empty-${index}`}
        renderItem={renderPartyItem}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={<Text style={styles.prepTitle}>{t('ui.formation.index.prepTitle')}</Text>}
        ListFooterComponent={showSinglePartyTutorial ? (
          <View style={styles.singlePartyTutorial}>
            <Text style={styles.singlePartyTutorialText}>{t('ui.formation.index.singlePartyTutorial.details')}</Text>
            <Text style={styles.singlePartyTutorialText}>{t('ui.formation.index.singlePartyTutorial.hpRecovery')}</Text>
            <Text style={styles.singlePartyTutorialText}>{t('ui.formation.index.singlePartyTutorial.injured')}</Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: BOTTOM_INFO_SPACING,
  },
  prepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  singlePartyTutorial: {
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  singlePartyTutorialText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
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
  headerAction: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  headerActionDisabled: {
    color: '#9CA3AF',
  },
  partyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    padding: 6,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  partyCardGoldenAcorn: {
    backgroundColor: '#F7EFE6',
    borderColor: '#A16207',
  },
  historySection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  historyList: {
    gap: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  historyContent: {
    flex: 1,
  },
  historyText: {
    fontSize: 13,
    color: '#374151',
  },
  historyDungeon: {
    fontSize: 12,
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
    marginBottom: 6,
  },
  partyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  partyRewardText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 1,
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
  autoExpeditionBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoExpeditionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  autoExpeditionWaitingBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  autoExpeditionWaitingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  autoExpeditionCatchingUpBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  autoExpeditionCatchingUpBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  autoExpeditionPendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoExpeditionPendingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  autoExpeditionSummaryBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoExpeditionSummaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6D28D9',
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
    marginBottom: 1,
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
    marginTop: 17, // memberLevel分の高さを確保
  },
  emptySlotText: {
    fontSize: 20,
    color: '#9CA3AF',
  },
})
