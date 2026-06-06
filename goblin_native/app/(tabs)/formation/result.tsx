import { useMemo, useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { BOTTOM_INFO_SPACING } from '@/shared/constants/layout'
import { useExpeditionStore } from '@/presentation/stores/useExpeditionStore'
import { useStoryStore } from '@/presentation/stores/useStoryStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { areasData } from '@/shared/data'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import type { ExpeditionRecord, Goblin, Story, TimelineEvent, TreasureDrop } from '@/shared/types'
import { getDungeonTierDisplayName } from '@/shared/types'
import { getDungeonName, getEquipmentDisplayName, getFactorName } from '@/shared/i18n/entityLocalization'
import { getEquipmentTemplate } from '@/shared/data/equipmentPoolLoader'
import { getFactor } from '@/shared/data/factors'
import { getFactorImage } from '@/shared/utils/factorImages'
import { getMaxClearedFloorFromReplay, isDungeonCompleted } from '@/shared/utils/expeditionClear'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'
import { useTutorialTarget } from '@/presentation/hooks/useTutorialTarget'

function resolveTreasureName(drop: TreasureDrop): string {
  const template = getEquipmentTemplate(drop.templateId)
  if (!template) {
    throw new Error(`Unknown equipment template: ${drop.templateId}`)
  }
  return getEquipmentDisplayName(drop, template)
}

export default function ExpeditionResultScreen() {
  const { t } = useTranslation()
  const { expeditionId } = useLocalSearchParams<{ expeditionId?: string }>()

  const dungeons = useDungeonStore((state) => state.dungeons)
  const progress = useDungeonStore((state) => state.progress)
  const markDungeonCleared = useDungeonStore((state) => state.markDungeonCleared)
  const markDungeonFloorCleared = useDungeonStore((state) => state.markDungeonFloorCleared)
  const markUnlockNotified = useDungeonStore((state) => state.markUnlockNotified)
  const {
    expeditionRecords,
    getExpeditionById,
    refresh: refreshExpeditions,
    isLoading: isExpeditionLoading,
  } = useExpeditionStore()
  const checkAndUnlockStories = useStoryStore((state) => state.checkAndUnlockStories)
  const [hasRetriedLoad, setHasRetriedLoad] = useState(false)
  const [expeditionRecord, setExpeditionRecord] = useState<ExpeditionRecord | null>(null)
  const [unlockedStories, setUnlockedStories] = useState<Story[]>([])

  useEffect(() => {
    if (!expeditionId) return
    void (async () => {
      const byId = await getExpeditionById(expeditionId)
      if (byId) {
        setExpeditionRecord(byId)
      } else {
        const fromList = expeditionRecords.find(record => record.id === expeditionId) ?? null
        setExpeditionRecord(fromList)
      }
    })()
  }, [expeditionId, getExpeditionById, expeditionRecords])

  useEffect(() => {
    if (!expeditionId || isExpeditionLoading || expeditionRecord || hasRetriedLoad) return
    void refreshExpeditions()
    setHasRetriedLoad(true)
  }, [expeditionId, expeditionRecord, hasRetriedLoad, isExpeditionLoading, refreshExpeditions])

  const replay = expeditionRecord?.replay ?? null

  const dungeon = useMemo(() => {
    const id = expeditionRecord?.dungeonId
    return id ? dungeons.find(d => d.id === id) : null
  }, [dungeons, expeditionRecord?.dungeonId])

  const dungeonDisplayName = useMemo(() => {
    if (!dungeon) return null
    return getDungeonTierDisplayName(getDungeonName(dungeon), replay?.meta.tier ?? 0)
  }, [dungeon, replay?.meta.tier])

  const partySnapshot = replay?.meta.partySnapshot ?? []

  // 遠征終了時のHP計算（全戦闘のallyHPDeltaを累積）
  const endHpMap = useMemo(() => {
    if (!replay || partySnapshot.length === 0) return new Map<number, number>()

    const hpValues = partySnapshot.map(g => getEffectiveStats(g).hp)

    for (const event of replay.events) {
      if ((event.type === 'battle' || event.type === 'boss') && event.combat.allyHPDelta) {
        event.combat.allyHPDelta.forEach((delta, idx) => {
          hpValues[idx] = Math.max(0, hpValues[idx] + delta)
        })
      }
    }

    const map = new Map<number, number>()
    partySnapshot.forEach((g, idx) => map.set(g.id, hpValues[idx]))
    return map
  }, [replay, partySnapshot])

  // 保存済みのレベルアップ情報を読み取り
  const levelUpMap = useMemo(() => {
    const map = new Map<number, { oldLevel: number; newLevel: number }>()
    if (!replay?.summary.memberLevelUps) return map

    for (const entry of replay.summary.memberLevelUps) {
      map.set(entry.goblinId, { oldLevel: entry.oldLevel, newLevel: entry.newLevel })
    }
    return map
  }, [replay])

  const getResultText = () => {
    if (!replay) return ''
    if (replay.summary.casualties.length === replay.meta.party.length) {
      return t('ui.result.partyDefeated')
    }
    return t('ui.result.partyReturned')
  }

  const getHeaderText = () => {
    if (!replay) return ''
    const area = areasData.find(a => a.id === replay.meta.areaId)
    if (isDungeonCompleted(replay) && replay.summary.maxFloorReached === area?.floors) {
      return t('ui.result.completed')
    }
    if (replay.summary.success) {
      return t('ui.result.reachedGoal')
    }
    return t('ui.result.returned')
  }

  const isSuccess = replay?.summary.success ?? false
  const expGained = replay?.summary.xpGained ?? 0
  const goldGained = replay?.summary.goldGained ?? 0
  const goldMultiplier = replay?.summary.goldMultiplier ?? 1
  const treasureDrops = replay?.summary.treasureDrops ?? []

  // 因子を獲得したメンバーごとに「誰が・どの因子を」取得したかをまとめる
  const acquiredFactors = useMemo(() => {
    const acquisitions = replay?.summary.factorAcquisitions ?? []
    return acquisitions
      .map(acquisition => {
        const owner = partySnapshot.find(g => g.id === acquisition.goblinId)
        return {
          goblinId: acquisition.goblinId,
          goblinName: owner?.name ?? `#${acquisition.goblinId}`,
          factorIds: acquisition.factorIds,
        }
      })
      .filter(entry => entry.factorIds.length > 0)
  }, [replay, partySnapshot])

  // チュートリアル: 結果画面でのスポットライト誘導ターゲット
  const tutorialStep = useTutorialStore(state => state.step)
  const isLearnFactorStep = tutorialStep === 'learn_factor'
  const isLearnUnlockStep = tutorialStep === 'learn_unlock'
  const factorSectionRef = useTutorialTarget<View>({
    activeOn: ['learn_factor'],
    messageKey: 'ui.tutorial.banner.learnFactor',
    placement: 'above',
  })
  const unlockSectionRef = useTutorialTarget<View>({
    activeOn: ['learn_unlock'],
    messageKey: 'ui.tutorial.banner.learnUnlock',
    placement: 'above',
  })
  const menuButtonRef = useTutorialTarget<View>({
    activeOn: ['return_to_list'],
    messageKey: 'ui.tutorial.banner.returnToList',
    placement: 'above',
  })

  // チュートリアル: 因子をタップしたら次（ダンジョン解放の確認）へ進める
  const handleFactorAck = useCallback(() => {
    if (useTutorialStore.getState().step === 'learn_factor') {
      void useTutorialStore.getState().advanceTo('learn_unlock')
    }
  }, [])

  // チュートリアル: 解放通知をタップしたら次（一覧へ戻る誘導）へ進める
  const handleUnlockAck = useCallback(() => {
    if (useTutorialStore.getState().step === 'learn_unlock') {
      void useTutorialStore.getState().advanceTo('return_to_list')
    }
  }, [])

  useEffect(() => {
    if (!replay || !dungeon) return
    const maxClearedFloor = getMaxClearedFloorFromReplay(replay)
    const currentClearedFloor = progress[dungeon.id]?.maxClearedFloorsByTier?.[replay.meta.tier ?? 0] ?? 0
    if (maxClearedFloor > currentClearedFloor) {
      void markDungeonFloorCleared(dungeon, maxClearedFloor, replay.meta.tier)
    }
    const cleared = isDungeonCompleted(replay) && maxClearedFloor >= dungeon.floors
    if (cleared && !dungeon.cleared) {
      void (async () => {
        await markDungeonCleared(dungeon, true, replay.meta.tier)
        const stories = await checkAndUnlockStories(dungeon.id)
        if (stories.length > 0) {
          setUnlockedStories(stories)
        }
      })()
    }
  }, [dungeon, markDungeonCleared, markDungeonFloorCleared, checkAndUnlockStories, progress, replay])

  const area = replay ? areasData.find(a => a.id === replay.meta.areaId) : dungeon
  const unlockTargets = useMemo(() => {
    if (!area) return []
    return Array.from(new Set([
      ...(area.unlockNext ? [area.unlockNext] : []),
      ...(area.unlockNexts ?? []),
    ]))
  }, [area])
  const nextAreaName = unlockTargets.length > 0
    ? unlockTargets
        .map(unlockTarget => {
          const nextArea = areasData.find(a => a.id === unlockTarget)
          return nextArea ? getDungeonName(nextArea) : unlockTarget
        })
        .join('、')
    : null
  const [showUnlockNotice, setShowUnlockNotice] = useState(false)

  useEffect(() => {
    if (unlockTargets.length === 0 || !isSuccess) return
    const newlyUnlockedTargets = unlockTargets.filter(unlockTarget => {
      const nextProgress = progress[unlockTarget]
      return nextProgress?.unlocked && !nextProgress.unlockNotified
    })
    if (newlyUnlockedTargets.length === 0) return
    setShowUnlockNotice(true)
    newlyUnlockedTargets.forEach(unlockTarget => {
      void markUnlockNotified(unlockTarget)
    })
  }, [unlockTargets, isSuccess, progress, markUnlockNotified])

  const handleBackToList = useCallback(() => {
    // チュートリアル: 一覧へ戻る誘導中なら、一覧タブを開かせるステップへ進める
    if (useTutorialStore.getState().step === 'return_to_list') {
      void useTutorialStore.getState().advanceTo('open_goblin_list')
    }
    router.dismissAll()
  }, [])

  if (expeditionId && (isExpeditionLoading || (!expeditionRecord && !hasRetriedLoad))) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('ui.result.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!expeditionRecord || !replay) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('ui.result.loadingMissing')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>← {t('ui.common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('ui.result.title')}</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: BOTTOM_INFO_SPACING }}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>
            {dungeonDisplayName ?? t('ui.result.expeditionFallback')}: {getHeaderText()}
          </Text>
          <Text style={styles.headerSubtitle}>{getResultText()}</Text>
        </View>

        <View style={styles.section}>
          {partySnapshot.map(goblin => {
            const maxHp = getEffectiveStats(goblin).hp
            const currentHp = endHpMap.get(goblin.id) ?? maxHp
            const levelUp = levelUpMap.get(goblin.id)
            const dead = currentHp === 0

            return (
              <View key={goblin.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Image
                    source={getGoblinDisplayImage(goblin)}
                    style={[styles.memberAvatarImage, dead && styles.memberAvatarDead]}
                  />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {goblin.name}
                    <Text style={styles.memberHp}> ({currentHp}/{maxHp})</Text>
                  </Text>
                  {levelUp && (
                    <Text style={styles.levelUpText}>
                      Lv{levelUp.oldLevel} → Lv{levelUp.newLevel}
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.summaryText}>{t('ui.result.gainedXp', { value: expGained.toLocaleString() })}</Text>
          <Text style={styles.summaryText}>
            {goldMultiplier > 1
              ? t('ui.result.gainedGoldWithMultiplier', {
                  value: goldGained.toLocaleString(),
                  multiplier: goldMultiplier.toFixed(1),
                })
              : t('ui.result.gainedGold', { value: goldGained.toLocaleString() })}
          </Text>
        </View>

        {treasureDrops.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('ui.result.items')}</Text>
            {treasureDrops.map((drop, idx) => (
              <Text key={idx} style={styles.summaryText}>{resolveTreasureName(drop)}</Text>
            ))}
          </View>
        )}

        {acquiredFactors.length > 0 && (
          <View ref={factorSectionRef} style={styles.section}>
            <TouchableOpacity
              activeOpacity={isLearnFactorStep ? 0.7 : 1}
              onPress={handleFactorAck}
              disabled={!isLearnFactorStep}
            >
              <Text style={styles.sectionTitle}>{t('ui.result.factorsAcquired')}</Text>
              {acquiredFactors.map(entry => (
                <View key={entry.goblinId} style={styles.factorMemberBlock}>
                  <Text style={styles.factorOwnerName} numberOfLines={1}>{entry.goblinName}</Text>
                  <View style={styles.factorChipRow}>
                    {entry.factorIds.map(factorId => {
                      const FactorIcon = getFactorImage(factorId)
                      return (
                        <View key={factorId} style={styles.factorChip}>
                          <FactorIcon width={14} height={14} />
                          <Text style={styles.factorChipText} numberOfLines={1}>
                            {getFactorName(getFactor(factorId) ?? { id: factorId, name: factorId })}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              ))}
            </TouchableOpacity>
          </View>
        )}

        {nextAreaName && isSuccess && showUnlockNotice && (
          <View ref={unlockSectionRef} style={styles.section}>
            <TouchableOpacity
              activeOpacity={isLearnUnlockStep ? 0.7 : 1}
              onPress={handleUnlockAck}
              disabled={!isLearnUnlockStep}
            >
              <Text style={styles.summaryText}>{t('ui.result.unlockedArea', { name: nextAreaName })}</Text>
            </TouchableOpacity>
          </View>
        )}

        {unlockedStories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.storyUnlockTitle}>{t('ui.result.storyUnlocked')}</Text>
            {unlockedStories.map(story => (
              <TouchableOpacity
                key={story.id}
                style={styles.storyButton}
                onPress={() => router.push({ pathname: '/(tabs)/story/reader', params: { storyId: story.id } })}
              >
                <Text style={styles.storyButtonText}>{story.title}</Text>
                <Text style={styles.storyButtonArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View ref={menuButtonRef} style={styles.bottomSection}>
          <TouchableOpacity style={styles.menuButton} onPress={handleBackToList}>
            <Text style={styles.menuButtonText}>{t('ui.result.backToMenu')}</Text>
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
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
    fontWeight: '400',
    color: '#6B7280',
  },
  levelUpText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  summaryText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 6,
  },
  factorMemberBlock: {
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 10,
  },
  factorOwnerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  factorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  factorChip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  factorChipText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  bottomSection: {
    padding: 16,
    backgroundColor: '#F3F4F6',
  },
  storyUnlockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 8,
  },
  storyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  storyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  storyButtonArrow: {
    fontSize: 16,
    color: '#7C3AED',
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
