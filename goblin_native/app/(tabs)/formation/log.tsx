import { useMemo, useCallback, useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'

interface LogEntry {
  time: string
  event: string
  type: 'move' | 'battle' | 'item' | 'victory' | 'defeat' | 'info'
}

// イベントタイプに基づいて色を返す
const getEventColor = (type: LogEntry['type']): string => {
  switch (type) {
    case 'move':
      return '#3B82F6'
    case 'battle':
      return '#EF4444'
    case 'item':
      return '#F59E0B'
    case 'victory':
      return '#10B981'
    case 'defeat':
      return '#DC2626'
    case 'info':
    default:
      return '#6B7280'
  }
}

export default function ExpeditionLogScreen() {
  const { partyId, dungeonId } = useLocalSearchParams<{ partyId: string; dungeonId?: string }>()

  const getPartyById = usePartyStore((state) => state.getPartyById)
  const dungeons = useDungeonStore((state) => state.dungeons)

  const [party, setParty] = useState<Awaited<ReturnType<typeof getPartyById>> | null>(null)

  useEffect(() => {
    if (!partyId) {
      setParty(null)
      return
    }
    void getPartyById(parseInt(partyId, 10)).then(p => setParty(p)).catch(() => setParty(null))
  }, [partyId, getPartyById])

  const dungeon = useMemo(() => {
    const id = dungeonId || party?.dungeonId
    return dungeons.find(d => d.id === id)
  }, [dungeons, dungeonId, party?.dungeonId])

  // サンプルログデータ（将来的にはExpeditionRepositoryから取得）
  const logEntries: LogEntry[] = useMemo(() => {
    if (!dungeon) return []

    const entries: LogEntry[] = []
    const floors = dungeon.floors || 3

    entries.push({
      time: '00:00',
      event: `${dungeon.name}への遠征を開始`,
      type: 'move',
    })

    for (let floor = 1; floor <= floors; floor++) {
      const baseTime = floor * 10
      entries.push({
        time: `00:${String(baseTime).padStart(2, '0')}`,
        event: `${floor}階に到達`,
        type: 'move',
      })

      // ランダムなイベントをシミュレート
      entries.push({
        time: `00:${String(baseTime + 2).padStart(2, '0')}`,
        event: '敵と遭遇！',
        type: 'battle',
      })

      entries.push({
        time: `00:${String(baseTime + 5).padStart(2, '0')}`,
        event: '戦闘に勝利！経験値を獲得',
        type: 'victory',
      })

      if (floor % 2 === 0) {
        entries.push({
          time: `00:${String(baseTime + 7).padStart(2, '0')}`,
          event: '宝箱を発見！',
          type: 'item',
        })
      }
    }

    entries.push({
      time: `00:${String(floors * 10 + 10).padStart(2, '0')}`,
      event: 'ボスと遭遇！',
      type: 'battle',
    })

    entries.push({
      time: `00:${String(floors * 10 + 15).padStart(2, '0')}`,
      event: 'ボスを撃破！ダンジョン踏破',
      type: 'victory',
    })

    return entries
  }, [dungeon])

  const handleBack = useCallback(() => {
    router.back()
  }, [])

  if (!party) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>遠征ログ</Text>
        <Text style={styles.subtitle}>
          {party.name} → {dungeon?.name || '不明'}
        </Text>
      </View>

      <FlatList
        data={logEntries}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item }) => (
          <View style={styles.logItem}>
            <View style={[styles.logDot, { backgroundColor: getEventColor(item.type) }]} />
            <View style={styles.logContent}>
              <Text style={styles.logTime}>{item.time}</Text>
              <Text style={styles.logEvent}>{item.event}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backButtonText}>戻る</Text>
      </TouchableOpacity>
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
  header: {
    padding: 20,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
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
  listContent: {
    padding: 16,
  },
  separator: {
    height: 4,
  },
  logItem: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  logContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    width: 50,
  },
  logEvent: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  backButton: {
    backgroundColor: '#374151',
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
