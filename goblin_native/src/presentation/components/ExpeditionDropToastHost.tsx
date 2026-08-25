import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { computeExpeditionReplay } from '@/core/services/LazyExpeditionComputer'
import { getEquipmentTemplate } from '@/shared/data/equipmentPoolLoader'
import { getEquipmentDisplayName } from '@/shared/i18n/entityLocalization'
import type { ExpeditionRecord, ExpeditionReplay, TreasureDrop } from '@/shared/types'
import { useExpeditionStore } from '@/presentation/stores/useExpeditionStore'
import { useToastDismissStore } from '@/presentation/stores/useToastDismissStore'
import { TIPS_BAR_HEIGHT } from '@/presentation/components/TipsBar'
import { EquipmentModService } from '@/core/services/EquipmentModService'

const DISPLAY_MS = 4200
const SCAN_INTERVAL_MS = 1000
const TAB_BAR_BASE_HEIGHT = 60
const TAB_BAR_BASE_PADDING = 8
const MAX_VISIBLE_TOASTS = 20
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface DropToast {
  id: string
  label: string
}

function resolveDropName(drop: TreasureDrop): string | null {
  const template = getEquipmentTemplate(drop.templateId)
  if (!template) return null
  return getEquipmentDisplayName(drop, template)
}

function getReplaySecond(record: ExpeditionRecord, replay: ExpeditionReplay, now: number): number {
  const startMs = record.startTime.getTime()
  const returnMs = record.returnTime?.getTime() ?? startMs + replay.durationSec * 1000
  const totalMs = returnMs - startMs

  if (totalMs <= 0) {
    return replay.durationSec
  }

  const elapsedRatio = Math.min(1, Math.max(0, (now - startMs) / totalMs))
  return elapsedRatio * replay.durationSec
}

function DropToastItem({
  toast,
  onDone,
  onDismissAll,
}: {
  toast: DropToast
  onDone: (id: string) => void
  onDismissAll: () => void
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => onDone(toast.id))
    }, DISPLAY_MS)

    return () => clearTimeout(timer)
  }, [onDone, opacity, toast.id, translateY])

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="表示中のドロップ通知をすべて閉じる"
      onPress={onDismissAll}
      style={[
        styles.toast,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.toastText} numberOfLines={1}>{toast.label}</Text>
    </AnimatedPressable>
  )
}

export function ExpeditionDropToastHost() {
  const insets = useSafeAreaInsets()
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + Math.max(TAB_BAR_BASE_PADDING, insets.bottom)
  const expeditionRecords = useExpeditionStore((state) => state.expeditionRecords)
  const isExpeditionLoading = useExpeditionStore((state) => state.isLoading)
  const isCatchUpProcessing = useExpeditionStore((state) => state.isCatchUpProcessing)
  const catchUpRevision = useExpeditionStore((state) => state.catchUpRevision)
  const updateExpeditionReplay = useExpeditionStore((state) => state.updateExpeditionReplay)
  const toastDismissRevision = useToastDismissStore((state) => state.revision)
  const dismissAllToastLogs = useToastDismissStore((state) => state.dismissAll)
  const [toasts, setToasts] = useState<DropToast[]>([])
  const shownKeysRef = useRef<Set<string>>(new Set())
  const shownDropKeysRef = useRef<Set<string>>(new Set())
  const computingRef = useRef<Set<string>>(new Set())
  const lastScannedSecondRef = useRef<Map<string, number>>(new Map())
  const knownRecordIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const skippedCatchUpRef = useRef(false)
  const catchUpRevisionRef = useRef(catchUpRevision)

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const dismissAllToasts = useCallback(() => {
    setToasts([])
    dismissAllToastLogs()
  }, [dismissAllToastLogs])

  useEffect(() => {
    setToasts([])
  }, [toastDismissRevision])

  const enqueueDrop = useCallback((record: ExpeditionRecord, item: TreasureDrop, sourceKey: string) => {
    const stackKey = EquipmentModService.getStackKey(item)
    const dropKey = `${record.id}:${stackKey}`
    if (shownDropKeysRef.current.has(dropKey)) return

    const key = `${record.id}:${sourceKey}:${stackKey}`
    if (shownKeysRef.current.has(key)) return

    const itemName = resolveDropName(item)
    if (!itemName) return

    shownKeysRef.current.add(key)
    shownDropKeysRef.current.add(dropKey)
    const toast = {
      id: key,
      label: `P${record.partyId} ${itemName}`,
    }
    setToasts(prev => [toast, ...prev].slice(0, MAX_VISIBLE_TOASTS))
  }, [])

  const scanDrops = useCallback(async () => {
    if (isExpeditionLoading) return
    if (isCatchUpProcessing) {
      skippedCatchUpRef.current = true
      return
    }

    // オフライン周回の集計後に追加・完了したレコードは既知扱いにする。
    // 画面復帰時に過去分のドロップトーストをまとめて再生しない。
    if (skippedCatchUpRef.current || catchUpRevisionRef.current !== catchUpRevision) {
      expeditionRecords.forEach(record => knownRecordIdsRef.current.add(record.id))
      initializedRef.current = true
      skippedCatchUpRef.current = false
      catchUpRevisionRef.current = catchUpRevision
      return
    }

    const now = Date.now()

    if (!initializedRef.current) {
      expeditionRecords.forEach(record => knownRecordIdsRef.current.add(record.id))
      initializedRef.current = true
    }

    for (const record of expeditionRecords) {
      if (!record.returnTime) continue

      const isNewRecord = !knownRecordIdsRef.current.has(record.id)
      knownRecordIdsRef.current.add(record.id)
      const shouldWatch =
        record.status === 'ongoing' ||
        lastScannedSecondRef.current.has(record.id) ||
        isNewRecord

      if (!shouldWatch) continue

      let replay = record.replay
      if (!replay && record.expeditionMeta) {
        if (computingRef.current.has(record.id)) continue
        computingRef.current.add(record.id)
        try {
          replay = await computeExpeditionReplay(record.expeditionMeta)
          await updateExpeditionReplay(record.id, replay)
        } catch (error) {
          console.warn('[ExpeditionDropToastHost] Failed to compute replay', error)
        } finally {
          computingRef.current.delete(record.id)
        }
      }
      if (!replay) continue

      const currentSecond = getReplaySecond(record, replay, now)
      const lastSecond = lastScannedSecondRef.current.get(record.id)
      lastScannedSecondRef.current.set(record.id, currentSecond)
      const scanFromSecond = lastSecond ?? (isNewRecord ? 0 : currentSecond)
      if (lastSecond === undefined && !isNewRecord) continue

      for (const event of replay.events) {
        if (event.type !== 'treasure' || event.at <= scanFromSecond || event.at > currentSecond) continue
        event.items.forEach((item, itemIndex) => {
          enqueueDrop(record, item, `event:${event.at}:${itemIndex}`)
        })
      }

      const expeditionFinished =
        record.status !== 'ongoing' ||
        currentSecond >= replay.durationSec ||
        (record.returnTime?.getTime() ?? Number.POSITIVE_INFINITY) <= now

      if (expeditionFinished) {
        replay.summary.treasureDrops?.forEach((item, itemIndex) => {
          enqueueDrop(record, item, `summary:${itemIndex}`)
        })
      }
    }
  }, [catchUpRevision, enqueueDrop, expeditionRecords, isCatchUpProcessing, isExpeditionLoading, updateExpeditionReplay])

  useEffect(() => {
    void scanDrops()
    const timer = setInterval(() => {
      void scanDrops()
    }, SCAN_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [scanDrops])

  if (toasts.length === 0) return null

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: tabBarHeight + TIPS_BAR_HEIGHT + 8,
        },
      ]}
    >
      {toasts.map(toast => (
        <DropToastItem
          key={toast.id}
          toast={toast}
          onDone={removeToast}
          onDismissAll={dismissAllToasts}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    zIndex: 40,
    elevation: 40,
    flexDirection: 'column-reverse',
    alignItems: 'flex-start',
    gap: 6,
    maxWidth: '82%',
  },
  toast: {
    maxWidth: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(31, 41, 55, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
})
