import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import AcornIcon from '../../../assets/acorn.svg'
import { usePurchaseStore } from '@/presentation/stores/usePurchaseStore'
import { TICKET_TYPES } from '@/shared/constants/purchases'

interface GoldenAcornBadgeProps {
  bottom: number
}

export const GoldenAcornBadge = memo(function GoldenAcornBadge({ bottom }: GoldenAcornBadgeProps) {
  const count = usePurchaseStore((state) => {
    const ticket = state.tickets.find(tk => tk.ticketType === TICKET_TYPES.GOLDEN_ACORN)
    return ticket?.quantity ?? 0
  })

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={[styles.badge, { bottom }]}>
        <AcornIcon width={16} height={16} />
        <Text style={styles.text}>x{count}</Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  badge: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 243, 199, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  text: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '700',
  },
})
