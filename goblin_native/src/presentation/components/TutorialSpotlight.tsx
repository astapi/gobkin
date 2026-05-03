import { useMemo } from 'react'
import { View, Text, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTutorialStore } from '../stores/useTutorialStore'
import { selectActiveEntry, useTutorialOverlayStore } from '../stores/useTutorialOverlayStore'

const MASK_COLOR = 'rgba(15, 23, 42, 0.72)'

export function TutorialSpotlight() {
  const { t } = useTranslation()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const step = useTutorialStore(state => state.step)
  const entries = useTutorialOverlayStore(state => state.entries)

  const target = useMemo(() => selectActiveEntry(entries, step), [entries, step])

  const layout = useMemo(() => {
    if (!target) return null
    if (!target.rect) {
      const messagePosition: ViewStyle = {
        top: screenHeight / 2 - 40,
        left: 24,
        right: 24,
      }
      return { rect: null, messagePosition }
    }
    const rect = target.rect
    const placement = target.placement === 'auto'
      ? rect.y + rect.height / 2 > screenHeight / 2 ? 'above' : 'below'
      : target.placement
    const messagePosition: ViewStyle = placement === 'above'
      ? { bottom: Math.max(24, screenHeight - rect.y + 12), left: 24, right: 24 }
      : { top: rect.y + rect.height + 12, left: 24, right: 24 }
    return { rect, messagePosition }
  }, [target, screenHeight])

  if (step === 'not_started' || step === 'completed') return null
  if (!target || !layout) return null

  // 穴あり: 4辺マスクで切り抜きを表現
  if (layout.rect) {
    const r = layout.rect
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
        <View
          style={[styles.spotBorder, { top: r.y, left: r.x, width: r.width, height: r.height }]}
          pointerEvents="none"
        />
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
      <View style={[styles.messageBox, layout.messagePosition]} pointerEvents="none">
        <Text style={styles.messageText}>{t(target.messageKey)}</Text>
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
