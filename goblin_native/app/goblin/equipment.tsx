import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, Alert, ScrollView, ActivityIndicator, Animated, Pressable } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import type {
  EquipmentInstance,
  EquipmentTemplate,
  EquipmentCategory,
  WeaponSubCategory,
  CharacterSkill,
  GoblinStats,
} from '@/shared/types'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useToastDismissStore } from '@/presentation/stores/useToastDismissStore'
import { useEquipmentService } from '@/presentation/hooks/useEquipmentService'
import { EquipmentService } from '@/core/services/EquipmentService'
import { EquipmentModService } from '@/core/services/EquipmentModService'
import { getEquipmentTemplate, getEquipmentTemplates } from '@/shared/data/equipmentPoolLoader'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import {
  applySkillBonusesToEquipmentBonuses,
  describeCharacterSkill,
  getCharacterSkillDescription,
} from '@/shared/data/characterSkills'
import { getEquipmentDisplayName, getStatLabel } from '@/shared/i18n/entityLocalization'
import { calculateGoblinEffectiveStats } from '@/shared/utils/goblinStats'
import type { Goblin } from '@/shared/types'

const EQUIPMENT_TOAST_DISPLAY_MS = 4200
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const STAT_CHANGE_KEYS: ReadonlyArray<keyof GoblinStats> = [
  'hp',
  'atk',
  'magicAtk',
  'def',
  'magicDef',
  'attackCount',
  'accuracy',
  'evasion',
  'magicHeal',
  'criticalRate',
]

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

const CATEGORY_FILTER_ORDER: Exclude<EquipmentCategory, 'weapon'>[] = [
  'armor',
  'robe',
  'shield',
  'large_shield',
  'gauntlet',
  'wand',
  'rod',
  'accessory',
]

const WEAPON_SUB_CATEGORY_FILTER_ORDER: WeaponSubCategory[] = [
  'sword',
  'claw',
  'bow',
  'hidden',
]

type InventoryFilter =
  | {
      type: 'all'
      key: 'all'
      label: string
    }
  | {
      type: 'weaponSubCategory'
      key: WeaponSubCategory
      label: string
    }
  | {
      type: 'category'
      key: Exclude<EquipmentCategory, 'weapon'>
      label: string
    }

const ALL_INVENTORY_FILTER: InventoryFilter = { type: 'all', key: 'all', label: 'すべて' }

function getDisplayName(eq: EquipmentInstance, template: EquipmentTemplate): string {
  return getEquipmentDisplayName(eq, template)
}

type InventoryGroup = {
  key: string
  equipment: EquipmentInstance
  template: EquipmentTemplate
  count: number
  isEquipped: boolean
}

type InventoryListEntry =
  | {
      type: 'category'
      key: string
      label: string
    }
  | {
      type: 'item'
      key: string
      group: InventoryGroup
    }

type DisplayBonus = {
  stat: string
  value: number
  originalValue: number
  sourceModSlot?: 'prefix' | 'suffix'
  sourceModTier?: number
}

type EquipmentStatToastData = {
  id: number
  equipmentName: string
  statChanges: string
}

function formatStatChanges(before: GoblinStats, after: GoblinStats): string {
  const changes = STAT_CHANGE_KEYS.flatMap((key) => {
    const difference = after[key] - before[key]
    if (difference === 0) return []
    const formattedDifference = Number.isInteger(difference)
      ? difference
      : Math.trunc(difference * 10) / 10
    return [`${getStatLabel(key)} ${formattedDifference > 0 ? '+' : ''}${formattedDifference}`]
  })

  return changes.length > 0 ? changes.join('  ') : '能力値の変化なし'
}

function EquipmentStatToastItem({
  toast,
  onDone,
  onDismissAll,
}: {
  toast: EquipmentStatToastData
  onDone: (id: number) => void
  onDismissAll: () => void
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => onDone(toast.id))
    }, EQUIPMENT_TOAST_DISPLAY_MS)

    return () => clearTimeout(timer)
  }, [onDone, opacity, toast.id, translateY])

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="表示中の装備通知をすべて閉じる"
      onPress={onDismissAll}
      style={[
        styles.equipmentToast,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.equipmentToastTitle} numberOfLines={1}>
        {toast.equipmentName}を装備
      </Text>
      <Text style={styles.equipmentToastStats}>{toast.statChanges}</Text>
    </AnimatedPressable>
  )
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
  const { stat, value, originalValue, sourceModSlot, sourceModTier } = bonus
  const label = getStatLabel(stat)
  const originalSuffix = value !== originalValue
    ? `(${formatBonus(stat, originalValue)})`
    : ''
  const modLabel = sourceModSlot && sourceModTier
    ? `[${sourceModSlot === 'prefix' ? 'Prefix' : 'Suffix'} T${sourceModTier}] `
    : ''
  return `${modLabel}${label} ${formatBonus(stat, value)}${originalSuffix}`
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
      sourceModSlot: bonus.sourceModSlot,
      sourceModTier: bonus.sourceModTier,
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

function groupInventory(
  inventoryItems: EquipmentInstance[],
  equippedItems: EquipmentInstance[],
): InventoryGroup[] {
  const grouped = new Map<string, InventoryGroup>()

  for (const eq of inventoryItems) {
    const template = getEquipmentTemplate(eq.templateId)
    if (!template) continue

    const key = `inv::${EquipmentModService.getStackKey(eq)}`
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
      isEquipped: false,
    })
  }

  const equippedGroups: InventoryGroup[] = []
  for (const eq of equippedItems) {
    const template = getEquipmentTemplate(eq.templateId)
    if (!template) continue
    equippedGroups.push({
      key: `eq::${eq.id}`,
      equipment: eq,
      template,
      count: 1,
      isEquipped: true,
    })
  }

  return sortInventoryGroups([...grouped.values(), ...equippedGroups])
}

function sortInventoryGroups(groups: InventoryGroup[]): InventoryGroup[] {
  const allTemplates = getEquipmentTemplates()
  const templateOrder = new Map(allTemplates.map((t, i) => [t.id, i]))
  const titleOrder = new Map(EQUIPMENT_TITLE_DEFS.map((t, i) => [t.id, i]))
  return [...groups].sort((a, b) => {
    const tA = a.template
    const tB = b.template
    const catDiff = CATEGORY_ORDER[tA.category] - CATEGORY_ORDER[tB.category]
    if (catDiff !== 0) return catDiff
    const rareDiff = (tA.isRare ? 1 : 0) - (tB.isRare ? 1 : 0)
    if (rareDiff !== 0) return rareDiff
    const orderA = templateOrder.get(tA.id) ?? 0
    const orderB = templateOrder.get(tB.id) ?? 0
    if (orderA !== orderB) return orderA - orderB
    const titleA = titleOrder.get(a.equipment.titleId ?? 'none') ?? 0
    const titleB = titleOrder.get(b.equipment.titleId ?? 'none') ?? 0
    if (titleA !== titleB) return titleA - titleB
    const modDiff = EquipmentModService.getModSignature(a.equipment)
      .localeCompare(EquipmentModService.getModSignature(b.equipment))
    if (modDiff !== 0) return modDiff
    return (a.isEquipped ? 1 : 0) - (b.isEquipped ? 1 : 0)
  })
}

function buildInventoryListEntries(groups: InventoryGroup[]): InventoryListEntry[] {
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

    entries.push({
      type: 'item',
      key: group.key,
      group,
    })
  }

  return entries
}

function matchesInventoryFilter(group: InventoryGroup, filter: InventoryFilter): boolean {
  if (filter.type === 'all') return true
  if (filter.type === 'weaponSubCategory') {
    return group.template.category === 'weapon' && group.template.subCategory === filter.key
  }
  return group.template.category === filter.key
}

function buildInventoryFilterOptions(groups: InventoryGroup[]): InventoryFilter[] {
  const categories = new Set(groups.map((group) => group.template.category))
  const weaponSubCategories = new Set(
    groups
      .map((group) => group.template.subCategory)
      .filter((subCategory): subCategory is WeaponSubCategory => Boolean(subCategory)),
  )

  return [
    ALL_INVENTORY_FILTER,
    ...WEAPON_SUB_CATEGORY_FILTER_ORDER
      .filter((subCategory) => weaponSubCategories.has(subCategory))
      .map((subCategory): InventoryFilter => ({
        type: 'weaponSubCategory',
        key: subCategory,
        label: WEAPON_SUB_CATEGORY_LABELS[subCategory],
      })),
    ...CATEGORY_FILTER_ORDER
      .filter((category) => categories.has(category))
      .map((category): InventoryFilter => ({
        type: 'category',
        key: category,
        label: CATEGORY_LABELS[category],
      })),
  ]
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
  const listRef = useRef<FlatList<InventoryListEntry>>(null)
  const scrollOffsetRef = useRef(0)
  const headerHeightRef = useRef(0)
  const pendingScrollRestoreRef = useRef(false)
  const pendingScrollOffsetRef = useRef<number | null>(null)
  const getGoblinById = useGoblinStore((state) => state.getGoblinById)
  const toastDismissRevision = useToastDismissStore((state) => state.revision)
  const dismissAllToastLogs = useToastDismissStore((state) => state.dismissAll)
  const { equippedItems, inventoryItems, refreshEquipment, equipItem, unequipItem } =
    useEquipmentService()
  const [goblin, setGoblin] = useState<Goblin | null>(null)
  const [isLoadingGoblin, setIsLoadingGoblin] = useState(true)
  const [selectedDetail, setSelectedDetail] = useState<EquipmentInstance | null>(null)
  const [equipmentStatToasts, setEquipmentStatToasts] = useState<EquipmentStatToastData[]>([])
  const isEquippingRef = useRef(false)
  const equipmentToastIdRef = useRef(0)
  const [selectedInventoryFilter, setSelectedInventoryFilter] = useState<InventoryFilter>(
    ALL_INVENTORY_FILTER,
  )
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false)

  useEffect(() => {
    if (!goblinId) {
      setGoblin(null)
      setIsLoadingGoblin(false)
      return
    }
    let active = true
    setIsLoadingGoblin(true)
    void getGoblinById(parseInt(goblinId, 10))
      .then((fetched) => {
        if (!active) return
        setGoblin(fetched)
        setIsLoadingGoblin(false)
      })
      .catch(() => {
        if (!active) return
        setGoblin(null)
        setIsLoadingGoblin(false)
      })
    return () => {
      active = false
    }
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
  const groupedInventory = useMemo(
    () => groupInventory(inventoryItems, equippedItems),
    [inventoryItems, equippedItems],
  )
  const inventoryFilterOptions = useMemo(
    () => buildInventoryFilterOptions(groupedInventory),
    [groupedInventory],
  )
  const filteredInventoryGroups = useMemo(
    () => groupedInventory.filter((group) => matchesInventoryFilter(group, selectedInventoryFilter)),
    [groupedInventory, selectedInventoryFilter],
  )
  const inventoryListEntries = useMemo(
    () => buildInventoryListEntries(filteredInventoryGroups),
    [filteredInventoryGroups],
  )
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
    () => insets.bottom + 96,
    [insets.bottom],
  )
  const inventoryEmptyText = inventoryItems.length === 0 && equippedItems.length === 0
    ? '所持アイテムがありません'
    : '条件に合うアイテムがありません'

  const restoreScrollPosition = useCallback((nextHeaderHeight: number) => {
    if (!pendingScrollRestoreRef.current) {
      headerHeightRef.current = nextHeaderHeight
      return
    }

    const headerDelta = nextHeaderHeight - headerHeightRef.current
    const savedOffset = pendingScrollOffsetRef.current ?? scrollOffsetRef.current
    const nextOffset = Math.max(0, savedOffset + headerDelta)

    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
    })

    scrollOffsetRef.current = nextOffset
    headerHeightRef.current = nextHeaderHeight
    pendingScrollRestoreRef.current = false
    pendingScrollOffsetRef.current = null
  }, [])

  const handleEquip = useCallback(
    async (equipment: EquipmentInstance) => {
      if (!goblin) return
      // 連打で同一スロットへ二重装備要求が飛ぶのを防ぐ
      if (isEquippingRef.current) return
      isEquippingRef.current = true
      try {
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
        const beforeStats = calculateGoblinEffectiveStats(goblin, equippedItems)
        pendingScrollOffsetRef.current = scrollOffsetRef.current
        pendingScrollRestoreRef.current = true
        const result = await equipItem(goblin, equipment, targetSlot)
        if (!result.success) {
          pendingScrollRestoreRef.current = false
          pendingScrollOffsetRef.current = null
          Alert.alert('装備エラー', result.error ?? '装備できませんでした')
          return
        }
        const afterStats = calculateGoblinEffectiveStats(goblin, [...equippedItems, equipment])
        const template = getEquipmentTemplate(equipment.templateId)
        equipmentToastIdRef.current += 1
        const toast = {
          id: equipmentToastIdRef.current,
          equipmentName: template ? getDisplayName(equipment, template) : equipment.templateId,
          statChanges: formatStatChanges(beforeStats, afterStats),
        }
        setEquipmentStatToasts(current => [toast, ...current].slice(0, 4))
      } finally {
        isEquippingRef.current = false
      }
    },
    [equippedItems, maxSlots, goblin, equipItem],
  )

  const handleUnequip = useCallback(async (equipment: EquipmentInstance) => {
    if (!goblin) return
    pendingScrollOffsetRef.current = scrollOffsetRef.current
    pendingScrollRestoreRef.current = true
    await unequipItem(goblin, equipment)
    setSelectedDetail(null)
  }, [goblin, unequipItem])

  const handleEquipmentToastDone = useCallback((id: number) => {
    setEquipmentStatToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const dismissAllEquipmentToasts = useCallback(() => {
    setEquipmentStatToasts([])
    dismissAllToastLogs()
  }, [dismissAllToastLogs])

  useEffect(() => {
    setEquipmentStatToasts([])
  }, [toastDismissRevision])

  if (isLoadingGoblin) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.stateText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!goblin) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>ゴブリンが見つかりません</Text>
          <TouchableOpacity style={styles.stateBackButton} onPress={() => router.back()}>
            <Text style={styles.stateBackButtonText}>戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <FlatList
          ref={listRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          bounces={true}
          nestedScrollEnabled={true}
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y
          }}
          data={inventoryListEntries}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.type === 'category') {
              return (
                <View style={styles.inventoryCategoryHeader}>
                  <Text style={styles.inventoryCategoryTitle}>
                    {item.label}
                  </Text>
                </View>
              )
            }

            const { group } = item
            const isEquipped = group.isEquipped
            return (
              <EquipmentRow
                eq={group.equipment}
                template={group.template}
                onPress={() => isEquipped ? handleUnequip(group.equipment) : handleEquip(group.equipment)}
                onShowDetail={() => setSelectedDetail(group.equipment)}
                highlighted={!isEquipped && emptySlots > 0}
                count={group.count}
                characterSkills={characterSkills}
                penaltyPercent={isEquipped ? penaltyPercents.get(group.equipment.templateId) : undefined}
              />
            )
          }}
          ListHeaderComponent={(
            <>
              <View
                style={styles.equipmentHeaderGroup}
                onLayout={(event) => {
                  restoreScrollPosition(event.nativeEvent.layout.height)
                }}
              >
                <View style={styles.flatSectionHeader}>
                  <Text style={styles.flatSectionTitle}>装備枠 ({equippedItems.length}/{maxSlots})</Text>
                </View>
                <View style={styles.section}>
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
              </View>

              <View style={[styles.flatSectionHeader, styles.inventoryHeaderRow]}>
                <Text style={styles.flatSectionTitle}>所持アイテム</Text>
                <TouchableOpacity
                  style={styles.inventoryFilterButton}
                  activeOpacity={0.8}
                  onPress={() => setIsFilterSheetVisible(true)}
                >
                  <Text style={styles.inventoryFilterStatus}>
                    {selectedInventoryFilter.label}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          ListEmptyComponent={(
            <View style={styles.inventoryEmptySection}>
              <View style={styles.emptyInventory}>
                <Text style={styles.emptyInventoryText}>{inventoryEmptyText}</Text>
              </View>
            </View>
          )}
          ListFooterComponent={<View style={{ height: listBottomSpacerHeight }} />}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        />

      <Modal
        visible={isFilterSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsFilterSheetVisible(false)}
      >
        <View style={styles.filterSheetOverlay}>
          <TouchableOpacity
            style={styles.filterSheetBackdrop}
            activeOpacity={1}
            onPress={() => setIsFilterSheetVisible(false)}
          />
          <View
            style={[styles.filterSheet, { paddingBottom: insets.bottom + 16 }]}
          >
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>絞り込み</Text>
              <TouchableOpacity onPress={() => setIsFilterSheetVisible(false)}>
                <Text style={styles.filterSheetClose}>閉じる</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.filterOptionScroll}
              contentContainerStyle={styles.filterOptionGrid}
              showsVerticalScrollIndicator={false}
            >
              {inventoryFilterOptions.map((option) => {
                  const isSelected = option.type === selectedInventoryFilter.type
                    && option.key === selectedInventoryFilter.key
                  return (
                    <TouchableOpacity
                      key={`${option.type}-${option.key}`}
                      style={[
                        styles.filterOption,
                        isSelected && styles.filterOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedInventoryFilter(option)
                        setIsFilterSheetVisible(false)
                        requestAnimationFrame(() => {
                          listRef.current?.scrollToOffset({
                            offset: headerHeightRef.current,
                            animated: true,
                          })
                        })
                      }}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          isSelected && styles.filterOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      {equipmentStatToasts.length > 0 && (
        <View
          pointerEvents="box-none"
          style={[styles.equipmentToastContainer, { bottom: insets.bottom + 12 }]}
        >
          {equipmentStatToasts.map(toast => (
            <EquipmentStatToastItem
              key={toast.id}
              toast={toast}
              onDone={handleEquipmentToastDone}
              onDismissAll={dismissAllEquipmentToasts}
            />
          ))}
        </View>
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
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  stateText: {
    fontSize: 14,
    color: '#6B7280',
  },
  stateBackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  stateBackButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  equipmentToastContainer: {
    position: 'absolute',
    left: 12,
    zIndex: 40,
    elevation: 40,
    flexDirection: 'column-reverse',
    alignItems: 'flex-start',
    gap: 6,
    maxWidth: '88%',
  },
  equipmentToast: {
    borderRadius: 8,
    backgroundColor: 'rgba(31, 41, 55, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  equipmentToastTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  equipmentToastStats: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
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
  flatSectionHeader: {
    marginBottom: 10,
  },
  flatSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  inventoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inventoryFilterButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inventoryFilterStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  equipmentHeaderGroup: {
    marginBottom: 0,
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
    marginTop: -4,
  },
  inventoryCategoryHeader: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  inventoryCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
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
  filterSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  filterSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  filterSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '72%',
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  filterSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
  },
  filterSheetClose: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  filterOptionScroll: {
    flexGrow: 0,
  },
  filterOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    minWidth: 72,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterOptionSelected: {
    borderColor: '#1F2937',
    backgroundColor: '#1F2937',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  filterOptionTextSelected: {
    color: '#FFFFFF',
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    padding: 16,
    overflow: 'hidden',
  },
  detailScroll: {
    flexGrow: 0,
  },
  detailScrollContent: {
    paddingBottom: 12,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailList: {
    marginBottom: 12,
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
    paddingTop: 12,
  },
  detailSkillDescriptionBlock: {
    marginBottom: 10,
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
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  unequipButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 11,
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
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  detailCloseButtonText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 14,
  },
})
