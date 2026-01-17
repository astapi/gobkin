import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

export default function ExpeditionPreparationScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()

  const handleEditParty = () => {
    router.push({
      pathname: '/formation/edit',
      params: { partyId },
    })
  }

  const handleStartExpedition = () => {
    router.push({
      pathname: '/formation/playback',
      params: { partyId },
    })
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Party #{partyId}</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>Party members will be displayed here</Text>
          <TouchableOpacity style={styles.editButton} onPress={handleEditParty}>
            <Text style={styles.editButtonText}>Edit Members</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dungeon Selection</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dungeonOption}>
            <Text style={styles.dungeonName}>Forest Outskirts</Text>
            <Text style={styles.dungeonInfo}>Floors: 3 | Difficulty: Easy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dungeonOption}>
            <Text style={styles.dungeonName}>Mossy Cave</Text>
            <Text style={styles.dungeonInfo}>Floors: 5 | Difficulty: Normal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dungeonOption}>
            <Text style={styles.dungeonName}>Old Mine</Text>
            <Text style={styles.dungeonInfo}>Floors: 7 | Difficulty: Hard</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Return Policy</Text>
        <View style={styles.card}>
          <TouchableOpacity style={[styles.policyOption, styles.policySelected]}>
            <Text style={styles.policyName}>Never Retreat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.policyOption}>
            <Text style={styles.policyName}>If Any KO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.policyOption}>
            <Text style={styles.policyName}>Last One Standing</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.startButton} onPress={handleStartExpedition}>
          <Text style={styles.startButtonText}>Start Expedition</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  editButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  dungeonOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dungeonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  dungeonInfo: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  policyOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  policySelected: {
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  policyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  startButton: {
    flex: 2,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
