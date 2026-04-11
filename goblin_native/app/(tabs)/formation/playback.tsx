import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { useExpeditionStore } from '@/presentation/stores/useExpeditionStore'
import type { TimelineEvent, ExpeditionReplay, ExpeditionRecord, ExpeditionEndReason, Party, TreasureDrop } from '@/shared/types'
import type { BattleLogEntry, BattleLogMeta } from '@/shared/types'
import { storeBattleLog } from '@/presentation/contexts/battleLogStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import { getDungeonName, getEquipmentDisplayName } from '@/shared/i18n/entityLocalization'
import { getEquipmentTemplate } from '@/shared/data/equipmentPoolLoader'
import { getDungeonTierDisplayName } from '@/shared/types'

interface LogEntry {
  id: string
  text: string
  detail?: BattleLogEntry[]
  meta?: BattleLogMeta
}

function resolveTreasureName(item: TreasureDrop): string {
  const template = getEquipmentTemplate(item.templateId)
  if (!template) {
    throw new Error(`Unknown equipment template: ${item.templateId}`)
  }
  return getEquipmentDisplayName(item, template)
}

export default function ExpeditionPlaybackScreen() {
  const { t } = useTranslation()
  const { partyId, expeditionId } = useLocalSearchParams<{
    partyId?: string
    expeditionId?: string
  }>()

  const getPartyById = usePartyStore((state) => state.getPartyById)
  const isPartyLoading = usePartyStore((state) => state.isLoading)
  const isGoblinLoading = useGoblinStore((state) => state.isLoading)
  const dungeons = useDungeonStore((state) => state.dungeons)
  const {
    expeditionRecords,
    getExpeditionById,
    getPartyExpeditionHistory,
    isLoading: isExpeditionLoading,
  } = useExpeditionStore()

  const [expeditionRecord, setExpeditionRecord] = useState<ExpeditionRecord | null>(null)

  useEffect(() => {
    void (async () => {
      if (expeditionId) {
        const record = await getExpeditionById(expeditionId)
        setExpeditionRecord(record)
        return
      }
      const numericPartyId = partyId ? Number.parseInt(partyId, 10) : NaN
      if (Number.isNaN(numericPartyId)) {
        setExpeditionRecord(null)
        return
      }
      const history = await getPartyExpeditionHistory(numericPartyId, 1)
      setExpeditionRecord(history[0] ?? null)
    })()
  }, [expeditionId, partyId, getExpeditionById, getPartyExpeditionHistory, expeditionRecords])

  const resolvedPartyId = useMemo(() => {
    if (expeditionRecord) return expeditionRecord.partyId
    const numericPartyId = partyId ? Number.parseInt(partyId, 10) : NaN
    return Number.isNaN(numericPartyId) ? null : numericPartyId
  }, [expeditionRecord, partyId])

  const [party, setParty] = useState<Party | null>(null)

  useEffect(() => {
    if (!resolvedPartyId || isPartyLoading) {
      setParty(null)
      return
    }
    void getPartyById(resolvedPartyId).then(p => setParty(p)).catch(() => setParty(null))
  }, [resolvedPartyId, getPartyById, isPartyLoading])

  const dungeon = useMemo(() => {
    const id = expeditionRecord?.dungeonId || party?.dungeonId
    return dungeons.find(d => d.id === id)
  }, [dungeons, expeditionRecord?.dungeonId, party?.dungeonId])

  const dungeonDisplayName = useMemo(() => {
    if (!dungeon) return ''
    return getDungeonTierDisplayName(getDungeonName(dungeon), expeditionRecord?.replay?.meta.tier ?? 0)
  }, [dungeon, expeditionRecord?.replay?.meta.tier])

  const [eventLog, setEventLog] = useState<LogEntry[]>([])
  const [partyHp, setPartyHp] = useState<number[]>([])
  const [currentFloor, setCurrentFloor] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [replay, setReplay] = useState<ExpeditionReplay | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const partyGoblins = useMemo(() => {
    if (!replay?.meta.partySnapshot) return []
    return replay.meta.partySnapshot
  }, [replay])

  const progressAnim = useRef(new Animated.Value(0)).current
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimestampRef = useRef<number>(0)
  const baseTimeRef = useRef<number>(0)
  const processedEventIndexRef = useRef(0)
  const hasCompletedRef = useRef(false)
  const logIdRef = useRef(0)
  const partyHpRef = useRef<number[]>([])

  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [])

  const openBattleLog = useCallback((detail: BattleLogEntry[], meta?: BattleLogMeta) => {
    const logId = storeBattleLog(detail, meta)
    router.push(`/formation/battle-log?logId=${encodeURIComponent(logId)}` as Href)
  }, [])

  const getReturnReasonText = useCallback((reason: ExpeditionEndReason) => {
    if (reason === 'completed') return t('ui.formation.playback.completed')
    if (reason === 'defeated') return t('ui.formation.playback.defeated')
    if (reason === 'policy_return') return t('ui.formation.playback.policyReturn')
    if (reason === 'abort') return t('ui.formation.playback.abort')
    return t('ui.formation.playback.completed')
  }, [t])

  const buildLogEntries = useCallback((event: TimelineEvent): LogEntry[] => {
    const createEntry = (text: string, detail?: BattleLogEntry[], meta?: BattleLogMeta) => {
      logIdRef.current += 1
      return { id: `${logIdRef.current}`, text, detail, meta }
    }
    switch (event.type) {
      case 'move_start':
        return [createEntry(t('ui.formation.playback.explorationStart', { floor: event.floor }))]
      case 'floor_up':
        return [createEntry(t('ui.formation.playback.floorMove', { from: event.from, to: event.to }))]
      case 'exploring':
        return [createEntry(t('ui.formation.playback.exploring'))]
      case 'battle':
      case 'boss': {
        const label = event.type === 'boss' ? t('ui.formation.playback.boss') : t('ui.formation.playback.battle')
        const result = event.combat.outcome === 'win' ? t('ui.formation.playback.win') : t('ui.formation.playback.lose')
        const partyMembers = replay?.meta.party ?? []
        const rewardedXp = event.combat.outcome === 'win' ? event.xp : 0
        const xpPerMember = partyMembers.length > 0 ? Math.floor(rewardedXp / partyMembers.length) : 0
        const meta: BattleLogMeta = {
          outcome: event.combat.outcome,
          xpGained: rewardedXp,
          goldGained: event.enemy.gold,
          members: partyMembers.map((memberId, idx) => {
            const goblin = partyGoblins[idx]
            const preHP = partyHpRef.current[idx] ?? (goblin ? getEffectiveStats(goblin).hp : 100)
            return {
              name: goblin?.name ?? `ID:${memberId}`,
              currentHP: event.combat.allyHPDelta[idx] !== undefined
                ? Math.max(0, preHP + event.combat.allyHPDelta[idx])
                : 0,
              maxHP: goblin ? getEffectiveStats(goblin).hp : 100,
              level: goblin?.level ?? 1,
              xpEach: xpPerMember,
              expMultiplier: 1,
            }
          }),
        }
        const entries: LogEntry[] = [
          createEntry(
            t('ui.formation.playback.encounter', { label, enemy: event.enemy.name, level: event.enemy.lvl, count: event.enemy.count, result }),
            event.combat.detailedLog,
            meta,
          ),
        ]
        if (rewardedXp > 0) {
          entries.push(createEntry(t('ui.formation.playback.xpGain', { value: rewardedXp })))
        }
        return entries
      }
      case 'treasure': {
        const entries: LogEntry[] = [createEntry(t('ui.formation.playback.treasureFound'))]
        for (const item of event.items) {
          entries.push(createEntry(t('ui.formation.playback.treasureItem', { name: resolveTreasureName(item) })))
        }
        return entries
      }
      case 'return':
        return [createEntry(getReturnReasonText(event.reason))]
      default:
        return [createEntry(t('ui.formation.playback.eventOccurred'))]
    }
  }, [getReturnReasonText, partyGoblins, replay, t])

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
          partyHpRef.current = updated
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

    // 完了処理は useExpeditionFlow の completeDueExpeditions に一本化。
    // playback側ではタイマー停止のみ行う。
  }, [expeditionRecord, replay])

  useEffect(() => {
    if (isPartyLoading || isGoblinLoading || isExpeditionLoading) return
    if (!expeditionRecord) {
      setErrorMessage(t('ui.formation.playback.dataNotFound'))
      return
    }
    if (!expeditionRecord.replay) {
      setErrorMessage(null)
      setReplay(null)
      return
    }

    setErrorMessage(null)
    setReplay(expeditionRecord.replay)
  }, [expeditionRecord, isPartyLoading, isGoblinLoading, isExpeditionLoading, t])

  useEffect(() => {
    if (!replay) return
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current)
    }

    const initialPartyHp = partyGoblins.map(goblin => {
      return goblin ? getEffectiveStats(goblin).hp : 100
    })
    let tempHp = [...initialPartyHp]
    partyHpRef.current = [...initialPartyHp]
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
          partyHpRef.current = [...tempHp]
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
          <Text style={styles.loadingText}>{errorMessage ?? t('ui.common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const progressText = `${formatTime(currentTime)} / ${formatTime(playbackDuration)}`

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>← {t('ui.formation.common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{dungeonDisplayName} - {t('ui.formation.playback.logViewTitle')}</Text>
        <View style={styles.navSpacer} />
      </View>

      <View style={styles.statusBar}>
        <View style={styles.statusRow}>
          <Text style={styles.statusTitle}>{t('ui.formation.playback.floorTitle', { name: dungeonDisplayName, floor: currentFloor })}</Text>
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
          const goblin = partyGoblins[index]
          const maxHp = goblin ? getEffectiveStats(goblin).hp : 100
          const currentHp = partyHp[index] ?? maxHp
          return (
            <View key={memberId} style={styles.partyCard}>
              <View style={styles.partyHeader}>
                <View style={styles.partyAvatar}>
                  {goblin ? (
                    <Image source={getGoblinDisplayImage(goblin)} style={styles.partyAvatarImage} />
                  ) : (
                    <Text style={styles.partyAvatarFallback}>?</Text>
                  )}
                </View>
                <Text style={styles.partyNameText} numberOfLines={1}>{goblin?.name || `ID:${memberId}`}</Text>
              </View>
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
          {eventLog.map(entry => {
            const baseText = entry.text.replace('[Detail]', '').replace('[詳細]', '').replace('[상세]', '')
            if (entry.detail) {
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.logRow}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                  onPress={() => openBattleLog(entry.detail!, entry.meta)}
                >
                  <Text style={styles.logText}>{baseText}</Text>
                  <Text style={styles.logDetail}>{t('ui.formation.playback.detail')}</Text>
                </TouchableOpacity>
              )
            }

            return (
              <View key={entry.id} style={styles.logRow}>
                <Text style={styles.logText}>{baseText}</Text>
              </View>
            )
          })}
        </ScrollView>
      </View>
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
    marginBottom: 8,
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
    marginBottom: 8,
  },
  partyCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  partyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  partyAvatarImage: {
    width: '100%',
    height: '100%',
  },
  partyAvatarFallback: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  partyNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
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
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 6,
  },
  logText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'Courier',
    flex: 1,
  },
  logDetail: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 12,
  },
})
