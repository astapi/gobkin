import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { useDungeonProgress } from '@/presentation/hooks/useDungeonProgress'
import { useExpeditionService } from '@/presentation/hooks/useExpeditionService'
import { CompleteExpeditionUseCase } from '@/core/usecases'
import type { TimelineEvent, ExpeditionReplay, ExpeditionRecord } from '@/shared/types'
import type { BattleLogEntry } from '@/shared/types'

interface LogEntry {
  id: string
  text: string
  detail?: BattleLogEntry[]
}

export default function ExpeditionPlaybackScreen() {
  const { partyId, expeditionId } = useLocalSearchParams<{
    partyId?: string
    expeditionId?: string
  }>()

  const { getPartyById, partyRepository, isLoading: isPartyLoading } = usePartyService()
  const { goblins, goblinRepository, isLoading: isGoblinLoading } = useGoblinService()
  const { dungeons } = useDungeonProgress()
  const {
    expeditionRecords,
    getExpeditionById,
    getPartyExpeditionHistory,
    completeExpeditionRecord,
    isLoading: isExpeditionLoading,
  } = useExpeditionService()

  const expeditionRecord = useMemo<ExpeditionRecord | null>(() => {
    if (expeditionId) {
      return getExpeditionById(expeditionId)
    }
    const numericPartyId = partyId ? Number.parseInt(partyId, 10) : NaN
    if (Number.isNaN(numericPartyId)) return null
    const history = getPartyExpeditionHistory(numericPartyId, 1)
    return history[0] ?? null
  }, [expeditionId, partyId, getExpeditionById, getPartyExpeditionHistory, expeditionRecords])

  const resolvedPartyId = useMemo(() => {
    if (expeditionRecord) return expeditionRecord.partyId
    const numericPartyId = partyId ? Number.parseInt(partyId, 10) : NaN
    return Number.isNaN(numericPartyId) ? null : numericPartyId
  }, [expeditionRecord, partyId])

  const party = useMemo(() => {
    if (!resolvedPartyId || isPartyLoading) return null
    try {
      return getPartyById(resolvedPartyId)
    } catch {
      return null
    }
  }, [resolvedPartyId, getPartyById, isPartyLoading])

  const dungeon = useMemo(() => {
    const id = expeditionRecord?.dungeonId || party?.dungeonId
    return dungeons.find(d => d.id === id)
  }, [dungeons, expeditionRecord?.dungeonId, party?.dungeonId])

  const [eventLog, setEventLog] = useState<LogEntry[]>([])
  const [partyHp, setPartyHp] = useState<number[]>([])
  const [currentFloor, setCurrentFloor] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [replay, setReplay] = useState<ExpeditionReplay | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedBattleLog, setSelectedBattleLog] = useState<BattleLogEntry[] | null>(null)

  const progressAnim = useRef(new Animated.Value(0)).current
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimestampRef = useRef<number>(0)
  const baseTimeRef = useRef<number>(0)
  const processedEventIndexRef = useRef(0)
  const hasCompletedRef = useRef(false)
  const logIdRef = useRef(0)

  const completeExpeditionUseCase = useMemo(() => {
    return new CompleteExpeditionUseCase(goblinRepository, partyRepository)
  }, [goblinRepository, partyRepository])

  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [])

  const getReturnReasonText = useCallback((reason: TimelineEvent extends { reason: infer R } ? R : never) => {
    if (reason === 'completed') return '探索完了'
    if (reason === 'defeated') return '全滅により撤退'
    if (reason === 'policy_return') return '帰還'
    if (reason === 'abort') return '緊急帰還'
    return '探索完了'
  }, [])

  const buildLogEntries = useCallback((event: TimelineEvent): LogEntry[] => {
    const createEntry = (text: string, detail?: BattleLogEntry[]) => {
      logIdRef.current += 1
      return { id: `${logIdRef.current}`, text, detail }
    }
    switch (event.type) {
      case 'move_start':
        return [createEntry(`${event.floor}階の探索を開始`)]
      case 'floor_up':
        return [createEntry(`${event.from}階から${event.to}階へ移動`)]
      case 'exploring':
        return [createEntry('探索中...')]
      case 'battle':
      case 'boss': {
        const label = event.type === 'boss' ? 'ボス' : '戦闘'
        const result = event.combat.outcome === 'win' ? '勝利' : '敗北'
        const entries: LogEntry[] = [
          createEntry(
            `${label} ${event.enemy.name} Lv${event.enemy.lvl} ×${event.enemy.count}体と遭遇 → ${result}[詳細]`,
            event.combat.detailedLog,
          ),
        ]
        if (event.xp > 0) {
          entries.push(createEntry(`${event.xp}XP獲得`))
        }
        return entries
      }
      case 'return':
        return [createEntry(getReturnReasonText(event.reason))]
      default:
        return [createEntry('イベント発生')]
    }
  }, [getReturnReasonText])

  const applyEvent = useCallback((event: TimelineEvent, eventTime: number) => {
    const entries = buildLogEntries(event)
    setEventLog(prev => [
      ...prev,
      ...entries.map(entry => ({
        ...entry,
        text: `[${formatTime(eventTime)}] ${entry.text}`,
      })),
    ])

    if (event.type === 'floor_up') {
      setCurrentFloor(event.to)
    }
    if (event.type === 'move_start') {
      setCurrentFloor(event.floor)
    }
    if (event.type === 'battle' || event.type === 'boss') {
      if (event.combat.allyHPDelta) {
        setPartyHp(prev => {
          const updated = [...prev]
          event.combat.allyHPDelta.forEach((delta, idx) => {
            updated[idx] = Math.max(0, (updated[idx] ?? 0) + delta)
          })
          return updated
        })
      }
    }
  }, [buildLogEntries, formatTime])

  const playbackEvents = useMemo(() => {
    if (!replay) return []
    const events = replay.events.map(event => ({ ...event }))
    let maxAt = 0
    for (const event of events) {
      if (event.at > maxAt) maxAt = event.at
    }
    if (events.length > 0) {
      const last = events[events.length - 1]
      if (last.type === 'return' && last.at < maxAt) {
        last.at = maxAt
      }
    }
    return events
  }, [replay])

  const playbackDuration = useMemo(() => {
    if (!replay) return 0
    const maxAt = playbackEvents.reduce((max, event) => Math.max(max, event.at), 0)
    return Math.max(replay.durationSec, maxAt)
  }, [replay, playbackEvents])

  const initialTime = useMemo(() => {
    if (!replay || !expeditionRecord) return 0
    const elapsedSec = (Date.now() - expeditionRecord.startTime.getTime()) / 1000
    return Math.min(Math.max(0, elapsedSec), playbackDuration)
  }, [replay, expeditionRecord, playbackDuration])

  const completePlayback = useCallback(async () => {
    if (!expeditionRecord || !replay || hasCompletedRef.current) return
    hasCompletedRef.current = true

    if (expeditionRecord.status !== 'ongoing') {
      return
    }

    try {
      await completeExpeditionUseCase.execute(expeditionRecord.partyId, replay)
      completeExpeditionRecord(expeditionRecord.id, replay)
    } catch (error) {
      console.warn('[Playback] Failed to complete expedition', error)
    }
  }, [expeditionRecord, replay, completeExpeditionUseCase, completeExpeditionRecord])

  useEffect(() => {
    if (isPartyLoading || isGoblinLoading || isExpeditionLoading) return
    if (!expeditionRecord) {
      setErrorMessage('遠征データが見つかりません')
      return
    }
    if (!expeditionRecord.replay) {
      setErrorMessage(null)
      setReplay(null)
      return
    }

    setErrorMessage(null)
    setReplay(expeditionRecord.replay)
  }, [expeditionRecord, isPartyLoading, isGoblinLoading, isExpeditionLoading])

  useEffect(() => {
    if (!replay) return
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current)
    }

    const initialPartyHp = replay.meta.party.map(memberId => {
      const goblin = goblins.find(g => g.id === parseInt(memberId, 10))
      return goblin?.stats.hp ?? 100
    })
    let tempHp = [...initialPartyHp]
    let tempFloor = 1
    const preloadedLogs: LogEntry[] = []
    let nextIndex = 0

    while (nextIndex < playbackEvents.length && playbackEvents[nextIndex].at <= initialTime) {
      const event = playbackEvents[nextIndex]
      const entries = buildLogEntries(event)
      preloadedLogs.push(
        ...entries.map(entry => ({
          ...entry,
          text: `[${formatTime(event.at)}] ${entry.text}`,
        }))
      )
      if (event.type === 'floor_up') {
        tempFloor = event.to
      }
      if (event.type === 'move_start') {
        tempFloor = event.floor
      }
      if (event.type === 'battle' || event.type === 'boss') {
        if (event.combat.allyHPDelta) {
          event.combat.allyHPDelta.forEach((delta, idx) => {
            tempHp[idx] = Math.max(0, (tempHp[idx] ?? 0) + delta)
          })
        }
      }
      nextIndex += 1
    }

    setEventLog(preloadedLogs)
    setPartyHp(tempHp)
    setCurrentFloor(tempFloor)
    processedEventIndexRef.current = nextIndex
    hasCompletedRef.current = false
    baseTimeRef.current = initialTime
    startTimestampRef.current = Date.now()
    setCurrentTime(initialTime)

    const progress = playbackDuration > 0 ? initialTime / playbackDuration : 1
    progressAnim.setValue(progress)

    if (initialTime >= playbackDuration) {
      void completePlayback()
      return
    }

    const remainingMs = (playbackDuration - initialTime) * 1000
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: remainingMs,
      useNativeDriver: false,
    }).start()

    playbackTimerRef.current = setInterval(() => {
      const elapsedSec = (Date.now() - startTimestampRef.current) / 1000
      const timeNow = Math.min(baseTimeRef.current + elapsedSec, playbackDuration)
      setCurrentTime(timeNow)

      while (
        processedEventIndexRef.current < playbackEvents.length &&
        playbackEvents[processedEventIndexRef.current].at <= timeNow
      ) {
        const event = playbackEvents[processedEventIndexRef.current]
        applyEvent(event, event.at)
        processedEventIndexRef.current += 1
      }

      if (timeNow >= playbackDuration) {
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current)
        }
        completePlayback()
      }
    }, 400)

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
      }
    }
  }, [
    replay,
    buildLogEntries,
    formatTime,
    completePlayback,
    progressAnim,
    initialTime,
    goblins,
    applyEvent,
    playbackEvents,
    playbackDuration,
  ])

  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
      }
    }
  }, [])

  if (!expeditionRecord || !dungeon || !replay) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{errorMessage ?? '読み込み中...'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const progressText = `${formatTime(currentTime)} / ${formatTime(playbackDuration)}`

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{dungeon.name} - ログ閲覧</Text>
        <View style={styles.navSpacer} />
      </View>

      <View style={styles.statusBar}>
        <View style={styles.statusRow}>
          <Text style={styles.statusTitle}>{dungeon.name} - {currentFloor}階</Text>
          <Text style={styles.statusTimer}>{progressText}</Text>
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
      </View>

      <View style={styles.partyGrid}>
        {replay.meta.party.map((memberId, index) => {
          const goblin = goblins.find(g => g.id === parseInt(memberId, 10))
          const maxHp = goblin?.stats.hp ?? 100
          const currentHp = partyHp[index] ?? maxHp
          return (
            <View key={memberId} style={styles.partyCard}>
              <Text style={styles.partyNameText}>{goblin?.name || `ID:${memberId}`}</Text>
              <View style={styles.hpBar}>
                <View
                  style={[
                    styles.hpBarFill,
                    { width: `${Math.min(100, (currentHp / maxHp) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.hpText}>HP: {currentHp}/{maxHp}</Text>
            </View>
          )
        })}
      </View>

      <View style={styles.eventLog}>
        <ScrollView style={styles.logScroll}>
          {eventLog.map(entry => (
            <Text key={entry.id} style={styles.logText}>
              {entry.text.replace('[詳細]', '')}
              {entry.detail && (
                <Text style={styles.logDetail} onPress={() => setSelectedBattleLog(entry.detail!)}>
                  [詳細]
                </Text>
              )}
            </Text>
          ))}
        </ScrollView>
      </View>

      <Modal
        visible={Boolean(selectedBattleLog)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBattleLog(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>戦闘ログ</Text>
              <TouchableOpacity onPress={() => setSelectedBattleLog(null)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedBattleLog?.map((entry, index) => {
                if (entry.action === 'turn_start' && entry.turnState) {
                  return (
                    <View key={`turn-${entry.turn}-${index}`} style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Turn {entry.turn} 開始</Text>
                      <Text style={styles.modalLabel}>味方:</Text>
                      {entry.turnState.allies.map(ally => (
                        <Text key={ally.id} style={styles.modalText}>
                          {ally.name} {ally.currentHP}/{ally.maxHP} HP
                        </Text>
                      ))}
                      <Text style={styles.modalLabel}>敵:</Text>
                      {entry.turnState.enemies.map((enemy, enemyIndex) => (
                        <Text key={`${enemy.id}-${enemyIndex}`} style={styles.modalText}>
                          {enemy.name} {enemy.currentHP}/{enemy.maxHP} HP
                        </Text>
                      ))}
                    </View>
                  )
                }

                if (entry.action === 'turn_start') {
                  return null
                }

                return (
                  <View key={`log-${index}`} style={styles.modalLogCard}>
                    <Text style={styles.modalLogTitle}>
                      {entry.actorName}の攻撃 ({entry.actorHP ?? 0}HP)
                    </Text>
                    <Text style={styles.modalText}>{entry.actorName}の{entry.action}！</Text>
                    {entry.targetName && typeof entry.damage === 'number' && (
                      <Text style={styles.modalText}>
                        {entry.targetName}に{entry.damage}ダメージを与え{entry.targetDefeated ? '倒した！' : 'た！'}
                      </Text>
                    )}
                  </View>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  navBack: {
    fontSize: 14,
    color: '#374151',
  },
  navTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  navSpacer: {
    width: 60,
  },
  statusBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1F2937',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  statusTimer: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  partyCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partyNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  hpBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  hpBarFill: {
    height: '100%',
    backgroundColor: '#374151',
  },
  hpText: {
    marginTop: 6,
    fontSize: 11,
    color: '#6B7280',
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#9CA3AF',
    borderRadius: 3,
  },
  eventLog: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'Courier',
    marginBottom: 6,
  },
  logDetail: {
    color: '#2563EB',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  modalClose: {
    fontSize: 20,
    color: '#F9FAFB',
    paddingHorizontal: 8,
  },
  modalBody: {
    padding: 12,
  },
  modalSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 6,
  },
  modalText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
  },
  modalLogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalLogTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
})
