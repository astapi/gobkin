import { Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

interface EquipmentInventoryFilterButtonProps {
  activeFilterCount: number
  onPress: () => void
}

export function EquipmentInventoryFilterButton({
  activeFilterCount,
  onPress,
}: EquipmentInventoryFilterButtonProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const label = activeFilterCount > 0
    ? t('ui.equipmentInventoryFilter.summary', { count: activeFilterCount })
    : t('ui.equipmentInventoryFilter.title')

  return (
    <Pressable
      testID="equipment-inventory-filter-button"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { bottom: insets.bottom + 16 },
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#374151',
    borderRadius: 24,
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
})
