import { useMemo } from 'react'
import { View, Text, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTutorialStore } from '../stores/useTutorialStore'
import {
  selectActionableEntry,
  selectActiveEntries,
  useTutorialOverlayStore,
} from '../stores/useTutorialOverlayStore'

const MASK_COLOR = 'rgba(15, 23, 42, 0.72)'

export function TutorialSpotlight() {
  const { t } = useTranslation()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const step = useTutorialStore(state => state.step)
  const entries = useTutorialOverlayStore(state => state.entries)

  const activeEntries = useMemo(() => selectActiveEntries(entries, step), [entries, step])
  const target = useMemo(() => selectActionableEntry(entries, step), [entries, step])

  const layout = useMemo(() => {
    const messageTarget = target ?? activeEntries[activeEntries.length - 1]
    if (!messageTarget) return null
    if (!messageTarget.rect) {
      const messagePosition: ViewStyle = {
        top: screenHeight / 2 - 40,
        left: 24,
        right: 24,
      }
      return { rect: null, messagePosition }
    }
    const rect = messageTarget.rect
    const placement = messageTarget.placement === 'auto'
      ? rect.y + rect.height / 2 > screenHeight / 2 ? 'above' : 'below'
      : messageTarget.placement
    const messagePosition: ViewStyle = placement === 'above'
      ? { bottom: Math.max(24, screenHeight - rect.y + 12), left: 24, right: 24 }
      : { top: rect.y + rect.height + 12, left: 24, right: 24 }
    return { rect, messagePosition }
  }, [target, activeEntries, screenHeight])

  if (step === 'not_started' || step === 'completed') return null
  if (activeEntries.length === 0 || !layout) return null

  // 穴あり: 4辺マスクで切り抜きを表現
  if (target?.rect) {
    const r = target.rect
    const rightX = r.x + r.width
    const bottomY = r.y + r.height
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* 上 */}
        <View
          style={[styles.mask, { top: 0, left: 0, width: screenWidth, height: Math.max(0, r.y) }]}
          pointerEvents="auto"
        />
        {/* 下 */}
        <View
          style={[styles.mask, {
            top: bottomY,
            left: 0,
            width: screenWidth,
            height: Math.max(0, screenHeight - bottomY),
          }]}
          pointerEvents="auto"
        />
        {/* 左 */}
        <View
          style={[styles.mask, {
            top: r.y,
            left: 0,
            width: Math.max(0, r.x),
            height: r.height,
          }]}
          pointerEvents="auto"
        />
        {/* 右 */}
        <View
          style={[styles.mask, {
            top: r.y,
            left: rightX,
            width: Math.max(0, screenWidth - rightX),
            height: r.height,
          }]}
          pointerEvents="auto"
        />
        {/* スポット枠 */}
        {activeEntries.map(entry => entry.rect ? (
          <View
            key={entry.id}
            style={[styles.spotBorder, {
              top: entry.rect.y,
              left: entry.rect.x,
              width: entry.rect.width,
              height: entry.rect.height,
            }]}
            pointerEvents="none"
          />
        ) : null)}
        {/* メッセージ */}
        <View style={[styles.messageBox, layout.messagePosition]} pointerEvents="none">
          <Text style={styles.messageText}>{t(target.messageKey)}</Text>
        </View>
      </View>
    )
  }

  // 穴なし: 全画面マスクのみ
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <View style={[styles.mask, StyleSheet.absoluteFillObject]} pointerEvents="auto" />
      {activeEntries.map(entry => entry.rect ? (
        <View
          key={entry.id}
          style={[styles.spotBorder, {
            top: entry.rect.y,
            left: entry.rect.x,
            width: entry.rect.width,
            height: entry.rect.height,
          }]}
          pointerEvents="none"
        />
      ) : null)}
      <View style={[styles.messageBox, layout.messagePosition]} pointerEvents="none">
        <Text style={styles.messageText}>{t((target ?? activeEntries[activeEntries.length - 1]).messageKey)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
    backgroundColor: MASK_COLOR,
  },
  spotBorder: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  messageBox: {
    position: 'absolute',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  messageText: {
    color: '#FEF3C7',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
})
