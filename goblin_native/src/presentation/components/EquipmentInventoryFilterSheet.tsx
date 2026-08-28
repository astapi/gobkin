import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import type { EquipmentCategory, EquipmentTitleId } from '@/shared/types'
import { getEquipmentTitleLabel } from '@/shared/i18n/entityLocalization'
import {
  DEFAULT_EQUIPMENT_INVENTORY_FILTER,
  getAvailableEquipmentCategories,
  getAvailableEquipmentTitleIds,
  type EquipmentInventoryFilter,
  type EquipmentInventoryFilterTarget,
  type EquipmentModCountFilter,
} from '@/shared/utils/equipmentInventoryFilter'

const CATEGORY_LABEL_KEYS: Record<EquipmentCategory, string> = {
  weapon: 'ui.equipmentInventoryFilter.categories.weapon',
  armor: 'ui.equipmentInventoryFilter.categories.armor',
  robe: 'ui.equipmentInventoryFilter.categories.robe',
  shield: 'ui.equipmentInventoryFilter.categories.shield',
  large_shield: 'ui.equipmentInventoryFilter.categories.largeShield',
  gauntlet: 'ui.equipmentInventoryFilter.categories.gauntlet',
  wand: 'ui.equipmentInventoryFilter.categories.wand',
  rod: 'ui.equipmentInventoryFilter.categories.rod',
  accessory: 'ui.equipmentInventoryFilter.categories.accessory',
}

interface EquipmentInventoryFilterSheetProps {
  visible: boolean
  value: EquipmentInventoryFilter
  targets: EquipmentInventoryFilterTarget[]
  onApply: (filter: EquipmentInventoryFilter) => void
  onClose: () => void
}

export function EquipmentInventoryFilterSheet({
  visible,
  value,
  targets,
  onApply,
  onClose,
}: EquipmentInventoryFilterSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState<EquipmentInventoryFilter>(value)
  const categories = useMemo(() => getAvailableEquipmentCategories(targets), [targets])
  const titleIds = useMemo(() => getAvailableEquipmentTitleIds(targets), [targets])

  useEffect(() => {
    if (visible) setDraft(value)
  }, [value, visible])

  const selectModCount = (modCount: EquipmentModCountFilter) => {
    setDraft((current) => ({ ...current, modCount }))
  }

  const selectCategory = (category: EquipmentInventoryFilter['category']) => {
    setDraft((current) => ({ ...current, category }))
  }

  const toggleTitle = (titleId: EquipmentTitleId) => {
    setDraft((current) => ({
      ...current,
      titleIds: current.titleIds.includes(titleId)
        ? current.titleIds.filter((selectedTitleId) => selectedTitleId !== titleId)
        : [...current.titleIds, titleId],
    }))
  }

  const getTitleLabel = (titleId: EquipmentTitleId): string => {
    if (titleId === 'none') return t('ui.equipmentInventoryFilter.noTitle')
    return getEquipmentTitleLabel(titleId).trim()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessible={false} />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('ui.equipmentInventoryFilter.title')}</Text>
            <Pressable
              testID="equipment-filter-close"
              accessibilityRole="button"
              accessibilityLabel={t('ui.common.close')}
              onPress={onClose}
            >
              <Text style={styles.close}>{t('ui.common.close')}</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('ui.equipmentInventoryFilter.name')}</Text>
              <TextInput
                testID="equipment-filter-name"
                accessibilityLabel={t('ui.equipmentInventoryFilter.name')}
                value={draft.nameQuery}
                onChangeText={(nameQuery) => setDraft((current) => ({ ...current, nameQuery }))}
                placeholder={t('ui.equipmentInventoryFilter.namePlaceholder')}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={styles.nameInput}
              />
            </View>

            <FilterSection title={t('ui.equipmentInventoryFilter.modCount')}>
              <FilterChip
                testID="equipment-filter-mod-all"
                label={t('ui.equipmentInventoryFilter.all')}
                selected={draft.modCount === 'all'}
                onPress={() => selectModCount('all')}
              />
              {([1, 2] as const).map((count) => (
                <FilterChip
                  key={count}
                  testID={`equipment-filter-mod-${count}`}
                  label={t('ui.equipmentInventoryFilter.modCountValue', { count })}
                  selected={draft.modCount === count}
                  onPress={() => selectModCount(count)}
                />
              ))}
            </FilterSection>

            <FilterSection title={t('ui.equipmentInventoryFilter.category')}>
              <FilterChip
                testID="equipment-filter-category-all"
                label={t('ui.equipmentInventoryFilter.all')}
                selected={draft.category === 'all'}
                onPress={() => selectCategory('all')}
              />
              {categories.map((category) => (
                <FilterChip
                  key={category}
                  testID={`equipment-filter-category-${category}`}
                  label={t(CATEGORY_LABEL_KEYS[category])}
                  selected={draft.category === category}
                  onPress={() => selectCategory(category)}
                />
              ))}
            </FilterSection>

            <FilterSection title={t('ui.equipmentInventoryFilter.equipmentTitle')}>
              <FilterChip
                testID="equipment-filter-title-all"
                label={t('ui.equipmentInventoryFilter.all')}
                selected={draft.titleIds.length === 0}
                onPress={() => setDraft((current) => ({ ...current, titleIds: [] }))}
                accessibilityRole="checkbox"
              />
              {titleIds.map((titleId) => (
                <FilterChip
                  key={titleId}
                  testID={`equipment-filter-title-${titleId}`}
                  label={getTitleLabel(titleId)}
                  selected={draft.titleIds.includes(titleId)}
                  onPress={() => toggleTitle(titleId)}
                  accessibilityRole="checkbox"
                />
              ))}
            </FilterSection>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              testID="equipment-filter-clear"
              accessibilityRole="button"
              accessibilityLabel={t('ui.equipmentInventoryFilter.clear')}
              style={styles.clearButton}
              onPress={() => setDraft(DEFAULT_EQUIPMENT_INVENTORY_FILTER)}
            >
              <Text style={styles.clearButtonText}>{t('ui.equipmentInventoryFilter.clear')}</Text>
            </Pressable>
            <Pressable
              testID="equipment-filter-apply"
              accessibilityRole="button"
              accessibilityLabel={t('ui.equipmentInventoryFilter.apply')}
              style={styles.applyButton}
              onPress={() => onApply(draft)}
            >
              <Text style={styles.applyButtonText}>{t('ui.equipmentInventoryFilter.apply')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipGrid}>{children}</View>
    </View>
  )
}

function FilterChip({
  testID,
  label,
  selected,
  onPress,
  accessibilityRole = 'radio',
}: {
  testID: string
  label: string
  selected: boolean
  onPress: () => void
  accessibilityRole?: 'radio' | 'checkbox'
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '800',
  },
  close: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '700',
    padding: 8,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    gap: 18,
    paddingBottom: 18,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '800',
  },
  nameInput: {
    height: 44,
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    color: '#1F2937',
    fontSize: 15,
    paddingHorizontal: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 68,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  chipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  clearButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
  },
  clearButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  applyButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    paddingVertical: 12,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
})
