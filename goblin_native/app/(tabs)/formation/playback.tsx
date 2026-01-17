import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { useDungeonProgress } from '@/presentation/hooks/useDungeonProgress'
import type { TimelineEvent, Goblin } from '@/shared/types'

interface DisplayEvent {
  type: string
  message: string
  color: string
  icon: string
}

export default function ExpeditionPlaybackScreen() {
  const { partyId, dungeonId, returnPolicy } = useLocalSearchParams<{
    partyId: string
    dungeonId: string
    returnPolicy: string
  }>()

  const { getPartyById, markExpedition, markIdle } = usePartyService()
  const { goblins } = useGoblinService()
  const { dungeons } = useDungeonProgress()

  const party = useMemo(() => {
    if (!partyId) return null
    return getPartyById(parseInt(partyId, 10))
  }, [partyId, getPartyById])

  const dungeon = useMemo(() => {
    const id = dungeonId || party?.dungeonId
    return dungeons.find(d => d.id === id)
  }, [dungeons, dungeonId, party?.dungeonId])

  const partyMembers = useMemo(() => {
    if (!party) return []
    return party.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }, [party, goblins])

  const [events, setEvents] = useState<DisplayEvent[]>([])
  const [currentEventIndex, setCurrentEventIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [expeditionResult, setExpeditionResult] = useState<{
    success: boolean
    xpGained: number
    maxFloor: number
  } | null>(null)

  const progressAnim = useRef(new Animated.Value(0)).current

  // 遠征イベントをシミュレート
  useEffect(() => {
    if (!dungeon || !party || partyMembers.length === 0) return

    // パーティを遠征状態に設定
    markExpedition(party.id)

    const floors = dungeon.floors
    const generatedEvents: DisplayEvent[] = []

    // 開始イベント
    generatedEvents.push({
      type: 'move_start',
      message: `${dungeon.name}への遠征を開始...`,
      color: '#6B7280',
      icon: '>',
    })

    // 各階層のイベントを生成
    for (let floor = 1; floor <= floors; floor++) {
      generatedEvents.push({
        type: 'floor_arrive',
        message: `${floor}階に到着`,
        color: '#3B82F6',
        icon: 'F',
      })

      // ランダムなイベント
      const eventRoll = Math.random()
      if (eventRoll < 0.7) {
        // 戦闘
        generatedEvents.push({
          type: 'encounter',
          message: `敵と遭遇！`,
          color: '#F59E0B',
          icon: '!',
        })
        generatedEvents.push({
          type: 'battle',
          message: '戦闘中...',
          color: '#EF4444',
          icon: 'X',
        })
        generatedEvents.push({
          type: 'victory',
          message: `勝利！経験値を獲得`,
          color: '#10B981',
          icon: 'V',
        })
      } else if (eventRoll < 0.9) {
        // 探索
        generatedEvents.push({
          type: 'exploring',
          message: '探索中...',
          color: '#8B5CF6',
          icon: '?',
        })
      }
    }

    // ボス戦
    generatedEvents.push({
      type: 'boss',
      message: `ボス出現！`,
      color: '#DC2626',
      icon: 'B',
    })
    generatedEvents.push({
      type: 'battle',
      message: '激闘中...',
      color: '#EF4444',
      icon: 'X',
    })

    // 結果（80%の確率で成功）
    const success = Math.random() < 0.8
    if (success) {
      generatedEvents.push({
        type: 'complete',
        message: 'ダンジョン踏破！',
        color: '#10B981',
        icon: '*',
      })
    } else {
      generatedEvents.push({
        type: 'return',
        message: '撤退...',
        color: '#EF4444',
        icon: '<',
      })
    }

    setEvents(generatedEvents)
    setExpeditionResult({
      success,
      xpGained: floors * 50 + (success ? 100 : 0),
      maxFloor: success ? floors : Math.floor(floors * 0.7),
    })

    // プログレスアニメーション
    const duration = generatedEvents.length * 800
    Animated.timing(progressAnim, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start()

    // イベント進行
    let eventIndex = 0
    const interval = setInterval(() => {
      if (eventIndex < generatedEvents.length - 1) {
        eventIndex++
        setCurrentEventIndex(eventIndex)
      } else {
        setIsComplete(true)
        markIdle(party.id)
        clearInterval(interval)
      }
    }, 800)

    return () => {
      clearInterval(interval)
      if (party) {
        markIdle(party.id)
      }
    }
  }, [dungeon, party, partyMembers.length])

  const handleViewResults = useCallback(() => {
    router.replace({
      pathname: '/formation/result',
      params: {
        partyId,
        dungeonId: dungeonId || party?.dungeonId || '',
        success: expeditionResult?.success ? 'true' : 'false',
        xpGained: String(expeditionResult?.xpGained || 0),
        maxFloor: String(expeditionResult?.maxFloor || 0),
      },
    })
  }, [partyId, dungeonId, party?.dungeonId, expeditionResult])

  if (!party || !dungeon) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const currentEvent = events[currentEventIndex]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>遠征中</Text>
        <Text style={styles.subtitle}>{party.name} → {dungeon.name}</Text>
      </View>

      <View style={styles.partyInfo}>
        {partyMembers.map(member => (
          <View key={member.id} style={styles.memberBadge}>
            <Text style={styles.memberIcon}>G</Text>
            <Text style={styles.memberName}>{member.name}</Text>
          </View>
        ))}
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

      {currentEvent && (
        <View style={styles.eventContainer}>
          <View style={[styles.eventIcon, { backgroundColor: currentEvent.color }]}>
            <Text style={styles.eventIconText}>{currentEvent.icon}</Text>
          </View>
          <Text style={styles.eventMessage}>{currentEvent.message}</Text>
        </View>
      )}

      <View style={styles.eventLog}>
        <Text style={styles.logTitle}>イベントログ</Text>
        <ScrollView style={styles.logScroll}>
          {events.slice(0, currentEventIndex + 1).reverse().map((event, index) => (
            <View key={index} style={styles.logItem}>
              <View style={[styles.logDot, { backgroundColor: event.color }]} />
              <Text style={styles.logText}>{event.message}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {isComplete && (
        <TouchableOpacity style={styles.resultButton} onPress={handleViewResults}>
          <Text style={styles.resultButtonText}>結果を見る</Text>
        </TouchableOpacity>
      )}
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
  partyInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  memberIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  memberName: {
    fontSize: 12,
    color: '#FFFFFF',
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
  logScroll: {
    flex: 1,
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
