import { memo, useMemo, useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useBaseStore, selectRank } from '@/presentation/stores/useBaseStore'
import { useExpeditionFlow, type ExpeditionHistoryDisplay } from '@/presentation/hooks/useExpeditionFlow'
import { getGoldenAcornCount } from '@/presentation/stores/usePurchaseStore'
import { useCurrentTime } from '@/presentation/hooks/useCurrentTime'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'
import { useTutorialTarget } from '@/presentation/hooks/useTutorialTarget'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getPartyEffectiveStats } from '@/shared/utils/goblinStats'
import {
  getGoldBonusPercentFromSkills,
  getPartyRareMultiplierFromSkills,
  getPartyTitleMultiplierFromSkills,
} from '@/shared/data/characterSkills'
import { normalizePartyRewardMultipliers } from '@/shared/types'
import type { Party, Goblin, Dungeon, DungeonTier, ExpeditionRequest, ExpeditionRecord } from '@/shared/types'

const MAX_PARTY_SLOTS = 6

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
  goblins: Goblin[]
  onPress: () => void
  onAbort: () => void
  historyDisplays: ExpeditionHistoryDisplay[]
  onHistoryPress: (record: ExpeditionRecord, ongoing: boolean) => void
  onLogPress: (record: ExpeditionRecord) => void
  slotSize: number
  avatarSize: number
}

const PartyCard = memo(function PartyCard({
  party,
  goblins,
  onPress,
  onAbort,
  historyDisplays,
  onHistoryPress,
  onLogPress,
  slotSize,
  avatarSize,
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
  return (
    <View style={styles.partyCard}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.partyHeader}>
          <Text style={styles.partyName}>{party.name}</Text>
          {status === 'expedition' && (
            <TouchableOpacity
              style={styles.expeditionBadge}
              onPress={(e) => {
                e.stopPropagation()
                onAbort()
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.expeditionBadgeText}>{t('ui.formation.index.abortButton')}</Text>
            </TouchableOpacity>
          )}
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
          <Text style={styles.historyTitle}>{t('ui.formation.index.historyTitle')}</Text>
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
  const createParty = usePartyStore((state) => state.createParty)
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const dungeons = useDungeonStore((state) => state.dungeons)
  const dungeonsLoading = useDungeonStore((state) => state.isLoading)
  const baseLoading = useBaseStore((state) => state.isLoading)
  const pendingGoblins = useBaseStore((state) => state.pendingGoblins)
  const rank = useBaseStore(selectRank)
  const currentTime = useCurrentTime({ enabled: true })
  const {
    partyHistories,
    partyHistoryDisplays,
    startExpedition,
    startBulkExpedition,
    abortExpedition,
  } = useExpeditionFlow({ parties, enableAutoCompletion: true, currentTime })
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


  const handlePartyPress = useCallback(async (party: Party | null, index: number) => {
    void advanceTutorial('edit_party')
    if (!party) {
      // パーティがない場合は新規作成して遷移
      const newParty = await createParty({
        name: t('ui.formation.index.partyDefaultName', { index: index + 1 }),
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
    const inputs: Array<{ party: Party; dungeon: Dungeon; returnPolicy: ExpeditionRequest['returnPolicy']; tier: DungeonTier }> = []

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

    const promptGoldenAcornBulk = (onChoose: (useAcorn: boolean) => void) => {
      const acornCount = getGoldenAcornCount()
      // 全PT分のドングリを保有している場合のみ選択肢を出す
      if (acornCount < inputs.length) {
        onChoose(false)
        return
      }
      Alert.alert(
        t('ui.formation.index.goldenAcornBulkPromptTitle'),
        t('ui.formation.index.goldenAcornBulkPromptBody', {
          count: inputs.length,
          remaining: acornCount,
        }),
        [
          { text: t('ui.common.cancel'), style: 'cancel' },
          { text: t('ui.formation.index.goldenAcornBulkStartWithout'), onPress: () => onChoose(false) },
          { text: t('ui.formation.index.goldenAcornBulkUseAndStart'), onPress: () => onChoose(true) },
        ],
      )
    }

    const launchWithGoldenAcornPrompt = () => {
      promptGoldenAcornBulk((useAcorn) => void doBulkLaunch(useAcorn))
    }

    const maxPendingGoblins = rank * 5
    const remainingPendingSlots = Math.max(0, maxPendingGoblins - pendingGoblins.length)
    if (inputs.length > remainingPendingSlots) {
      Alert.alert(
        t('ui.formation.common.confirm'),
        t('ui.formation.index.pendingOverflowBody', { count: inputs.length }),
        [
          { text: t('ui.common.cancel'), style: 'cancel' },
          { text: t('ui.formation.common.launch'), onPress: launchWithGoldenAcornPrompt },
        ],
      )
      return
    }

    launchWithGoldenAcornPrompt()
  }, [dungeons, parties, pendingGoblins.length, rank, startBulkExpedition, t])

  const canBulkLaunch = useMemo(() => {
    return parties.some((party) => {
      if ((party.status ?? 'idle') === 'expedition') return false
      if (party.memberIds.length === 0) return false
      if (!party.dungeonId) return false
      const dungeon = dungeons.find((item) => item.id === party.dungeonId)
      return Boolean(dungeon?.unlocked)
    })
  }, [dungeons, parties])

  if (partiesLoading || goblinsLoading || dungeonsLoading || baseLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
      </SafeAreaView>
    )
  }

  const renderPartyItem = useCallback(({ item, index }: { item: Party | null; index: number }) => {
    const wrapperRef = index === 0 ? pt1Ref : undefined
    if (item) {
      return (
        <View ref={wrapperRef} collapsable={false}>
          <PartyCard
            party={item}
            goblins={goblins}
            onPress={() => handlePartyPress(item, index)}
            onAbort={() => handleAbort(item)}
            historyDisplays={partyHistoryDisplays[item.id] ?? []}
            onHistoryPress={handleHistoryPress}
            onLogPress={handleLogPress}
            slotSize={slotSize}
            avatarSize={avatarSize}
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
  }, [avatarSize, goblins, handleAbort, handleHistoryPress, handleLogPress, handlePartyPress, partyHistoryDisplays, pt1Ref, slotSize, t])

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
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    marginBottom: 6,
  },
  partyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  partyRewardText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
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
