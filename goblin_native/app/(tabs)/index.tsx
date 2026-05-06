import { useCallback, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, TouchableOpacity, Pressable, StyleSheet, FlatList, ActivityIndicator, Image, Alert } from 'react-native'
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
import type { Goblin } from '@/shared/types'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import { isProtectedGoblin } from '@/shared/utils/goblinProtection'

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
  const [sortKey, setSortKey] = useState<'level' | 'atk' | 'hp'>('level')

  const sortedGoblins = useMemo(() => (
    [...goblins].sort((a, b) => {
      if (sortKey === 'level') return b.level - a.level
      const statsA = getEffectiveStats(a)
      const statsB = getEffectiveStats(b)
      return sortKey === 'atk' ? statsB.atk - statsA.atk : statsB.hp - statsA.hp
    })
  ), [goblins, sortKey])

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
        <View style={styles.sortRow}>
          {(['level', 'atk', 'hp'] as const).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.sortButton, sortKey === key && styles.sortButtonActive]}
              onPress={() => {
                closeOpenSwipeable()
                setSortKey(key)
              }}
            >
              <Text style={[styles.sortButtonText, sortKey === key && styles.sortButtonTextActive]}>
                {key === 'level' ? 'Lv' : key.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
  sortRow: {
    flexDirection: 'row',
    gap: 8,
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
