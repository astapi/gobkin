import { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, router } from 'expo-router'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { usePendingGoblins } from '@/presentation/hooks/usePendingGoblins'
import { useBaseState } from '@/presentation/hooks/useBaseState'
import { GoblinCard } from '@/presentation/components/GoblinCard'
import type { Goblin } from '@/shared/types'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'

export default function GoblinListScreen() {
  const { goblins, isLoading, refreshGoblins, saveGoblin } = useGoblinService()
  const { pendingGoblins, removePendingGoblin, refreshPendingGoblins } = usePendingGoblins()
  const { maxGoblins } = useBaseState()

  const hasCapacity = goblins.length < maxGoblins

  const handleGoblinPress = useCallback((goblin: Goblin) => {
    router.push({ pathname: '/goblin/detail', params: { goblinId: String(goblin.id) } })
  }, [])

  const handleAddPending = useCallback(async (goblin: Goblin) => {
    await saveGoblin(goblin)
    await removePendingGoblin(goblin.id)
  }, [saveGoblin, removePendingGoblin])

  const handleDismissPending = useCallback((goblin: Goblin) => {
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
  }, [removePendingGoblin])

  useFocusEffect(
    useCallback(() => {
      refreshGoblins()
      refreshPendingGoblins()
    }, [refreshGoblins, refreshPendingGoblins])
  )

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </SafeAreaView>
    )
  }

  if (goblins.length === 0) {
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.listContent}>
          {goblins.map((goblin) => (
            <View key={goblin.id} style={styles.cardWrapper}>
              <GoblinCard goblin={goblin} onPress={() => handleGoblinPress(goblin)} />
            </View>
          ))}
        </View>

        {pendingGoblins.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingSectionHeader}>
              <Text style={styles.pendingSectionTitle}>産まれたゴブリン</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingGoblins.length}体</Text>
              </View>
            </View>
            <Text style={styles.pendingSectionDesc}>
              拠点がいっぱいのため待機中です。
            </Text>
            {pendingGoblins.map((goblin) => {
              const effectiveStats = ModStatCalculator.calculate(goblin)
              return (
                <View key={goblin.id} style={styles.pendingCard}>
                  <View style={styles.pendingRow}>
                    <Image source={getGoblinImage(goblin.avatar)} style={styles.pendingAvatar} />
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingName} numberOfLines={1}>{goblin.name}</Text>
                      <Text style={styles.pendingStats}>
                        HP{effectiveStats.hp} / A{effectiveStats.atk} / D{effectiveStats.def} / S{effectiveStats.spd} / SP{effectiveStats.sp}
                      </Text>
                    </View>
                    {hasCapacity && (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => handleAddPending(goblin)}
                      >
                        <Text style={styles.addButtonText}>追加</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={() => handleDismissPending(goblin)}
                    >
                      <Text style={styles.dismissButtonText}>解雇</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 32,
  },
  listContent: {
    padding: 16,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  pendingSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
  pendingSectionDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  pendingCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingAvatar: {
    width: 40,
    height: 40,
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
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
