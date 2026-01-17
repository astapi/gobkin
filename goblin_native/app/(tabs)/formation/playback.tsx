import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'

// Simulated expedition events
const sampleEvents = [
  { time: 0, type: 'move_start', message: 'Party enters the dungeon...' },
  { time: 1000, type: 'floor_arrive', message: 'Arrived at Floor 1' },
  { time: 2000, type: 'encounter', message: 'Encountered Slime x2!' },
  { time: 3000, type: 'battle', message: 'Battle in progress...' },
  { time: 4000, type: 'victory', message: 'Victory! Gained 50 EXP' },
  { time: 5000, type: 'floor_arrive', message: 'Arrived at Floor 2' },
  { time: 6000, type: 'treasure', message: 'Found a treasure chest!' },
  { time: 7000, type: 'floor_arrive', message: 'Arrived at Floor 3' },
  { time: 8000, type: 'boss', message: 'Boss appeared: Giant Slime!' },
  { time: 9000, type: 'battle', message: 'Epic battle!' },
  { time: 10000, type: 'complete', message: 'Expedition Complete!' },
]

export default function ExpeditionPlaybackScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const [currentEventIndex, setCurrentEventIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const progressAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 10000,
      useNativeDriver: false,
    }).start()

    // Event progression
    const interval = setInterval(() => {
      setCurrentEventIndex((prev) => {
        if (prev < sampleEvents.length - 1) {
          return prev + 1
        }
        setIsComplete(true)
        clearInterval(interval)
        return prev
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleViewResults = () => {
    router.replace({
      pathname: '/formation/result',
      params: { partyId },
    })
  }

  const currentEvent = sampleEvents[currentEventIndex]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expedition in Progress</Text>
        <Text style={styles.subtitle}>Party #{partyId}</Text>
      </View>

      <View style={styles.progressContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <View style={styles.eventContainer}>
        <View style={[styles.eventIcon, { backgroundColor: getEventColor(currentEvent.type) }]}>
          <Text style={styles.eventIconText}>{getEventIcon(currentEvent.type)}</Text>
        </View>
        <Text style={styles.eventMessage}>{currentEvent.message}</Text>
      </View>

      <View style={styles.eventLog}>
        <Text style={styles.logTitle}>Event Log</Text>
        {sampleEvents.slice(0, currentEventIndex + 1).reverse().map((event, index) => (
          <View key={index} style={styles.logItem}>
            <View style={[styles.logDot, { backgroundColor: getEventColor(event.type) }]} />
            <Text style={styles.logText}>{event.message}</Text>
          </View>
        ))}
      </View>

      {isComplete && (
        <TouchableOpacity style={styles.resultButton} onPress={handleViewResults}>
          <Text style={styles.resultButtonText}>View Results</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

function getEventColor(type: string): string {
  const colors: Record<string, string> = {
    move_start: '#6B7280',
    floor_arrive: '#3B82F6',
    encounter: '#F59E0B',
    battle: '#EF4444',
    victory: '#10B981',
    treasure: '#8B5CF6',
    boss: '#DC2626',
    complete: '#10B981',
  }
  return colors[type] || '#6B7280'
}

function getEventIcon(type: string): string {
  const icons: Record<string, string> = {
    move_start: '>',
    floor_arrive: 'F',
    encounter: '!',
    battle: 'X',
    victory: 'V',
    treasure: '$',
    boss: 'B',
    complete: '*',
  }
  return icons[type] || '?'
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#374151',
    marginHorizontal: 20,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  eventContainer: {
    alignItems: 'center',
    padding: 40,
  },
  eventIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eventIconText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  eventMessage: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  eventLog: {
    flex: 1,
    backgroundColor: '#111827',
    margin: 20,
    borderRadius: 12,
    padding: 16,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 12,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  logText: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  resultButton: {
    backgroundColor: '#10B981',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
})
