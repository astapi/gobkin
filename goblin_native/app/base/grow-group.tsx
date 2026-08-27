import { memo, useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Goblin } from '@/shared/types'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useBaseStore } from '@/presentation/stores/useBaseStore'
import { useGoblinBirthStore } from '@/presentation/stores/useGoblinBirthStore'
import { useCurrentTime } from '@/presentation/hooks/useCurrentTime'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getFactor } from '@/shared/data/factors'
import { getFactorShortName, getRaceLabel } from '@/shared/i18n/entityLocalization'
import { BOTTOM_INFO_SPACING } from '@/shared/constants/layout'
import { useTutorialTarget } from '@/presentation/hooks/useTutorialTarget'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function GrowGoblinGroupScreen() {
  const { t } = useTranslation()
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const slots = useGoblinBirthStore((state) => state.slots)
  const slotsLoading = useGoblinBirthStore((state) => state.isLoading)
  const rank = useBaseStore((state) => state.baseState?.rank ?? 1)
  const pendingCount = useBaseStore((state) => state.pendingGoblins.length)
  const [pickerTarget, setPickerTarget] = useState<number | null>(null)
  const [processingSlotIndex, setProcessingSlotIndex] = useState<number | null>(null)
  const firstSlotTutorialRef = useTutorialTarget<View>({
    activeOn: ['add_goblin'],
    messageKey: 'ui.tutorial.banner.configureGrowth',
    placement: 'below',
    allowThrough: true,
  })
  const hasActiveSlot = slots.some((slot) => slot.isActive)
  const currentTime = useCurrentTime({ enabled: hasActiveSlot })
  const goblinById = useMemo(
    () => new Map(goblins.map((goblin) => [goblin.id, goblin])),
    [goblins],
  )
  const slotByIndex = useMemo(
    () => new Map(slots.map((slot) => [slot.slotIndex, slot])),
    [slots],
  )
  const slotIndexes = useMemo(
    () => Array.from({ length: rank }, (_, index) => index + 1),
    [rank],
  )
  const unavailableGoblinIds = useMemo(() => {
    const unavailable = new Set<number>()
    if (!pickerTarget) return unavailable

    slots.forEach((slot) => {
      if (slot.slotIndex !== pickerTarget) {
        unavailable.add(slot.sourceGoblinId)
      }
    })
    return unavailable
  }, [pickerTarget, slots])

  const openPicker = useCallback((slotIndex: number) => {
    setPickerTarget(slotIndex)
  }, [])

  const selectGoblin = useCallback(async (goblin: Goblin) => {
    if (pickerTarget === null) return
    const slotIndex = pickerTarget
    setPickerTarget(null)
    setProcessingSlotIndex(slotIndex)
    try {
      await useGoblinBirthStore.getState().configureSlot(slotIndex, goblin.id)
    } catch (error) {
      Alert.alert(
        t('ui.goblinBirth.errorTitle'),
        error instanceof Error ? error.message : String(error),
      )
    } finally {
      setProcessingSlotIndex(null)
    }
  }, [pickerTarget, t])

  const startSlot = useCallback(async (slotIndex: number) => {
    setProcessingSlotIndex(slotIndex)
    try {
      await useGoblinBirthStore.getState().startSlot(slotIndex)
      if (useTutorialStore.getState().step === 'add_goblin') {
        await useTutorialStore.getState().advanceTo('finish')
      }
    } catch (error) {
      Alert.alert(
        t('ui.goblinBirth.errorTitle'),
        error instanceof Error ? error.message : String(error),
      )
    } finally {
      setProcessingSlotIndex(null)
    }
  }, [t])

  const stopSlot = useCallback((slotIndex: number) => {
    Alert.alert(
      t('ui.goblinBirth.stopConfirmTitle'),
      t('ui.goblinBirth.stopConfirmBody'),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.goblinBirth.stopConfirmAction'),
          style: 'destructive',
          onPress: () => {
            setProcessingSlotIndex(slotIndex)
            void useGoblinBirthStore.getState().stopSlot(slotIndex).finally(() => {
              setProcessingSlotIndex(null)
            })
          },
        },
      ],
    )
  }, [t])

  if (goblinsLoading || slotsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#3B82F6" />
        <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.introCard}>
          <Text style={styles.lead}>{t('ui.goblinBirth.lead')}</Text>
          <Text style={styles.hint}>{t('ui.goblinBirth.durationHint')}</Text>
        </View>

        {slotIndexes.map((slotIndex) => {
          const slot = slotByIndex.get(slotIndex)
          const sourceGoblin = slot ? goblinById.get(slot.sourceGoblinId) : undefined
          const isProcessing = processingSlotIndex === slotIndex
          const isCapacityWait = Boolean(
            slot?.isActive &&
            (slot.capacityPausedAt || pendingCount >= rank * 5),
          )
          const remaining = slot?.nextBirthAt
            ? formatRemaining(Date.parse(slot.nextBirthAt) - currentTime.getTime())
            : undefined
          return (
            <View key={slotIndex} ref={slotIndex === 1 ? firstSlotTutorialRef : undefined} style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotTitle}>{t('ui.goblinBirth.slotTitle', { index: slotIndex })}</Text>
                <View style={[styles.statusBadge, slot?.isActive ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, slot?.isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                    {isCapacityWait
                      ? t('ui.goblinBirth.capacityWait')
                      : slot?.isActive
                        ? t('ui.goblinBirth.active')
                        : t('ui.goblinBirth.inactive')}
                  </Text>
                </View>
              </View>

              <View style={styles.sources}>
                <SourceButton
                  label={t('ui.goblinBirth.sourceLabel')}
                  goblin={sourceGoblin}
                  disabled={Boolean(slot?.isActive || isProcessing)}
                  onPress={() => openPicker(slotIndex)}
                  selectLabel={t(sourceGoblin ? 'ui.goblinBirth.changeSource' : 'ui.goblinBirth.selectSource')}
                  showSelectLabel={!slot?.isActive}
                />
                <Text style={styles.randomPartnerHint}>{t('ui.goblinBirth.randomPartnerHint')}</Text>
              </View>

              <View style={styles.slotFooter}>
                <View style={styles.progressInfo}>
                  {remaining && slot?.isActive ? (
                    <Text style={styles.remainingText}>
                      {isCapacityWait ? t('ui.goblinBirth.capacityWait') : t('ui.goblinBirth.remaining', { time: remaining })}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  style={[
                    styles.actionButton,
                    slot?.isActive ? styles.stopButton : styles.startButton,
                    (isProcessing || !slot) && styles.disabledButton,
                  ]}
                  disabled={isProcessing || !slot}
                  onPress={() => slot?.isActive ? stopSlot(slotIndex) : void startSlot(slotIndex)}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>
                      {t(slot?.isActive ? 'ui.goblinBirth.stop' : 'ui.goblinBirth.start')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )
        })}
      </ScrollView>

      <GoblinPickerModal
        visible={pickerTarget !== null}
        goblins={goblins.filter((goblin) => !unavailableGoblinIds.has(goblin.id))}
        title={t('ui.goblinBirth.pickerTitle')}
        noFactorsLabel={t('ui.goblinBirth.noFactors')}
        closeLabel={t('ui.common.close')}
        onSelect={(goblin) => void selectGoblin(goblin)}
        onClose={() => setPickerTarget(null)}
      />
    </View>
  )
}

const SourceButton = memo(function SourceButton({
  label,
  goblin,
  disabled,
  onPress,
  selectLabel,
  showSelectLabel,
}: {
  label: string
  goblin?: Goblin
  disabled: boolean
  onPress: () => void
  selectLabel: string
  showSelectLabel: boolean
}) {
  return (
    <Pressable style={[styles.sourceButton, disabled && styles.sourceButtonDisabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.sourceLabel}>{label}</Text>
      {goblin ? (
        <View style={styles.sourceGoblinRow}>
          <Image source={getGoblinDisplayImage(goblin)} style={styles.sourceAvatar} />
          <View style={styles.sourceText}>
            <Text style={styles.sourceName}>{goblin.name}</Text>
            <Text style={styles.sourceMeta}>
              {getRaceLabel(goblin.raceId ?? goblin.race)} · Lv.{goblin.level} · ＋{goblin.plusValue ?? 0}
            </Text>
          </View>
          {showSelectLabel ? <Text style={styles.changeText}>{selectLabel}</Text> : null}
        </View>
      ) : (
        <View style={styles.emptySource}>
          <Text style={styles.emptySourcePlus}>＋</Text>
          {showSelectLabel ? <Text style={styles.emptySourceText}>{selectLabel}</Text> : null}
        </View>
      )}
    </Pressable>
  )
})

const GoblinPickerModal = memo(function GoblinPickerModal({
  visible,
  goblins,
  title,
  noFactorsLabel,
  closeLabel,
  onSelect,
  onClose,
}: {
  visible: boolean
  goblins: Goblin[]
  title: string
  noFactorsLabel: string
  closeLabel: string
  onSelect: (goblin: Goblin) => void
  onClose: () => void
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.modalClose}>{closeLabel}</Text>
          </Pressable>
        </View>
        <FlatList
          data={goblins}
          keyExtractor={(goblin) => goblin.id.toString()}
          contentContainerStyle={styles.pickerList}
          renderItem={({ item }) => (
            <Pressable style={styles.pickerRow} onPress={() => onSelect(item)}>
              <Image source={getGoblinDisplayImage(item)} style={styles.pickerAvatar} />
              <View style={styles.pickerInfo}>
                <View style={styles.pickerNameRow}>
                  <Text style={styles.pickerName}>{item.name}</Text>
                  <Text style={styles.pickerLevel}>Lv.{item.level}</Text>
                  <Text style={styles.pickerPlus}>＋{item.plusValue ?? 0}</Text>
                </View>
                <Text style={styles.pickerRace}>{getRaceLabel(item.raceId ?? item.race)}</Text>
                <Text style={styles.pickerFactors} numberOfLines={1}>
                  {(item.factors ?? []).length > 0
                    ? (item.factors ?? []).map((factorId) => getFactorShortName(getFactor(factorId) ?? { id: factorId, name: factorId })).join(' · ')
                    : noFactorsLabel}
                </Text>
              </View>
              <Text style={styles.pickerArrow}>›</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: BOTTOM_INFO_SPACING, gap: 14 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F3F4F6' },
  loadingText: { color: '#6B7280' },
  introCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderCurve: 'continuous', padding: 16, gap: 8 },
  lead: { color: '#1F2937', lineHeight: 21 },
  hint: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  slotCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderCurve: 'continuous', padding: 14, gap: 12 },
  slotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotTitle: { color: '#111827', fontWeight: '700', fontSize: 16 },
  statusBadge: { borderRadius: 999, borderCurve: 'continuous', paddingHorizontal: 9, paddingVertical: 4 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextActive: { color: '#15803D' },
  statusTextInactive: { color: '#6B7280' },
  sources: { gap: 8 },
  randomPartnerHint: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  sourceButton: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, borderCurve: 'continuous', padding: 10, gap: 7 },
  sourceButtonDisabled: { backgroundColor: '#F9FAFB' },
  sourceLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  sourceGoblinRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sourceAvatar: { width: 42, height: 42, borderRadius: 9, borderCurve: 'continuous' },
  sourceText: { flex: 1, minWidth: 0 },
  sourceName: { color: '#1F2937', fontWeight: '700' },
  sourceMeta: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  changeText: { color: '#2563EB', fontSize: 12, fontWeight: '600' },
  emptySource: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptySourcePlus: { color: '#2563EB', fontSize: 20 },
  emptySourceText: { color: '#2563EB', fontWeight: '600' },
  slotFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progressInfo: { flex: 1, gap: 3 },
  remainingText: { color: '#15803D', fontSize: 12, fontWeight: '700' },
  actionButton: { minWidth: 104, minHeight: 42, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  startButton: { backgroundColor: '#2563EB' },
  stopButton: { backgroundColor: '#DC2626' },
  disabledButton: { opacity: 0.4 },
  actionButtonText: { color: '#FFFFFF', fontWeight: '700' },
  modalScreen: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  modalTitle: { color: '#111827', fontWeight: '700', fontSize: 16 },
  modalClose: { color: '#2563EB', fontWeight: '600' },
  pickerList: { paddingVertical: 8 },
  pickerRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', gap: 11 },
  pickerAvatar: { width: 48, height: 48, borderRadius: 10, borderCurve: 'continuous' },
  pickerInfo: { flex: 1, minWidth: 0, gap: 2 },
  pickerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerName: { color: '#111827', fontWeight: '700' },
  pickerLevel: { color: '#374151', fontSize: 12, fontWeight: '600' },
  pickerPlus: { color: '#7C3AED', fontSize: 12, fontWeight: '700' },
  pickerRace: { color: '#6B7280', fontSize: 12 },
  pickerFactors: { color: '#7C3AED', fontSize: 11 },
  pickerArrow: { color: '#9CA3AF', fontSize: 24 },
})
