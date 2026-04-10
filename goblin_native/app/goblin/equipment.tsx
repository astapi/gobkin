import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, Alert } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import type { EquipmentInstance, EquipmentTemplate, EquipmentCategory } from '@/shared/types'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useEquipmentService } from '@/presentation/hooks/useEquipmentService'
import { EquipmentService } from '@/core/services/EquipmentService'
import { getEquipmentTemplate, getEquipmentTemplates } from '@/shared/data/equipmentPoolLoader'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import { describeCharacterSkill } from '@/shared/data/characterSkills'
import { getEquipmentDescription, getEquipmentDisplayName } from '@/shared/i18n/entityLocalization'
import type { Goblin } from '@/shared/types'

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  weapon: '武器',
  armor: '防具',
  accessory: '装飾',
}

const CATEGORY_ORDER: Record<EquipmentCategory, number> = {
  weapon: 0,
  armor: 1,
  accessory: 2,
}

const STAT_LABELS: Record<string, string> = {
  hp_percent: 'HP', hp_flat: 'HP',
  atk_percent: 'ATK', atk_flat: 'ATK',
  def_percent: 'DEF', def_flat: 'DEF',
  attackCount_percent: '攻撃回数', attackCount_flat: '攻撃回数',
  accuracy_percent: '命中精度', accuracy_flat: '命中精度',
  evasion_percent: '回避', evasion_flat: '回避',
}

function getDisplayName(eq: EquipmentInstance, template: EquipmentTemplate): string {
  return getEquipmentDisplayName(eq, template)
}

function getDisplayDescription(template: EquipmentTemplate): string {
  return getEquipmentDescription(template)
}

type InventoryGroup = {
  key: string
  equipment: EquipmentInstance
  template: EquipmentTemplate
  count: number
}

function formatBonus(stat: string, value: number): string {
  const isPercent = stat.includes('percent') || stat === 'damage_reduction'
  return `${value > 0 ? '+' : ''}${value}${isPercent ? '%' : ''}`
}

/** カテゴリ→定義順→称号レア度（低→高）でソート */
function sortEquipment(items: EquipmentInstance[]): EquipmentInstance[] {
  const allTemplates = getEquipmentTemplates()
  const templateOrder = new Map(allTemplates.map((t, i) => [t.id, i]))
  const titleOrder = new Map(EQUIPMENT_TITLE_DEFS.map((t, i) => [t.id, i]))
  return [...items].sort((a, b) => {
    const tA = getEquipmentTemplate(a.templateId)
    const tB = getEquipmentTemplate(b.templateId)
    if (!tA || !tB) return 0
    const catDiff = CATEGORY_ORDER[tA.category] - CATEGORY_ORDER[tB.category]
    if (catDiff !== 0) return catDiff
    const orderA = templateOrder.get(a.templateId) ?? 0
    const orderB = templateOrder.get(b.templateId) ?? 0
    if (orderA !== orderB) return orderA - orderB
    const titleA = titleOrder.get(a.titleId ?? 'none') ?? 0
    const titleB = titleOrder.get(b.titleId ?? 'none') ?? 0
    return titleA - titleB
  })
}

function groupInventory(items: EquipmentInstance[]): InventoryGroup[] {
  const grouped = new Map<string, InventoryGroup>()

  for (const eq of sortEquipment(items)) {
    const template = getEquipmentTemplate(eq.templateId)
    if (!template) continue

    const key = `${eq.templateId}::${eq.titleId ?? 'none'}`
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
      continue
    }

    grouped.set(key, {
      key,
      equipment: eq,
      template,
      count: 1,
    })
  }

  return Array.from(grouped.values())
}

/** 装備済みアイテムの詳細モーダル */
function EquippedItemDetail({
  equipment,
  template,
  visible,
  onClose,
  onUnequip,
}: {
  equipment: EquipmentInstance
  template: EquipmentTemplate
  visible: boolean
  onClose: () => void
  onUnequip: () => void
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlayBackground}>
        <View style={styles.detailCard}>
          <Text style={styles.detailName}>
            {getDisplayName(equipment, template)}
          </Text>
          <Text style={styles.detailCategory}>
            {CATEGORY_LABELS[template.category]}
          </Text>

          {getDisplayDescription(template) && (
            <Text style={styles.detailDescription}>{getDisplayDescription(template)}</Text>
          )}

          <View style={styles.detailBonuses}>
            {template.statBonuses.map((bonus, i) => (
              <View key={i} style={styles.bonusBadge}>
                <Text style={styles.bonusBadgeText}>
                  {STAT_LABELS[bonus.stat] ?? bonus.stat} {formatBonus(bonus.stat, bonus.value)}
                </Text>
              </View>
            ))}
            {template.grantedSkills?.map((skill, i) => (
              <View key={`skill-${i}`} style={styles.bonusBadge}>
                <Text style={styles.bonusBadgeText}>
                  {describeCharacterSkill(skill)}
                </Text>
              </View>
            ))}
          </View>

          {template.effects && template.effects.length > 0 && (
            <View style={styles.detailEffects}>
              {template.effects.map((effect, i) => (
                <Text key={i} style={styles.effectText}>
                  {effect.type}: {effect.value}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.detailActions}>
            <TouchableOpacity style={styles.unequipButton} onPress={onUnequip}>
              <Text style={styles.unequipButtonText}>外す</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailCloseButton} onPress={onClose}>
              <Text style={styles.detailCloseButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** 装備アイテム1行 */
function EquipmentRow({
  eq,
  template,
  onPress,
  highlighted,
  count,
}: {
  eq: EquipmentInstance
  template: EquipmentTemplate
  onPress: () => void
  highlighted?: boolean
  count?: number
}) {
  return (
    <TouchableOpacity
      style={[styles.itemRow, highlighted && styles.itemRowHighlighted]}
      onPress={onPress}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {count && count > 1 ? `x${count} ${getDisplayName(eq, template)}` : getDisplayName(eq, template)}
        </Text>
        <View style={styles.itemBonusRow}>
          {template.statBonuses.map((bonus, i) => (
            <View key={i} style={styles.itemBonusBadge}>
              <Text style={styles.itemBonusText}>
                {STAT_LABELS[bonus.stat] ?? bonus.stat} {formatBonus(bonus.stat, bonus.value)}
              </Text>
            </View>
          ))}
          {template.grantedSkills?.map((skill, i) => (
            <View key={`skill-${i}`} style={styles.itemBonusBadge}>
              <Text style={styles.itemBonusText}>
                {describeCharacterSkill(skill)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function EquipmentScreenPage() {
  const { goblinId } = useLocalSearchParams<{ goblinId: string }>()
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList<InventoryGroup>>(null)
  const scrollOffsetRef = useRef(0)
  const headerHeightRef = useRef(0)
  const pendingScrollRestoreRef = useRef(false)
  const getGoblinById = useGoblinStore((state) => state.getGoblinById)
  const { equippedItems, inventoryItems, refreshEquipment, equipItem, unequipItem } =
    useEquipmentService()
  const [goblin, setGoblin] = useState<Goblin | null>(null)
  const [selectedEquipped, setSelectedEquipped] = useState<EquipmentInstance | null>(null)

  useEffect(() => {
    if (!goblinId) return
    void getGoblinById(parseInt(goblinId, 10))
      .then(setGoblin)
      .catch(() => setGoblin(null))
  }, [goblinId, getGoblinById])

  const maxSlots = useMemo(
    () => goblin ? EquipmentService.getAvailableSlots(goblin) : 0,
    [goblin],
  )

  useEffect(() => {
    if (goblin) {
      void refreshEquipment(goblin.id)
    }
  }, [goblin, refreshEquipment])

  const sortedEquipped = useMemo(() => sortEquipment(equippedItems), [equippedItems])
  const groupedInventory = useMemo(() => groupInventory(inventoryItems), [inventoryItems])
  const emptySlots = maxSlots - equippedItems.length
  const listBottomSpacerHeight = useMemo(
    () => insets.bottom + 56,
    [insets.bottom],
  )

  const restoreScrollPosition = useCallback((nextHeaderHeight: number) => {
    if (!pendingScrollRestoreRef.current) {
      headerHeightRef.current = nextHeaderHeight
      return
    }

    const headerDelta = nextHeaderHeight - headerHeightRef.current
    const nextOffset = Math.max(0, scrollOffsetRef.current + headerDelta)

    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
    })

    scrollOffsetRef.current = nextOffset
    headerHeightRef.current = nextHeaderHeight
    pendingScrollRestoreRef.current = false
  }, [])

  const handleEquip = useCallback(
    async (equipment: EquipmentInstance) => {
      if (!goblin) return
      const usedSlots = new Set(equippedItems.map(e => e.slotIndex))
      let targetSlot = -1
      for (let i = 0; i < maxSlots; i++) {
        if (!usedSlots.has(i)) {
          targetSlot = i
          break
        }
      }
      if (targetSlot < 0) {
        Alert.alert('空きスロットなし', '先に装備を外してください')
        return
      }
      pendingScrollRestoreRef.current = true
      const result = await equipItem(goblin, equipment, targetSlot)
      if (!result.success) {
        pendingScrollRestoreRef.current = false
        Alert.alert('装備エラー', result.error ?? '装備できませんでした')
        return
      }
    },
    [equippedItems, maxSlots, goblin, equipItem],
  )

  const handleUnequip = useCallback(async () => {
    if (!selectedEquipped || !goblin) return
    pendingScrollRestoreRef.current = true
    await unequipItem(goblin, selectedEquipped)
    setSelectedEquipped(null)
  }, [selectedEquipped, goblin, unequipItem])

  const selectedEquippedTemplate = selectedEquipped
    ? getEquipmentTemplate(selectedEquipped.templateId)
    : null

  if (!goblin) return null

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        ref={listRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y
        }}
        data={groupedInventory}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <EquipmentRow
            eq={item.equipment}
            template={item.template}
            onPress={() => handleEquip(item.equipment)}
            highlighted={emptySlots > 0}
            count={item.count}
          />
        )}
        ListHeaderComponent={(
          <>
            <View
              style={styles.section}
              onLayout={(event) => {
                restoreScrollPosition(event.nativeEvent.layout.height)
              }}
            >
              <Text style={styles.sectionTitle}>装備枠 ({equippedItems.length}/{maxSlots})</Text>
              <View style={styles.slotList}>
                {sortedEquipped.map(eq => {
                  const template = getEquipmentTemplate(eq.templateId)
                  if (!template) return null
                  return (
                    <EquipmentRow
                      key={eq.id}
                      eq={eq}
                      template={template}
                      onPress={() => setSelectedEquipped(eq)}
                    />
                  )
                })}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.emptySlot}>
                    <Text style={styles.emptySlotText}>空きスロット</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>所持アイテム</Text>
            </View>
          </>
        )}
        ListEmptyComponent={(
          <View style={[styles.section, styles.inventoryEmptySection]}>
            <View style={styles.emptyInventory}>
              <Text style={styles.emptyInventoryText}>所持アイテムがありません</Text>
            </View>
          </View>
        )}
        ListFooterComponent={<View style={{ height: listBottomSpacerHeight }} />}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      />

      {selectedEquipped && selectedEquippedTemplate && (
        <EquippedItemDetail
          equipment={selectedEquipped}
          template={selectedEquippedTemplate}
          visible={true}
          onClose={() => setSelectedEquipped(null)}
          onUnequip={handleUnequip}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  slotList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  itemSeparator: {
    height: 8,
  },
  inventoryEmptySection: {
    marginTop: -16,
  },
  itemRowHighlighted: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F9FF',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemBonusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  itemBonusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#DCFCE7',
  },
  itemBonusText: {
    fontSize: 10,
    color: '#166534',
    fontWeight: '600',
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
  },
  emptySlotText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  emptyInventory: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyInventoryText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  detailCategory: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  detailDescription: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 18,
  },
  detailBonuses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  bonusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
  },
  bonusBadgeText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  detailEffects: {
    marginBottom: 12,
  },
  effectText: {
    fontSize: 12,
    color: '#7C3AED',
    marginBottom: 4,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  unequipButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unequipButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  detailCloseButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailCloseButtonText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 14,
  },
})
