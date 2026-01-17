import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import type { Goblin, Factor } from '@/shared/types'
import { getFactor } from '@/shared/data/factors'

interface GoblinCardProps {
  goblin: Goblin
  onPress: () => void
}

function GoblinCard({ goblin, onPress }: GoblinCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>G</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.goblinName}>{goblin.name}</Text>
        <Text style={styles.goblinLevel}>Lv.{goblin.level}</Text>
        {goblin.factors && goblin.factors.length > 0 && (
          <View style={styles.factorRow}>
            {goblin.factors.slice(0, 3).map((factorId, idx) => {
              const factor = getFactor(factorId)
              return (
                <View key={idx} style={styles.factorBadge}>
                  <Text style={styles.factorText}>{factor?.name?.charAt(0) || '?'}</Text>
                </View>
              )
            })}
            {goblin.factors.length > 3 && (
              <Text style={styles.moreFactors}>+{goblin.factors.length - 3}</Text>
            )}
          </View>
        )}
      </View>
      <View style={styles.statsContainer}>
        <Text style={styles.statText}>HP:{goblin.stats.hp}</Text>
        <Text style={styles.statText}>ATK:{goblin.stats.atk}</Text>
      </View>
    </TouchableOpacity>
  )
}

interface GoblinDetailModalProps {
  goblin: Goblin | null
  visible: boolean
  onClose: () => void
}

function GoblinDetailModal({ goblin, visible, onClose }: GoblinDetailModalProps) {
  if (!goblin) return null

  const goblinFactors = goblin.factors?.map(factorId =>
    getFactor(factorId)
  ).filter((f): f is Factor => f !== undefined) || []

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{goblin.name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>基本情報</Text>
            <Text style={styles.detailText}>レベル: {goblin.level}</Text>
            <Text style={styles.detailText}>種族: {goblin.race}</Text>
            <Text style={styles.detailText}>経験値: {goblin.experience}</Text>
            {goblin.individualValue && (
              <Text style={styles.detailText}>個体値: {goblin.individualValue}</Text>
            )}
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>ステータス</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>HP</Text>
                <Text style={styles.statValue}>{goblin.stats.hp}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>ATK</Text>
                <Text style={styles.statValue}>{goblin.stats.atk}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>DEF</Text>
                <Text style={styles.statValue}>{goblin.stats.def}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>SPD</Text>
                <Text style={styles.statValue}>{goblin.stats.spd}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>SP</Text>
                <Text style={styles.statValue}>{goblin.stats.sp}</Text>
              </View>
            </View>
          </View>
          {goblinFactors.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>因子</Text>
              {goblinFactors.map((factor, idx) => (
                <View key={idx} style={styles.factorItem}>
                  <Text style={styles.factorIcon}>{factor.name.charAt(0)}</Text>
                  <View style={styles.factorInfo}>
                    <Text style={styles.factorName}>{factor.name}</Text>
                    <Text style={styles.factorDesc}>{factor.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {goblin.mods && goblin.mods.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Mod ({goblin.mods.length})</Text>
              {goblin.mods.map((mod, idx) => (
                <View key={idx} style={styles.modItem}>
                  <Text style={styles.modName}>{mod.templateId}</Text>
                  <Text style={styles.modEffect}>
                    値: {mod.value > 0 ? '+' : ''}{mod.value}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

export default function GoblinListScreen() {
  const { goblins, isLoading } = useGoblinService()
  const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

  const handleGoblinPress = useCallback((goblin: Goblin) => {
    setSelectedGoblin(goblin)
    setModalVisible(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalVisible(false)
    setSelectedGoblin(null)
  }, [])

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    )
  }

  if (goblins.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>G</Text>
        <Text style={styles.emptyTitle}>ゴブリンがいません</Text>
        <Text style={styles.emptyDescription}>
          拠点でゴブリンを受け入れると、ここに表示されます
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={goblins}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <GoblinCard goblin={item} onPress={() => handleGoblinPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <GoblinDetailModal
        goblin={selectedGoblin}
        visible={modalVisible}
        onClose={handleCloseModal}
      />
    </View>
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
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardInfo: {
    flex: 1,
  },
  goblinName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  goblinLevel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  factorRow: {
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
  },
  factorBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 4,
  },
  factorText: {
    fontSize: 12,
  },
  moreFactors: {
    fontSize: 10,
    color: '#6B7280',
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '33%',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  factorIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  factorInfo: {
    flex: 1,
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  factorDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  modName: {
    fontSize: 14,
    color: '#1F2937',
  },
  modEffect: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
})
