import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBaseState } from '@/presentation/hooks/useBaseState'
import { usePendingGoblins } from '@/presentation/hooks/usePendingGoblins'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import type { Goblin } from '@/shared/types'

export default function BaseManagementScreen() {
  const { baseState, isLoading: baseLoading, rank, capacity, upgradeRank } = useBaseState()
  const { pendingGoblins, isLoading: pendingLoading, removePendingGoblin } = usePendingGoblins()
  const { goblins, saveGoblin } = useGoblinService()

  const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false)

  const currentGoblinCount = goblins.length
  const canAcceptMore = currentGoblinCount < capacity

  const handleAcceptGoblin = useCallback((goblin: Goblin) => {
    if (!canAcceptMore) return
    setSelectedGoblin(goblin)
    setModalVisible(true)
  }, [canAcceptMore])

  const handleConfirmAccept = useCallback(() => {
    if (!selectedGoblin) return

    // ゴブリンを正式に受け入れ（goblinsテーブルに追加）
    saveGoblin(selectedGoblin)
    // 待機リストから削除
    removePendingGoblin(selectedGoblin.id)

    setModalVisible(false)
    setSelectedGoblin(null)
  }, [selectedGoblin, saveGoblin, removePendingGoblin])

  const handleUpgradeBase = useCallback(() => {
    setUpgradeModalVisible(true)
  }, [])

  const handleConfirmUpgrade = useCallback(() => {
    upgradeRank()
    setUpgradeModalVisible(false)
  }, [upgradeRank])

  if (baseLoading || pendingLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 拠点ステータス */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>拠点ステータス</Text>
          <View style={styles.card}>
            <View style={styles.baseInfo}>
              <Text style={styles.baseLevelLabel}>拠点ランク</Text>
              <Text style={styles.baseLevelValue}>{rank}</Text>
            </View>
            <View style={styles.capacityContainer}>
              <Text style={styles.capacityLabel}>収容人数</Text>
              <Text style={styles.capacityValue}>
                {currentGoblinCount} / {capacity}
              </Text>
              <View style={styles.capacityBar}>
                <View
                  style={[
                    styles.capacityFill,
                    { width: `${Math.min((currentGoblinCount / capacity) * 100, 100)}%` }
                  ]}
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgradeBase}
            >
              <Text style={styles.upgradeButtonText}>拠点をアップグレード</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 待機中ゴブリン */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>待機中ゴブリン</Text>
          <Text style={styles.sectionSubtitle}>拠点への参加を待っているゴブリン</Text>
          {pendingGoblins.length > 0 ? (
            pendingGoblins.map((goblin) => (
              <View key={goblin.id} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <View style={styles.goblinIcon}>
                    <Text style={styles.goblinIconText}>?</Text>
                  </View>
                  <View style={styles.goblinDetails}>
                    <Text style={styles.goblinName}>{goblin.name}</Text>
                    <Text style={styles.goblinStats}>
                      Lv.{goblin.level} | HP:{goblin.stats.hp} ATK:{goblin.stats.atk} DEF:{goblin.stats.def}
                    </Text>
                    {goblin.race && (
                      <Text style={styles.goblinRace}>{goblin.race}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.acceptButton,
                    !canAcceptMore && styles.acceptButtonDisabled
                  ]}
                  onPress={() => handleAcceptGoblin(goblin)}
                  disabled={!canAcceptMore}
                >
                  <Text style={styles.acceptButtonText}>
                    {canAcceptMore ? '受け入れ' : '満員'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>-</Text>
              <Text style={styles.emptyStateText}>待機中のゴブリンはいません</Text>
            </View>
          )}
        </View>

        {/* 現在のゴブリン一覧 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>所属ゴブリン ({currentGoblinCount})</Text>
          <View style={styles.goblinListContainer}>
            {goblins.slice(0, 6).map((goblin) => (
              <View key={goblin.id} style={styles.goblinMiniCard}>
                <View style={styles.goblinMiniAvatar}>
                  <Text style={styles.goblinMiniAvatarText}>G</Text>
                </View>
                <Text style={styles.goblinMiniName} numberOfLines={1}>{goblin.name}</Text>
                <Text style={styles.goblinMiniLevel}>Lv.{goblin.level}</Text>
              </View>
            ))}
            {goblins.length > 6 && (
              <View style={styles.goblinMiniCard}>
                <Text style={styles.moreText}>+{goblins.length - 6}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ゴブリン受け入れ確認モーダル */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ゴブリンを受け入れますか？</Text>
            {selectedGoblin && (
              <>
                <Text style={styles.modalGoblinName}>{selectedGoblin.name}</Text>
                <Text style={styles.modalStats}>
                  Lv.{selectedGoblin.level}
                </Text>
                <View style={styles.modalStatsGrid}>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatValue}>{selectedGoblin.stats.hp}</Text>
                    <Text style={styles.modalStatLabel}>HP</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatValue}>{selectedGoblin.stats.atk}</Text>
                    <Text style={styles.modalStatLabel}>ATK</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatValue}>{selectedGoblin.stats.def}</Text>
                    <Text style={styles.modalStatLabel}>DEF</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatValue}>{selectedGoblin.stats.spd}</Text>
                    <Text style={styles.modalStatLabel}>SPD</Text>
                  </View>
                </View>
              </>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmAccept}>
                <Text style={styles.modalConfirmText}>受け入れる</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* アップグレード確認モーダル */}
      <Modal
        visible={upgradeModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setUpgradeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>拠点をアップグレード</Text>
            <Text style={styles.upgradeInfo}>
              ランク {rank} → {rank + 1}
            </Text>
            <Text style={styles.upgradeEffect}>
              収容人数: {capacity} → {capacity + 4}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setUpgradeModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, styles.upgradeConfirmButton]}
                onPress={handleConfirmUpgrade}
              >
                <Text style={styles.modalConfirmText}>アップグレード</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#374151',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  baseInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  baseLevelLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  baseLevelValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  capacityContainer: {
    marginBottom: 16,
  },
  capacityLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  capacityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  capacityBar: {
    height: 8,
    backgroundColor: '#4B5563',
    borderRadius: 4,
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  upgradeButton: {
    backgroundColor: '#3B82F6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pendingCard: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  goblinIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goblinIconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  goblinDetails: {
    flex: 1,
  },
  goblinName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goblinStats: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  goblinRace: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButtonDisabled: {
    backgroundColor: '#6B7280',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 32,
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  goblinListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  goblinMiniCard: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: 80,
  },
  goblinMiniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  goblinMiniAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  goblinMiniName: {
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  goblinMiniLevel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  moreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#374151',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modalGoblinName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
  },
  modalStats: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#4B5563',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  upgradeConfirmButton: {
    backgroundColor: '#3B82F6',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  upgradeInfo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 8,
  },
  upgradeEffect: {
    fontSize: 16,
    color: '#10B981',
    marginBottom: 24,
  },
})
