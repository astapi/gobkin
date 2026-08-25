import { memo, useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import type {
  EquipmentCategory,
  EquipmentInstance,
  EquipmentTemplate,
  WeaponSubCategory,
} from '@/shared/types'
import { EquipmentModService } from '@/core/services/EquipmentModService'
import { EquipmentService } from '@/core/services/EquipmentService'
import { equipmentRepository } from '@/presentation/di/repositories'
import {
  describeCharacterSkill,
  getCharacterSkillDescription,
} from '@/shared/data/characterSkills'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import {
  getEquipmentTemplate,
  getEquipmentTemplates,
} from '@/shared/data/equipmentPoolLoader'
import { getEquipmentDisplayName, getStatLabel } from '@/shared/i18n/entityLocalization'
import { EquipmentInventoryFilterSheet } from '@/presentation/components/EquipmentInventoryFilterSheet'
import {
  DEFAULT_EQUIPMENT_INVENTORY_FILTER,
  getEquipmentInventoryFilterActiveCount,
  matchesEquipmentInventoryFilter,
  type EquipmentInventoryFilter,
} from '@/shared/utils/equipmentInventoryFilter'

const CATEGORY_ORDER: Record<EquipmentCategory, number> = {
  weapon: 0,
  armor: 1,
  robe: 2,
  shield: 3,
  large_shield: 4,
  gauntlet: 5,
  wand: 6,
  rod: 7,
  accessory: 8,
}

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  weapon: '武器',
  armor: '鎧',
  robe: 'ローブ',
  shield: '盾',
  large_shield: '大盾',
  gauntlet: '小手',
  wand: 'ワンド',
  rod: 'ロッド',
  accessory: 'アクセサリー',
}

const WEAPON_SUB_CATEGORY_LABELS: Record<WeaponSubCategory, string> = {
  sword: '剣',
  axe: '斧',
  spear: '槍',
  bow: '弓',
  staff: '杖',
  claw: '爪',
  hidden: '暗器',
}

type InventoryGroup = {
  key: string
  equipment: EquipmentInstance
  template: EquipmentTemplate
  count: number
}

type InventoryListEntry =
  | { type: 'category'; key: string; label: string }
  | { type: 'item'; key: string; group: InventoryGroup }

function formatBonus(stat: string, value: number): string {
  const displayValue = Number.isInteger(value) ? value : Math.trunc(value * 10) / 10
  const isPercent = stat.includes('percent') || stat === 'damage_reduction'
  return `${displayValue > 0 ? '+' : ''}${displayValue}${isPercent ? '%' : ''}`
}

function getDisplayBonuses(equipment: EquipmentInstance) {
  return EquipmentService.calculateEquipmentBonuses([equipment]).filter((bonus) => {
    const displayValue = Number.isInteger(bonus.value)
      ? bonus.value
      : Math.trunc(bonus.value * 10) / 10
    return displayValue !== 0
  })
}

function getInlineStats(equipment: EquipmentInstance): string {
  return getDisplayBonuses(equipment)
    .map((bonus) => `${getStatLabel(bonus.stat)}${formatBonus(bonus.stat, bonus.value)}`)
    .join('  ')
}

function groupInventory(items: EquipmentInstance[]): InventoryGroup[] {
  const grouped = new Map<string, InventoryGroup>()

  for (const equipment of items) {
    const template = getEquipmentTemplate(equipment.templateId)
    if (!template) continue

    const key = EquipmentModService.getStackKey(equipment)
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
      continue
    }

    grouped.set(key, {
      key,
      equipment,
      template,
      count: 1,
    })
  }

  const templateOrder = new Map(getEquipmentTemplates().map((template, index) => [template.id, index]))
  const titleOrder = new Map(EQUIPMENT_TITLE_DEFS.map((title, index) => [title.id, index]))

  return [...grouped.values()].sort((a, b) => {
    const categoryDifference = CATEGORY_ORDER[a.template.category] - CATEGORY_ORDER[b.template.category]
    if (categoryDifference !== 0) return categoryDifference

    const rarityDifference = (a.template.isRare ? 1 : 0) - (b.template.isRare ? 1 : 0)
    if (rarityDifference !== 0) return rarityDifference

    const templateDifference = (templateOrder.get(a.template.id) ?? 0) - (templateOrder.get(b.template.id) ?? 0)
    if (templateDifference !== 0) return templateDifference

    const titleDifference = (titleOrder.get(a.equipment.titleId ?? 'none') ?? 0)
      - (titleOrder.get(b.equipment.titleId ?? 'none') ?? 0)
    if (titleDifference !== 0) return titleDifference

    return EquipmentModService.getModSignature(a.equipment)
      .localeCompare(EquipmentModService.getModSignature(b.equipment))
  })
}

function buildListEntries(groups: InventoryGroup[]): InventoryListEntry[] {
  const entries: InventoryListEntry[] = []
  let currentSectionKey: string | null = null
  const sectionOccurrences = new Map<string, number>()

  for (const group of groups) {
    const { category, subCategory } = group.template
    const sectionKey = category === 'weapon'
      ? `weapon-${subCategory ?? 'unknown'}`
      : category

    if (sectionKey !== currentSectionKey) {
      const occurrence = sectionOccurrences.get(sectionKey) ?? 0
      sectionOccurrences.set(sectionKey, occurrence + 1)
      entries.push({
        type: 'category',
        key: `category-${sectionKey}-${occurrence}`,
        label: category === 'weapon' && subCategory
          ? WEAPON_SUB_CATEGORY_LABELS[subCategory]
          : CATEGORY_LABELS[category],
      })
      currentSectionKey = sectionKey
    }

    entries.push({ type: 'item', key: group.key, group })
  }

  return entries
}

const EquipmentRow = memo(function EquipmentRow({
  group,
  onPress,
}: {
  group: InventoryGroup
  onPress: (equipment: EquipmentInstance) => void
}) {
  const displayName = getEquipmentDisplayName(group.equipment, group.template)
  const itemName = group.count > 1 ? `x${group.count} ${displayName}` : displayName

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={itemName}
      style={styles.itemRow}
      onPress={() => onPress(group.equipment)}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemStats} numberOfLines={1}>
          {getInlineStats(group.equipment)}
        </Text>
        <Text style={styles.itemName} numberOfLines={1}>{itemName}</Text>
      </View>
      <View style={styles.itemTipsButton}>
        <Text style={styles.itemTipsButtonText}>i</Text>
      </View>
    </Pressable>
  )
})

function ItemDetail({
  equipment,
  onClose,
}: {
  equipment: EquipmentInstance | null
  onClose: () => void
}) {
  if (!equipment) return null

  const template = getEquipmentTemplate(equipment.templateId)
  if (!template) return null

  const bonuses = getDisplayBonuses(equipment)
  const skills = EquipmentService.collectGrantedSkills([equipment])

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlayBackground}>
        <View style={styles.detailCard}>
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator
          >
            <Text style={styles.detailName}>
              {getEquipmentDisplayName(equipment, template)}
            </Text>
            <View style={styles.detailList}>
              {bonuses.map((bonus, index) => (
                <Text key={`bonus-${index}`} style={styles.detailListText}>
                  {getStatLabel(bonus.stat)} {formatBonus(bonus.stat, bonus.value)}
                </Text>
              ))}
              {skills.map((skill, index) => (
                <Text key={`skill-${index}`} style={styles.detailListText}>
                  {describeCharacterSkill(skill)}
                </Text>
              ))}
            </View>
            {skills.length > 0 ? (
              <View style={styles.detailSkillDescriptionSection}>
                {skills.map((skill, index) => (
                  <View key={`skill-detail-${index}`} style={styles.detailSkillDescriptionBlock}>
                    <Text style={styles.detailSkillName}>{describeCharacterSkill(skill)}</Text>
                    <Text style={styles.detailSkillDescription}>
                      {getCharacterSkillDescription(skill)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
          <Pressable style={styles.detailCloseButton} onPress={onClose}>
            <Text style={styles.detailCloseButtonText}>閉じる</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

export default function WarehouseScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<EquipmentInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<EquipmentInventoryFilter>(
    DEFAULT_EQUIPMENT_INVENTORY_FILTER,
  )
  const [filterVisible, setFilterVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<EquipmentInstance | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      setItems(await equipmentRepository.getUnequipped())
    } catch (error) {
      console.error('[Warehouse] Failed to load equipment', error)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    void loadItems()
  }, [loadItems]))

  const groups = useMemo(() => groupInventory(items), [items])
  const filteredGroups = useMemo(
    () => groups.filter((group) => matchesEquipmentInventoryFilter(group, selectedFilter)),
    [groups, selectedFilter],
  )
  const entries = useMemo(() => buildListEntries(filteredGroups), [filteredGroups])
  const activeFilterCount = getEquipmentInventoryFilterActiveCount(selectedFilter)

  const handleApplyFilter = useCallback((filter: EquipmentInventoryFilter) => {
    setSelectedFilter(filter)
    setFilterVisible(false)
  }, [])

  const renderItem = useCallback(({ item }: { item: InventoryListEntry }) => {
    if (item.type === 'category') {
      return (
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{item.label}</Text>
        </View>
      )
    }
    return <EquipmentRow group={item.group} onPress={setSelectedItem} />
  }, [])

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.stateText}>{t('ui.common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={entries}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.screenTitle}>{t('ui.warehouse.title')}</Text>
              <Text style={styles.itemCount}>{t('ui.warehouse.itemCount', { count: items.length })}</Text>
            </View>
            <Pressable style={styles.filterButton} onPress={() => setFilterVisible(true)}>
              <Text style={styles.filterButtonText}>
                {activeFilterCount > 0
                  ? t('ui.equipmentInventoryFilter.summary', { count: activeFilterCount })
                  : t('ui.equipmentInventoryFilter.all')}
              </Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loadFailed
                ? t('ui.warehouse.loadError')
                : items.length === 0
                  ? t('ui.warehouse.empty')
                  : t('ui.warehouse.emptyFiltered')}
            </Text>
            {loadFailed ? (
              <Pressable style={styles.retryButton} onPress={() => void loadItems()}>
                <Text style={styles.retryButtonText}>{t('ui.warehouse.retry')}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        ListFooterComponent={<View style={{ height: insets.bottom + 24 }} />}
      />

      <EquipmentInventoryFilterSheet
        visible={filterVisible}
        value={selectedFilter}
        targets={groups}
        onApply={handleApplyFilter}
        onClose={() => setFilterVisible(false)}
      />

      <ItemDetail equipment={selectedItem} onClose={() => setSelectedItem(null)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    color: '#6B7280',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  screenTitle: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
  },
  itemCount: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  filterButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterButtonText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryHeader: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  categoryTitle: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemStats: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 4,
  },
  itemName: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  itemTipsButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
  },
  itemTipsButtonText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
  },
  itemSeparator: {
    height: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 220,
    gap: 14,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  overlayBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    padding: 20,
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    padding: 16,
  },
  detailScroll: {
    flexGrow: 0,
  },
  detailScrollContent: {
    paddingBottom: 12,
  },
  detailName: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailList: {
    marginBottom: 12,
  },
  detailListText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  detailSkillDescriptionSection: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  detailSkillDescriptionBlock: {
    marginBottom: 10,
  },
  detailSkillName: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailSkillDescription: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 16,
  },
  detailCloseButton: {
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 11,
  },
  detailCloseButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
})
