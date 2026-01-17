import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

// Sample log data
const sampleLog = [
  { time: '00:00', event: 'Party enters Forest Outskirts' },
  { time: '00:05', event: 'Arrived at Floor 1' },
  { time: '00:10', event: 'Encountered Slime x2' },
  { time: '00:15', event: 'Goburo attacks Slime for 12 damage' },
  { time: '00:16', event: 'Gobichi attacks Slime for 8 damage' },
  { time: '00:17', event: 'Slime defeated!' },
  { time: '00:20', event: 'Victory! Gained 25 EXP' },
  { time: '00:30', event: 'Found treasure chest containing Health Potion' },
  { time: '00:35', event: 'Arrived at Floor 2' },
  { time: '00:40', event: 'Encountered Wolf x1' },
  { time: '00:45', event: 'Goburo attacks Wolf for 15 damage' },
  { time: '00:46', event: 'Wolf attacks Gobichi for 5 damage' },
  { time: '00:47', event: 'Gobichi attacks Wolf for 10 damage' },
  { time: '00:48', event: 'Wolf defeated!' },
  { time: '00:50', event: 'Victory! Gained 40 EXP' },
  { time: '01:00', event: 'Arrived at Floor 3' },
  { time: '01:05', event: 'Boss encountered: Giant Slime' },
  { time: '01:10', event: 'Goburo uses Power Strike for 25 damage' },
  { time: '01:12', event: 'Giant Slime attacks party for 8 damage' },
  { time: '01:15', event: 'Gobichi heals party for 10 HP' },
  { time: '01:20', event: 'Goburo attacks for 12 damage' },
  { time: '01:22', event: 'Giant Slime defeated!' },
  { time: '01:25', event: 'Expedition Complete! Found Iron Sword' },
]

export default function ExpeditionLogScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()

  const handleBack = () => {
    router.back()
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expedition Log</Text>
        <Text style={styles.subtitle}>Party #{partyId}</Text>
      </View>

      <FlatList
        data={sampleLog}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item }) => (
          <View style={styles.logItem}>
            <Text style={styles.logTime}>{item.time}</Text>
            <Text style={styles.logEvent}>{item.event}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backButtonText}>Back to Results</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 8,
  },
  logItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    width: 50,
  },
  logEvent: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  backButton: {
    backgroundColor: '#3B82F6',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
