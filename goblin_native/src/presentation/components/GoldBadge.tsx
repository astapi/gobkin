import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { selectGold, useBaseStore } from '@/presentation/stores/useBaseStore'

interface GoldBadgeProps {
  bottom: number
}

export const GoldBadge = memo(function GoldBadge({ bottom }: GoldBadgeProps) {
  const gold = useBaseStore(selectGold)

  return (
    <View style={[styles.goldBadge, { bottom }]} pointerEvents="none">
      <Text style={styles.goldText}>{gold.toLocaleString()}G</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  goldBadge: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  goldText: {
    fontSize: 11,
    color: '#F9FAFB',
  },
})
