import { useEffect, useState } from 'react'
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
import type { EquipmentCategory, EquipmentModCount, EquipmentTitleId } from '@/shared/types'
import { getEquipmentTitleLabel } from '@/shared/i18n/entityLocalization'
import {
  DEFAULT_EQUIPMENT_INVENTORY_FILTER,
  EQUIPMENT_CATEGORY_FILTER_ORDER,
  EQUIPMENT_MOD_COUNT_FILTER_OPTIONS,
  EQUIPMENT_TITLE_FILTER_ORDER,
  type EquipmentInventoryFilter,
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
  onApply: (filter: EquipmentInventoryFilter) => void
  onClose: () => void
}

export function EquipmentInventoryFilterSheet({
  visible,
  value,
  onApply,
  onClose,
}: EquipmentInventoryFilterSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState<EquipmentInventoryFilter>(value)

  useEffect(() => {
    if (visible) setDraft(value)
  }, [value, visible])

  const toggleModCount = (modCount: EquipmentModCount) => {
    setDraft((current) => ({ ...current, modCounts: toggleValue(current.modCounts, modCount) }))
  }

  const toggleCategory = (category: EquipmentCategory) => {
    setDraft((current) => ({ ...current, categories: toggleValue(current.categories, category) }))
  }

  const toggleTitle = (titleId: EquipmentTitleId) => {
    setDraft((current) => ({ ...current, titleIds: toggleValue(current.titleIds, titleId) }))
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

            <FilterSection
              title={t('ui.equipmentInventoryFilter.modCount')}
              hint={t('ui.equipmentInventoryFilter.multiSelectHint')}
            >
              <AllChip
                testID="equipment-filter-mod-all"
                label={t('ui.equipmentInventoryFilter.all')}
                selected={draft.modCounts.length === 0}
                onPress={() => setDraft((current) => ({ ...current, modCounts: [] }))}
              />
              {EQUIPMENT_MOD_COUNT_FILTER_OPTIONS.map((count) => (
                <FilterChip
                  key={count}
                  testID={`equipment-filter-mod-${count}`}
                  label={t('ui.equipmentInventoryFilter.modCountValue', { count })}
                  selected={draft.modCounts.includes(count)}
                  onPress={() => toggleModCount(count)}
                />
              ))}
            </FilterSection>

            <FilterSection
              title={t('ui.equipmentInventoryFilter.category')}
              hint={t('ui.equipmentInventoryFilter.multiSelectHint')}
            >
              <AllChip
                testID="equipment-filter-category-all"
                label={t('ui.equipmentInventoryFilter.all')}
                selected={draft.categories.length === 0}
                onPress={() => setDraft((current) => ({ ...current, categories: [] }))}
              />
              {EQUIPMENT_CATEGORY_FILTER_ORDER.map((category) => (
                <FilterChip
                  key={category}
                  testID={`equipment-filter-category-${category}`}
                  label={t(CATEGORY_LABEL_KEYS[category])}
                  selected={draft.categories.includes(category)}
                  onPress={() => toggleCategory(category)}
                />
              ))}
            </FilterSection>

            <FilterSection
              title={t('ui.equipmentInventoryFilter.equipmentTitle')}
              hint={t('ui.equipmentInventoryFilter.multiSelectHint')}
            >
              <AllChip
                testID="equipment-filter-title-all"
                label={t('ui.equipmentInventoryFilter.all')}
                selected={draft.titleIds.length === 0}
                onPress={() => setDraft((current) => ({ ...current, titleIds: [] }))}
              />
              {EQUIPMENT_TITLE_FILTER_ORDER.map((titleId) => (
                <FilterChip
                  key={titleId}
                  testID={`equipment-filter-title-${titleId}`}
                  label={getTitleLabel(titleId)}
                  selected={draft.titleIds.includes(titleId)}
                  onPress={() => toggleTitle(titleId)}
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

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function FilterSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      <View style={styles.chipGrid}>{children}</View>
    </View>
  )
}

/** 複数選択できることが分かるように、チェックボックス付きのチップにする。 */
function FilterChip({
  testID,
  label,
  selected,
  onPress,
}: {
  testID: string
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  )
}

/** 選択をすべて解除して「すべて」に戻すチップ。 */
function AllChip({
  testID,
  label,
  selected,
  onPress,
}: {
  testID: string
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, styles.allChip, selected && styles.allChipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.allChipTextSelected]}>{label}</Text>
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
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHint: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  checkbox: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#9CA3AF',
    borderRadius: 4,
    borderWidth: 1.5,
  },
  checkboxSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  checkboxMark: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  allChip: {
    borderStyle: 'dashed',
  },
  allChipSelected: {
    backgroundColor: '#E5E7EB',
    borderColor: '#9CA3AF',
    borderStyle: 'solid',
  },
  allChipTextSelected: {
    color: '#1F2937',
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
