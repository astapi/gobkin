import { useCallback, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, TouchableOpacity, Pressable, StyleSheet, FlatList, ScrollView, ActivityIndicator, Image, Alert, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useBaseStore, selectMaxGoblins, selectRank } from '@/presentation/stores/useBaseStore'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { GoblinCard } from '@/presentation/components/GoblinCard'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'
import { useTutorialTarget } from '@/presentation/hooks/useTutorialTarget'
import type { Goblin, GoblinJob } from '@/shared/types'
import { GOBLIN_RACE_IDS, normalizeGoblinRaceId, type GoblinRaceId } from '@/shared/types/Race'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import { isProtectedGoblin } from '@/shared/utils/goblinProtection'
import { getFactorImage } from '@/shared/utils/factorImages'
import { getFactor } from '@/shared/data/factors'
import { getDefaultSkillsForRace } from '@/shared/data/raceSkills'
import { getUniqueSkillsById } from '@/shared/data/characterSkills'
import { GOBLIN_JOB_SKILL_IDS, isPureGoblin } from '@/shared/data/goblinJobs'
import { EQUIPMENT_GRANTED_SKILL_IDS } from '@/shared/data/equipmentPoolLoader'
import { getFactorName, getGoblinJobLabel, getRaceLabel, getSkillLabel } from '@/shared/i18n/entityLocalization'

type SortKey = 'party' | 'hp'
type RaceFilter = 'all' | 'pure' | GoblinRaceId
type JobFilter = 'all' | 'none' | GoblinJob

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function getCardUniqueSkills(goblin: Goblin) {
  const raceSkillIds = new Set(
    getDefaultSkillsForRace(goblin.raceId ?? goblin.race).map((skill) => skill.id),
  )

  return getUniqueSkillsById(goblin.skills).filter(
    (skill) => (
      !raceSkillIds.has(skill.id) &&
      !GOBLIN_JOB_SKILL_IDS.has(skill.id) &&
      !EQUIPMENT_GRANTED_SKILL_IDS.has(skill.id)
    ),
  )
}

export default function GoblinListScreen() {
  const { t } = useTranslation()
  const advanceTutorial = useTutorialStore((state) => state.advanceTo)
  // 一覧画面に来たら「ゴブリンを確認」ステップへ。
  // 直前ステップ (see_first_goblin) のときだけ進める（飛ばし防止）。
  useFocusEffect(
    useCallback(() => {
      const current = useTutorialStore.getState().step
      if (current === 'see_first_goblin') {
        void advanceTutorial('view_first_goblin')
      }
    }, [advanceTutorial]),
  )
  const firstGoblinRef = useTutorialTarget<View>({
    activeOn: ['view_first_goblin'],
    messageKey: 'ui.tutorial.banner.viewFirstGoblin',
    placement: 'below',
    allowThrough: false,
  })
  const goblins = useGoblinStore((state) => state.goblins)
  const isLoading = useGoblinStore((state) => state.isLoading)
  const saveGoblin = useGoblinStore((state) => state.saveGoblin)
  const deleteGoblin = useGoblinStore((state) => state.deleteGoblin)
  const pendingGoblins = useBaseStore((state) => state.pendingGoblins)
  const removePendingGoblin = useBaseStore((state) => state.removePendingGoblin)
  const clearPendingGoblins = useBaseStore((state) => state.clearPendingGoblins)
  const maxGoblins = useBaseStore(selectMaxGoblins)
  const rank = useBaseStore(selectRank)
  const parties = usePartyStore((state) => state.parties)
  const swipeableRefs = useRef<Record<number, Swipeable | null>>({})
  const [openSwipeableId, setOpenSwipeableId] = useState<number | null>(null)
  const [isBulkDismissingPending, setIsBulkDismissingPending] = useState(false)

  const hasCapacity = goblins.length < maxGoblins
  const maxPendingGoblins = rank * 5
  const [sortKey, setSortKey] = useState<SortKey>('party')
  const [raceFilter, setRaceFilter] = useState<RaceFilter>('all')
  const [jobFilter, setJobFilter] = useState<JobFilter>('all')
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)
  const activeFilterCount = (raceFilter !== 'all' ? 1 : 0) + (jobFilter !== 'all' ? 1 : 0)

  const hasPureGoblin = useMemo(() => goblins.some(isPureGoblin), [goblins])
  const availableRaceIds = useMemo(() => {
    const owned = new Set<GoblinRaceId>()
    goblins.forEach((goblin) => {
      const raceId = normalizeGoblinRaceId(goblin.raceId ?? goblin.race)
      if (raceId !== 'goblin' && raceId !== 'founder') {
        owned.add(raceId)
      }
    })
    return GOBLIN_RACE_IDS.filter((id) => owned.has(id))
  }, [goblins])
  const availableJobs = useMemo(() => {
    const owned = new Set<GoblinJob>()
    goblins.forEach((goblin) => {
      if (goblin.job) owned.add(goblin.job)
    })
    return Array.from(owned)
  }, [goblins])
  const hasUnemployedPureGoblin = useMemo(
    () => goblins.some((goblin) => isPureGoblin(goblin) && !goblin.job),
    [goblins],
  )
  const hasJobFilterOptions = availableJobs.length > 0 || hasUnemployedPureGoblin

  const filteredGoblins = useMemo(() => (
    goblins.filter((goblin) => {
      if (raceFilter === 'pure') {
        if (!isPureGoblin(goblin)) return false
      } else if (raceFilter !== 'all') {
        if (normalizeGoblinRaceId(goblin.raceId ?? goblin.race) !== raceFilter) return false
      }
      if (jobFilter === 'none') {
        if (goblin.job) return false
      } else if (jobFilter !== 'all') {
        if (goblin.job !== jobFilter) return false
      }
      return true
    })
  ), [goblins, raceFilter, jobFilter])

  const sortedGoblins = useMemo(() => {
    if (sortKey === 'hp') {
      return [...filteredGoblins].sort((a, b) => (
        getEffectiveStats(b).hp - getEffectiveStats(a).hp
      ))
    }
    const partyMemberIds: number[] = []
    const seen = new Set<number>()
    parties.forEach((party) => {
      party.memberIds.forEach((memberId) => {
        if (!seen.has(memberId)) {
          seen.add(memberId)
          partyMemberIds.push(memberId)
        }
      })
    })
    const byId = new Map<number, Goblin>(filteredGoblins.map((g) => [g.id, g]))
    const ordered: Goblin[] = []
    partyMemberIds.forEach((id) => {
      const found = byId.get(id)
      if (found) ordered.push(found)
    })
    const others = filteredGoblins
      .filter((g) => !seen.has(g.id))
      .sort((a, b) => b.level - a.level)
    return [...ordered, ...others]
  }, [filteredGoblins, parties, sortKey])

  const partyNameByGoblinId = useMemo(() => {
    const mapping = new Map<number, string>()
    parties.forEach((party) => {
      party.memberIds.forEach((memberId) => {
        mapping.set(memberId, party.name)
      })
    })
    return mapping
  }, [parties])

  const getAssignedPartyName = useCallback((goblinId: number) => (
    partyNameByGoblinId.get(goblinId)
  ), [partyNameByGoblinId])

  const closeOpenSwipeable = useCallback(() => {
    if (openSwipeableId === null) return
    swipeableRefs.current[openSwipeableId]?.close()
    setOpenSwipeableId(null)
  }, [openSwipeableId])

  const handleSwipeableWillOpen = useCallback((goblinId: number) => {
    if (openSwipeableId !== null && openSwipeableId !== goblinId) {
      swipeableRefs.current[openSwipeableId]?.close()
    }
    setOpenSwipeableId(goblinId)
  }, [openSwipeableId])

  const handleSwipeableClose = useCallback((goblinId: number) => {
    setOpenSwipeableId((currentId) => (currentId === goblinId ? null : currentId))
  }, [])

  const handleGoblinPress = useCallback((goblin: Goblin) => {
    if (openSwipeableId !== null) {
      closeOpenSwipeable()
      return
    }
    if (useTutorialStore.getState().step === 'view_first_goblin') {
      return
    }
    // チュートリアル: 確認できたので次は編成タブへ
    void advanceTutorial('open_formation')
    router.push({ pathname: '/goblin/detail', params: { goblinId: String(goblin.id) } })
  }, [advanceTutorial, closeOpenSwipeable, openSwipeableId])

  const handleDeleteGoblin = useCallback((goblin: Goblin) => {
    if (isProtectedGoblin(goblin)) {
      Alert.alert('追放できません', `${goblin.name}は追放できません。`)
      swipeableRefs.current[goblin.id]?.close()
      return
    }

    const assignedPartyName = getAssignedPartyName(goblin.id)
    if (assignedPartyName) {
      Alert.alert('追放できません', `${goblin.name}は${assignedPartyName}に編成中です。`)
      swipeableRefs.current[goblin.id]?.close()
      return
    }

    Alert.alert(
      '追放確認',
      `${goblin.name}を追放しますか？\n追放時に装備は自動的に解除されます。`,
      [
        {
          text: 'キャンセル',
          style: 'cancel',
          onPress: () => swipeableRefs.current[goblin.id]?.close(),
        },
        {
          text: '追放する',
          style: 'destructive',
          onPress: () => {
            void deleteGoblin(goblin.id)
              .then(() => {
                delete swipeableRefs.current[goblin.id]
                setOpenSwipeableId((currentId) => (currentId === goblin.id ? null : currentId))
              })
              .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : `${goblin.name}の追放に失敗しました。`
                Alert.alert('削除エラー', message)
                swipeableRefs.current[goblin.id]?.close()
              })
          },
        },
      ],
    )
  }, [deleteGoblin, getAssignedPartyName])

  const renderRightActions = useCallback((goblin: Goblin) => (
    <TouchableOpacity
      style={styles.swipeDeleteAction}
      activeOpacity={0.8}
      onPress={() => handleDeleteGoblin(goblin)}
    >
      <Text style={styles.swipeDeleteActionText}>{t('ui.goblinList.banish')}</Text>
    </TouchableOpacity>
  ), [handleDeleteGoblin, t])

  const handlePendingGoblinPress = useCallback((goblin: Goblin) => {
    closeOpenSwipeable()
    router.push({
      pathname: '/goblin/detail',
      params: { goblinId: String(goblin.id), source: 'pending' },
    })
  }, [closeOpenSwipeable])

  const handleAddPending = useCallback(async (goblin: Goblin) => {
    closeOpenSwipeable()
    await saveGoblin(goblin)
    await removePendingGoblin(goblin.id)
  }, [closeOpenSwipeable, saveGoblin, removePendingGoblin])

  const handleDismissPending = useCallback((goblin: Goblin) => {
    closeOpenSwipeable()
    Alert.alert(
      '解雇確認',
      `${goblin.name}を解雇しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解雇する',
          style: 'destructive',
          onPress: () => removePendingGoblin(goblin.id),
        },
      ],
    )
  }, [closeOpenSwipeable, removePendingGoblin])

  const handleDismissAllPending = useCallback(() => {
    if (pendingGoblins.length === 0 || isBulkDismissingPending) return
    closeOpenSwipeable()
    Alert.alert(
      '一括解雇確認',
      `産まれたゴブリン${pendingGoblins.length}体をまとめて解雇しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'まとめて解雇する',
          style: 'destructive',
          onPress: () => {
            setIsBulkDismissingPending(true)
            void clearPendingGoblins()
              .catch(() => {
                Alert.alert('解雇エラー', '一括解雇に失敗しました。')
              })
              .finally(() => {
                setIsBulkDismissingPending(false)
              })
          },
        },
      ],
    )
  }, [clearPendingGoblins, closeOpenSwipeable, isBulkDismissingPending, pendingGoblins.length])

  const renderGoblinItem = useCallback(({ item: goblin, index }: { item: Goblin; index: number }) => {
    const card = (
      <Pressable onPress={() => handleGoblinPress(goblin)}>
        <GoblinCard
          goblin={goblin}
          assignedPartyName={partyNameByGoblinId.get(goblin.id)}
        />
      </Pressable>
    )

    return (
      <View
        style={styles.cardWrapper}
        ref={index === 0 ? firstGoblinRef : undefined}
        collapsable={false}
      >
        {isProtectedGoblin(goblin) ? card : (
          <Swipeable
            ref={(ref) => {
              swipeableRefs.current[goblin.id] = ref
            }}
            friction={2}
            overshootRight={false}
            rightThreshold={40}
            renderRightActions={() => renderRightActions(goblin)}
            onSwipeableWillOpen={() => handleSwipeableWillOpen(goblin.id)}
            onSwipeableClose={() => handleSwipeableClose(goblin.id)}
          >
            {card}
          </Swipeable>
        )}
      </View>
    )
  }, [firstGoblinRef, handleGoblinPress, handleSwipeableClose, handleSwipeableWillOpen, partyNameByGoblinId, renderRightActions])

  const renderPendingFooter = useCallback(() => {
    if (pendingGoblins.length === 0) {
      return <View style={styles.footerSpacer} />
    }

    return (
      <View style={styles.pendingSection}>
        <View style={styles.pendingSectionHeader}>
          <View style={styles.pendingSectionHeaderLeft}>
            <Text style={styles.pendingSectionTitle}>{t('ui.goblinList.pendingSectionTitle')}</Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingGoblins.length} / {maxPendingGoblins}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.bulkDismissButton, isBulkDismissingPending && styles.bulkDismissButtonDisabled]}
            onPress={handleDismissAllPending}
            disabled={isBulkDismissingPending}
          >
            <Text style={styles.bulkDismissButtonText}>
              {isBulkDismissingPending ? t('ui.goblinList.processing') : t('ui.goblinList.dismissAll')}
            </Text>
          </TouchableOpacity>
        </View>
        {pendingGoblins.map((goblin) => {
          const effectiveStats = getEffectiveStats(goblin)
          const factorIds = goblin.factors ?? []
          const visibleFactorIds = factorIds.slice(0, 2)
          const extraFactorCount = Math.max(0, factorIds.length - visibleFactorIds.length)
          const uniqueSkills = getCardUniqueSkills(goblin)
          const visibleSkills = uniqueSkills.slice(0, 3)
          const extraSkillCount = Math.max(0, uniqueSkills.length - visibleSkills.length)
          return (
            <View key={goblin.id} style={styles.pendingCard}>
              <View style={styles.pendingRow}>
                <TouchableOpacity
                  style={styles.pendingPressable}
                  activeOpacity={0.8}
                  onPress={() => handlePendingGoblinPress(goblin)}
                >
                  <Image source={getGoblinDisplayImage(goblin)} style={styles.pendingAvatar} />
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingName} numberOfLines={1}>{goblin.name}</Text>
                    <Text style={styles.pendingStats}>
                      HP{effectiveStats.hp} / A{effectiveStats.atk} / D{effectiveStats.def} / 命{effectiveStats.accuracy}
                    </Text>
                    {(factorIds.length > 0 || uniqueSkills.length > 0) && (
                      <View style={styles.pendingTraitRows}>
                        {factorIds.length > 0 && (
                          <View style={styles.pendingTraitRow}>
                            {visibleFactorIds.map((factorId, index) => {
                              const FactorIcon = getFactorImage(factorId)
                              return (
                                <View key={`${factorId}-${index}`} style={styles.pendingFactorChip}>
                                  <FactorIcon width={13} height={13} />
                                  <Text style={styles.pendingFactorChipText} numberOfLines={1}>
                                    {getFactorName(getFactor(factorId) ?? { id: factorId, name: factorId })}
                                  </Text>
                                </View>
                              )
                            })}
                            {extraFactorCount > 0 && (
                              <Text style={styles.pendingMoreChip}>+{extraFactorCount}</Text>
                            )}
                          </View>
                        )}
                        {uniqueSkills.length > 0 && (
                          <View style={styles.pendingTraitRow}>
                            {visibleSkills.map((skill) => (
                              <Text key={skill.id} style={styles.pendingSkillChip} numberOfLines={1}>
                                {getSkillLabel(skill)}
                              </Text>
                            ))}
                            {extraSkillCount > 0 && (
                              <Text style={styles.pendingMoreChip}>+{extraSkillCount}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                {hasCapacity && (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddPending(goblin)}
                  >
                    <Text style={styles.addButtonText}>{t('ui.goblinList.add')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => handleDismissPending(goblin)}
                >
                  <Text style={styles.dismissButtonText}>{t('ui.goblinList.dismiss')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
        <View style={styles.footerSpacer} />
      </View>
    )
  }, [handleAddPending, handleDismissAllPending, handleDismissPending, handlePendingGoblinPress, hasCapacity, isBulkDismissingPending, maxPendingGoblins, pendingGoblins, t])


  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </SafeAreaView>
    )
  }

  if (goblins.length === 0 && pendingGoblins.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer} edges={['top', 'left', 'right', 'bottom']}>
        <Text style={styles.emptyIcon}>G</Text>
        <Text style={styles.emptyTitle}>ゴブリンがいません</Text>
        <Text style={styles.emptyDescription}>
          拠点でゴブリンを受け入れると、ここに表示されます
        </Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>{t('ui.goblinList.title')}</Text>
          <Text style={styles.headerCount}>{goblins.length} / {maxGoblins}</Text>
        </View>
        <View style={styles.controlsRow}>
          <View style={styles.sortRow}>
            {(['party', 'hp'] as const).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.sortButton, sortKey === key && styles.sortButtonActive]}
                onPress={() => {
                  closeOpenSwipeable()
                  setSortKey(key)
                }}
              >
                <Text style={[styles.sortButtonText, sortKey === key && styles.sortButtonTextActive]}>
                  {t(`ui.goblinList.sort.${key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.filterTriggerButton, activeFilterCount > 0 && styles.filterTriggerButtonActive]}
            onPress={() => {
              closeOpenSwipeable()
              setIsFilterModalVisible(true)
            }}
          >
            <Text
              style={[styles.filterTriggerText, activeFilterCount > 0 && styles.filterTriggerTextActive]}
            >
              {t('ui.goblinList.filter.trigger')}
            </Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterTriggerBadge}>
                <Text style={styles.filterTriggerBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsFilterModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('ui.goblinList.filter.title')}</Text>
              <TouchableOpacity
                onPress={() => {
                  setRaceFilter('all')
                  setJobFilter('all')
                }}
                disabled={activeFilterCount === 0}
              >
                <Text
                  style={[styles.modalResetText, activeFilterCount === 0 && styles.modalResetTextDisabled]}
                >
                  {t('ui.goblinList.filter.reset')}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.modalSectionTitle}>{t('ui.goblinList.filter.raceSection')}</Text>
              <View style={styles.modalChipWrap}>
                <FilterChip
                  label={t('ui.goblinList.filter.allRaces')}
                  active={raceFilter === 'all'}
                  onPress={() => setRaceFilter('all')}
                />
                {hasPureGoblin && (
                  <FilterChip
                    label={t('ui.goblinList.filter.pureGoblin')}
                    active={raceFilter === 'pure'}
                    onPress={() => setRaceFilter('pure')}
                  />
                )}
                {availableRaceIds.map((raceId) => (
                  <FilterChip
                    key={raceId}
                    label={getRaceLabel(raceId)}
                    active={raceFilter === raceId}
                    onPress={() => setRaceFilter(raceId)}
                  />
                ))}
              </View>
              {hasJobFilterOptions && (
                <>
                  <Text style={[styles.modalSectionTitle, styles.modalSectionTitleSpaced]}>
                    {t('ui.goblinList.filter.jobSection')}
                  </Text>
                  <View style={styles.modalChipWrap}>
                    <FilterChip
                      label={t('ui.goblinList.filter.allJobs')}
                      active={jobFilter === 'all'}
                      onPress={() => setJobFilter('all')}
                    />
                    {hasUnemployedPureGoblin && (
                      <FilterChip
                        label={t('ui.goblinList.filter.noJob')}
                        active={jobFilter === 'none'}
                        onPress={() => setJobFilter('none')}
                      />
                    )}
                    {availableJobs.map((job) => (
                      <FilterChip
                        key={job}
                        label={getGoblinJobLabel(job)}
                        active={jobFilter === job}
                        onPress={() => setJobFilter(job)}
                      />
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalApplyButton}
              onPress={() => setIsFilterModalVisible(false)}
            >
              <Text style={styles.modalApplyButtonText}>
                {t('ui.goblinList.filter.applyWithCount', { count: sortedGoblins.length })}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      <FlatList
        data={sortedGoblins}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGoblinItem}
        contentContainerStyle={styles.scrollContent}
        onScrollBeginDrag={closeOpenSwipeable}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={renderPendingFooter}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    color: '#D1D5DB',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
  },
  filterTriggerButtonActive: {
    backgroundColor: '#374151',
    borderColor: '#374151',
  },
  filterTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterTriggerTextActive: {
    color: '#FFFFFF',
  },
  filterTriggerBadge: {
    minWidth: 16,
    paddingHorizontal: 4,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTriggerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalResetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalResetTextDisabled: {
    color: '#9CA3AF',
  },
  modalBody: {
    paddingBottom: 12,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  modalSectionTitleSpaced: {
    marginTop: 16,
  },
  modalChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalApplyButton: {
    marginTop: 8,
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalApplyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sortButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
  sortButtonActive: {
    backgroundColor: '#374151',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  cardWrapper: {
    backgroundColor: '#F9FAFB',
  },
  swipeDeleteAction: {
    width: 88,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },
  swipeDeleteActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pendingSection: {
    paddingTop: 8,
  },
  footerSpacer: {
    height: 32,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  pendingSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  pendingBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  bulkDismissButton: {
    backgroundColor: '#991B1B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  bulkDismissButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  bulkDismissButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pendingCard: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingAvatar: {
    width: 32,
    height: 32,
  },
  pendingInfo: {
    flex: 1,
    minWidth: 0,
  },
  pendingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  pendingStats: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  pendingTraitRows: {
    marginTop: 4,
    gap: 3,
  },
  pendingTraitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  pendingFactorChip: {
    maxWidth: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pendingFactorChipText: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '700',
    color: '#4338CA',
  },
  pendingSkillChip: {
    maxWidth: 128,
    fontSize: 9,
    fontWeight: '700',
    color: '#065F46',
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pendingMoreChip: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  addButton: {
    backgroundColor: '#374151',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  addButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  dismissButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
