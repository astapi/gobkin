import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, Alert, ScrollView } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import type { EquipmentInstance, EquipmentTemplate, EquipmentCategory, CharacterSkill } from '@/shared/types'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useEquipmentService } from '@/presentation/hooks/useEquipmentService'
import { EquipmentService } from '@/core/services/EquipmentService'
import { getEquipmentTemplate, getEquipmentTemplates } from '@/shared/data/equipmentPoolLoader'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import {
  applySkillBonusesToEquipmentBonuses,
  describeCharacterSkill,
  getCharacterSkillDescription,
} from '@/shared/data/characterSkills'
import { getEquipmentDisplayName, getStatLabel } from '@/shared/i18n/entityLocalization'
import type { Goblin } from '@/shared/types'

const CATEGORY_ORDER: Record<EquipmentCategory, number> = {
  weapon: 0,
  armor: 1,
  robe: 2,
  shield: 3,
  gauntlet: 4,
  wand: 5,
  rod: 6,
  accessory: 7,
}

function getDisplayName(eq: EquipmentInstance, template: EquipmentTemplate): string {
  return getEquipmentDisplayName(eq, template)
}

type InventoryGroup = {
  key: string
  equipment: EquipmentInstance
  template: EquipmentTemplate
  count: number
}

type DisplayBonus = {
  stat: string
  value: number
  originalValue: number
}

function formatBonus(stat: string, value: number): string {
  const displayValue = Number.isInteger(value)
    ? value
    : Math.trunc(value * 10) / 10
  const isPercent = stat.includes('percent') || stat === 'damage_reduction'
  return `${displayValue > 0 ? '+' : ''}${displayValue}${isPercent ? '%' : ''}`
}

function isDisplayValueZero(value: number): boolean {
  const displayValue = Number.isInteger(value)
    ? value
    : Math.trunc(value * 10) / 10
  return displayValue === 0
}

function getInlineBonusLabel(bonus: DisplayBonus): string {
  const label = getStatLabel(bonus.stat)
  return `${label}${formatBonus(bonus.stat, bonus.value)}`
}

function getDetailBonusLabel(bonus: DisplayBonus): string {
  const { stat, value, originalValue } = bonus
  const label = getStatLabel(stat)
  const originalSuffix = value !== originalValue
    ? `(${formatBonus(stat, originalValue)})`
    : ''
  return `${label} ${formatBonus(stat, value)}${originalSuffix}`
}

function getDisplayBonuses(
  eq: EquipmentInstance,
  skills: CharacterSkill[] = [],
  penaltyMultiplier = 1,
): DisplayBonus[] {
  const originalBonuses = EquipmentService.calculateEquipmentBonuses([eq])
  const penalizedBonuses = originalBonuses.map((bonus) => ({
    ...bonus,
    value: Number((bonus.value * penaltyMultiplier).toFixed(4)),
  }))
  const adjustedBonuses = applySkillBonusesToEquipmentBonuses(skills, penalizedBonuses)

  return adjustedBonuses
    .map((bonus, index) => ({
      stat: bonus.stat,
      value: bonus.value,
      originalValue: originalBonuses[index]?.value ?? bonus.value,
    }))
    .filter((bonus) => !isDisplayValueZero(bonus.value))
}

function getDisplaySkills(eq: EquipmentInstance) {
  return EquipmentService.collectGrantedSkills([eq])
}

function formatPenaltyName(penaltyPercent: number, name: string): string {
  return `${penaltyPercent}％ ${name}`
}

/** カテゴリ→ノーマル→レア→定義順→称号レア度（低→高）でソート */
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
    const rareDiff = (tA.isRare ? 1 : 0) - (tB.isRare ? 1 : 0)
    if (rareDiff !== 0) return rareDiff
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
function ItemDetail({
  equipment,
  template,
  visible,
  onClose,
  onUnequip,
  characterSkills,
  penaltyPercent,
}: {
  equipment: EquipmentInstance
  template: EquipmentTemplate
  visible: boolean
  onClose: () => void
  onUnequip?: () => void
  characterSkills: CharacterSkill[]
  penaltyPercent?: number
}) {
  const penaltyMultiplier = penaltyPercent === undefined ? 1 : penaltyPercent / 100
  const displayBonuses = getDisplayBonuses(equipment, characterSkills, penaltyMultiplier)
  const displaySkills = getDisplaySkills(equipment)

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlayBackground}>
        <View style={styles.detailCard}>
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.detailName}>
              {penaltyPercent === undefined
                ? getDisplayName(equipment, template)
                : formatPenaltyName(penaltyPercent, getDisplayName(equipment, template))}
            </Text>

            <View style={styles.detailList}>
              {displayBonuses.map((bonus, i) => (
                <Text key={`bonus-${i}`} style={styles.detailListText}>
                  {getDetailBonusLabel(bonus)}
                </Text>
              ))}
              {displaySkills.map((skill, i) => (
                <Text key={`skill-name-${i}`} style={styles.detailListText}>
                  {describeCharacterSkill(skill)}
                </Text>
              ))}
            </View>

            {displaySkills.length > 0 && (
              <View style={styles.detailSkillDescriptionSection}>
                {displaySkills.map((skill, i) => (
                  <View key={`skill-detail-${i}`} style={styles.detailSkillDescriptionBlock}>
                    <Text style={styles.detailSkillName}>{describeCharacterSkill(skill)}</Text>
                    <Text style={styles.detailSkillDescription}>
                      {getCharacterSkillDescription(skill)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.detailActions}>
            {onUnequip && (
              <TouchableOpacity style={styles.unequipButton} onPress={onUnequip}>
                <Text style={styles.unequipButtonText}>外す</Text>
              </TouchableOpacity>
            )}
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
  onShowDetail,
  highlighted,
  count,
  characterSkills,
  penaltyPercent,
}: {
  eq: EquipmentInstance
  template: EquipmentTemplate
  onPress: () => void
  onShowDetail: () => void
  highlighted?: boolean
  count?: number
  characterSkills: CharacterSkill[]
  penaltyPercent?: number
}) {
  const penaltyMultiplier = penaltyPercent === undefined ? 1 : penaltyPercent / 100
  const displayBonuses = getDisplayBonuses(eq, characterSkills, penaltyMultiplier)
  const inlineStats = displayBonuses.map((bonus) => getInlineBonusLabel(bonus)).join('  ')
  const displayName = getDisplayName(eq, template)
  const itemName = penaltyPercent !== undefined
    ? formatPenaltyName(penaltyPercent, displayName)
    : count && count > 1 ? `x${count} ${displayName}` : displayName

  return (
    <TouchableOpacity
      style={[
        styles.itemRow,
        highlighted && styles.itemRowHighlighted,
        penaltyPercent !== undefined && styles.itemRowPenalty,
      ]}
      onPress={onPress}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemStats} numberOfLines={1}>
          {inlineStats}
        </Text>
        <Text style={styles.itemName} numberOfLines={1}>
          {itemName}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.itemTipsButton}
        onPress={(event) => {
          event.stopPropagation()
          onShowDetail()
        }}
      >
        <Text style={styles.itemTipsButtonText}>i</Text>
      </TouchableOpacity>
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
  const [selectedDetail, setSelectedDetail] = useState<EquipmentInstance | null>(null)

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
  const penaltyPercents = useMemo(() => {
    const multipliers = EquipmentService.getEquipmentPenaltyMultipliers(equippedItems)
    return new Map(
      Array.from(multipliers.entries()).map(([templateId, multiplier]) => [
        templateId,
        Math.round(multiplier * 100),
      ]),
    )
  }, [equippedItems])
  const characterSkills = useMemo(
    () => goblin ? [...goblin.skills, ...EquipmentService.collectGrantedSkills(equippedItems)] : [],
    [goblin, equippedItems],
  )
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

  const handleUnequip = useCallback(async (equipment: EquipmentInstance) => {
    if (!goblin) return
    pendingScrollRestoreRef.current = true
    await unequipItem(goblin, equipment)
    setSelectedDetail(null)
  }, [goblin, unequipItem])

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
            onShowDetail={() => setSelectedDetail(item.equipment)}
            highlighted={emptySlots > 0}
            count={item.count}
            characterSkills={characterSkills}
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
                      onPress={() => handleUnequip(eq)}
                      onShowDetail={() => setSelectedDetail(eq)}
                      characterSkills={characterSkills}
                      penaltyPercent={penaltyPercents.get(eq.templateId)}
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

      {selectedDetail && getEquipmentTemplate(selectedDetail.templateId) && (
        <ItemDetail
          equipment={selectedDetail}
          template={getEquipmentTemplate(selectedDetail.templateId)!}
          visible={true}
          onClose={() => setSelectedDetail(null)}
          onUnequip={selectedDetail.goblinId != null && selectedDetail.slotIndex >= 0 ? () => handleUnequip(selectedDetail) : undefined}
          characterSkills={characterSkills}
          penaltyPercent={
            selectedDetail.goblinId != null && selectedDetail.slotIndex >= 0
              ? penaltyPercents.get(selectedDetail.templateId)
              : undefined
          }
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
  itemRowPenalty: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  itemInfo: {
    flex: 1,
  },
  itemStats: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemTipsButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  itemTipsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
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
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  detailScroll: {
    flexGrow: 0,
  },
  detailScrollContent: {
    padding: 24,
    paddingBottom: 16,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailList: {
    marginBottom: 10,
  },
  detailListText: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
    lineHeight: 16,
  },
  detailSkillDescriptionSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  detailSkillDescriptionBlock: {
    marginBottom: 8,
  },
  detailSkillName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  detailSkillDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: '#4B5563',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 0,
    paddingHorizontal: 24,
    paddingBottom: 20,
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
