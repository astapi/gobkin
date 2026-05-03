import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { usePurchaseStore } from '@/presentation/stores/usePurchaseStore'
import { TICKET_TYPES } from '@/shared/constants/purchases'

interface GoldenAcornBadgeProps {
  bottom: number
}

export const GoldenAcornBadge = memo(function GoldenAcornBadge({ bottom }: GoldenAcornBadgeProps) {
  const { t } = useTranslation()
  const count = usePurchaseStore((state) => {
    const ticket = state.tickets.find(tk => tk.ticketType === TICKET_TYPES.GOLDEN_ACORN)
    return ticket?.quantity ?? 0
  })

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={[styles.badge, { bottom }]}>
        <Text style={styles.text}>{t('ui.common.goldenAcornBadge', { count })}</Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    backgroundColor: 'rgba(120, 53, 15, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  text: {
    fontSize: 11,
    color: '#FEF3C7',
  },
})
