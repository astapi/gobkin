import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useCurrentTime } from '@/presentation/hooks/useCurrentTime'

function formatFullDateTimeWithSeconds(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

interface CurrentTimeBadgeProps {
  bottom: number
}

export const CurrentTimeBadge = memo(function CurrentTimeBadge({
  bottom,
}: CurrentTimeBadgeProps) {
  const currentTime = useCurrentTime({ enabled: true })
  const currentTimeLabel = formatFullDateTimeWithSeconds(currentTime)

  return (
    <View style={[styles.currentTimeBadge, { bottom }]} pointerEvents="none">
      <Text style={styles.currentTimeText}>{currentTimeLabel}</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  currentTimeBadge: {
    position: 'absolute',
    left: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  currentTimeText: {
    fontSize: 11,
    color: '#F9FAFB',
  },
})
