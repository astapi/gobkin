import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface TipsBarProps {
  bottom: number
  text: string
}

export const TIPS_BAR_HEIGHT = 34

export const TipsBar = memo(function TipsBar({ bottom, text }: TipsBarProps) {
  return (
    <View style={[styles.container, { bottom }]} pointerEvents="none">
      <Text style={styles.label}>TIPS</Text>
      <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
        {text}
      </Text>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TIPS_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    zIndex: 20,
  },
  label: {
    flexShrink: 0,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    flex: 1,
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
})
