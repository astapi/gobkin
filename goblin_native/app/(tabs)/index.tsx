import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Goblin } from '@/shared/types'

// Sample data for demonstration
const sampleGoblins: Goblin[] = [
  {
    id: 1,
    name: 'Goburo',
    race: 'goblin',
    level: 5,
    experience: 120,
    avatar: 'goblin_1',
    stats: { hp: 30, atk: 12, def: 8, spd: 10, sp: 5 },
    factors: [],
    individualValue: 50,
  },
  {
    id: 2,
    name: 'Gobichi',
    race: 'goblin',
    level: 3,
    experience: 45,
    avatar: 'goblin_2',
    stats: { hp: 25, atk: 10, def: 6, spd: 12, sp: 4 },
    factors: [],
    individualValue: 60,
  },
  {
    id: 3,
    name: 'Gobimi',
    race: 'goblin',
    level: 7,
    experience: 280,
    avatar: 'goblin_3',
    stats: { hp: 40, atk: 18, def: 12, spd: 8, sp: 6 },
    factors: [],
    individualValue: 70,
  },
]

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
            <Text style={styles.sectionTitle}>Basic Info</Text>
            <Text style={styles.detailText}>Level: {goblin.level}</Text>
            <Text style={styles.detailText}>Race: {goblin.race}</Text>
            <Text style={styles.detailText}>EXP: {goblin.experience}</Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Stats</Text>
            <Text style={styles.detailText}>HP: {goblin.stats.hp}</Text>
            <Text style={styles.detailText}>ATK: {goblin.stats.atk}</Text>
            <Text style={styles.detailText}>DEF: {goblin.stats.def}</Text>
            <Text style={styles.detailText}>SPD: {goblin.stats.spd}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

export default function GoblinListScreen() {
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

  return (
    <View style={styles.container}>
      <FlatList
        data={sampleGoblins}
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
    marginTop: 4,
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
})
