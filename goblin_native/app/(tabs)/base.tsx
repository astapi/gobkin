import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Sample pending goblins
const pendingGoblins = [
  { id: 101, name: 'Newcomer Gob', level: 1, stats: { hp: 15, atk: 5, def: 3, spd: 8 } },
  { id: 102, name: 'Lost Goblin', level: 2, stats: { hp: 20, atk: 7, def: 4, spd: 9 } },
]

export default function BaseManagementScreen() {
  const [baseLevel] = useState(3)
  const [resources] = useState({ gold: 1250, food: 45 })
  const [selectedGoblin, setSelectedGoblin] = useState<typeof pendingGoblins[0] | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

  const handleAcceptGoblin = (goblin: typeof pendingGoblins[0]) => {
    setSelectedGoblin(goblin)
    setModalVisible(true)
  }

  const handleConfirmAccept = () => {
    // TODO: Implement accept logic
    console.log('Accepted goblin:', selectedGoblin?.name)
    setModalVisible(false)
    setSelectedGoblin(null)
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Base Status</Text>
        <View style={styles.card}>
          <View style={styles.baseInfo}>
            <Text style={styles.baseLevelLabel}>Base Level</Text>
            <Text style={styles.baseLevelValue}>{baseLevel}</Text>
          </View>
          <View style={styles.resourcesContainer}>
            <View style={styles.resourceItem}>
              <Text style={styles.resourceValue}>{resources.gold}</Text>
              <Text style={styles.resourceLabel}>Gold</Text>
            </View>
            <View style={styles.resourceItem}>
              <Text style={styles.resourceValue}>{resources.food}</Text>
              <Text style={styles.resourceLabel}>Food</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Goblins</Text>
        <Text style={styles.sectionSubtitle}>New goblins waiting to join your kingdom</Text>
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
                    Lv.{goblin.level} | HP:{goblin.stats.hp} ATK:{goblin.stats.atk}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptGoblin(goblin)}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No pending goblins at the moment</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Facilities</Text>
        <View style={styles.facilitiesGrid}>
          <TouchableOpacity style={styles.facilityCard}>
            <Text style={styles.facilityIcon}>T</Text>
            <Text style={styles.facilityName}>Training</Text>
            <Text style={styles.facilityLevel}>Lv.2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.facilityCard}>
            <Text style={styles.facilityIcon}>S</Text>
            <Text style={styles.facilityName}>Smithy</Text>
            <Text style={styles.facilityLevel}>Lv.1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.facilityCard}>
            <Text style={styles.facilityIcon}>F</Text>
            <Text style={styles.facilityName}>Farm</Text>
            <Text style={styles.facilityLevel}>Lv.3</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.facilityCard}>
            <Text style={styles.facilityIcon}>M</Text>
            <Text style={styles.facilityName}>Market</Text>
            <Text style={styles.facilityLevel}>Lv.1</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Accept Goblin?</Text>
            {selectedGoblin && (
              <>
                <Text style={styles.modalGoblinName}>{selectedGoblin.name}</Text>
                <Text style={styles.modalStats}>
                  Level {selectedGoblin.level} - HP:{selectedGoblin.stats.hp} ATK:{selectedGoblin.stats.atk} DEF:{selectedGoblin.stats.def}
                </Text>
              </>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmAccept}>
                <Text style={styles.modalConfirmText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  baseInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  baseLevelLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  baseLevelValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  resourcesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resourceItem: {
    alignItems: 'center',
  },
  resourceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  resourceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FCD34D',
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
    color: '#1F2937',
  },
  goblinStats: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  facilityCard: {
    width: '50%',
    padding: 6,
  },
  facilityIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 8,
  },
  facilityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  facilityLevel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalGoblinName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  modalStats: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
