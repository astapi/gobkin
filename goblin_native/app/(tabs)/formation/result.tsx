import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

// Sample result data
const sampleResult = {
  success: true,
  floorsCleared: 3,
  totalExp: 150,
  goldEarned: 85,
  itemsFound: ['Health Potion', 'Iron Sword'],
  casualties: 0,
}

export default function ExpeditionResultScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()

  const handleViewLog = () => {
    router.push({
      pathname: '/formation/log',
      params: { partyId },
    })
  }

  const handleBackToList = () => {
    router.replace('/formation')
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.resultBadge, sampleResult.success ? styles.successBadge : styles.failureBadge]}>
          <Text style={styles.resultText}>{sampleResult.success ? 'SUCCESS' : 'FAILED'}</Text>
        </View>
        <Text style={styles.title}>Expedition Complete</Text>
        <Text style={styles.subtitle}>Party #{partyId}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sampleResult.floorsCleared}</Text>
          <Text style={styles.statLabel}>Floors Cleared</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sampleResult.totalExp}</Text>
          <Text style={styles.statLabel}>EXP Gained</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sampleResult.goldEarned}</Text>
          <Text style={styles.statLabel}>Gold Earned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sampleResult.casualties}</Text>
          <Text style={styles.statLabel}>Casualties</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items Found</Text>
        <View style={styles.itemList}>
          {sampleResult.itemsFound.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <Text style={styles.itemName}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.logButton} onPress={handleViewLog}>
          <Text style={styles.logButtonText}>View Detailed Log</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneButton} onPress={handleBackToList}>
          <Text style={styles.doneButtonText}>Done</Text>
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
  header: {
    alignItems: 'center',
    padding: 24,
  },
  resultBadge: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  successBadge: {
    backgroundColor: '#10B981',
  },
  failureBadge: {
    backgroundColor: '#EF4444',
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  statCard: {
    width: '50%',
    padding: 8,
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#3B82F6',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
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
  itemList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  logButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  doneButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
