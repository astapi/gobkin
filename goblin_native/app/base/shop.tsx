import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, FlatList } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { SQLiteEquipmentRepository } from '@/infrastructure/repositories/SQLiteEquipmentRepository'
import { selectGold, selectRank, useBaseStore } from '@/presentation/stores/useBaseStore'
import { CurrentTimeBadge } from '@/presentation/components/CurrentTimeBadge'
import { GoldBadge } from '@/presentation/components/GoldBadge'
import { GoldenAcornBadge } from '@/presentation/components/GoldenAcornBadge'
import { describeCharacterSkill, getCharacterSkillDescription } from '@/shared/data/characterSkills'
import { getShopEquipment, getEquipmentTemplate, getEquipmentTemplates } from '@/shared/data/equipmentPoolLoader'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import { getEquipmentDisplayName, getEquipmentLabel, getStatLabel } from '@/shared/i18n/entityLocalization'
import type { EquipmentCategory, EquipmentInstance, EquipmentTemplate, WeaponSubCategory } from '@/shared/types'

const SHOP_UNLOCK_RANK = 2
const SELL_PRICE_RATE = 0.5
const equipmentRepository = SQLiteEquipmentRepository.getInstance()

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

type ShopMode = 'buy' | 'sell'
type SelectedShopItem =
  | { mode: 'buy'; template: EquipmentTemplate }
  | { mode: 'sell'; group: InventoryGroup }

type ShopFilter =
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

const ALL_SHOP_FILTER: ShopFilter = { type: 'all', key: 'all', label: 'すべて' }

type InventoryGroup = {
  key: string
  item: EquipmentInstance
  template: EquipmentTemplate
  count: number
}

type ShopListEntry =
  | {
      type: 'category'
      key: string
      label: string
    }
  | {
      type: 'buyItem'
      key: string
      template: EquipmentTemplate
    }
  | {
      type: 'sellItem'
      key: string
      group: InventoryGroup
    }

function formatPrice(value: number): string {
  return `${value.toLocaleString()}G`
}

function formatBonus(stat: string, value: number): string {
  const displayValue = Number.isInteger(value) ? value : Math.trunc(value * 10) / 10
  const isPercent = stat.includes('percent') || stat === 'damage_reduction'
  return `${displayValue > 0 ? '+' : ''}${displayValue}${isPercent ? '%' : ''}`
}

function isDisplayValueZero(value: number): boolean {
  const displayValue = Number.isInteger(value) ? value : Math.trunc(value * 10) / 10
  return displayValue === 0
}

function getInlineStats(template: EquipmentTemplate): string {
  return template.statBonuses
    .filter((bonus) => !isDisplayValueZero(bonus.value))
    .map((bonus) => `${getStatLabel(bonus.stat)}${formatBonus(bonus.stat, bonus.value)}`)
    .join('  ')
}

function getSellPrice(item: EquipmentInstance): number {
  const template = getEquipmentTemplate(item.templateId)
  if (!template) return 0
  const titleDef = item.titleId
    ? EQUIPMENT_TITLE_DEFS.find((title) => title.id === item.titleId)
    : undefined
  return Math.max(1, Math.floor(template.price * (titleDef?.priceMultiplier ?? 1) * SELL_PRICE_RATE))
}

function createPurchasedEquipment(templateId: string): EquipmentInstance {
  return {
    id: `eq_shop_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    templateId,
    slotIndex: -1,
    goblinId: null,
  }
}

function sortTemplates(items: EquipmentTemplate[]): EquipmentTemplate[] {
  const templateOrder = new Map(getEquipmentTemplates().map((template, index) => [template.id, index]))

  return [...items].sort((a, b) => {
    const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
    if (catDiff !== 0) return catDiff
    return (templateOrder.get(a.id) ?? 0) - (templateOrder.get(b.id) ?? 0)
  })
}

function sortInventoryGroups(items: EquipmentInstance[]): InventoryGroup[] {
  const grouped = new Map<string, InventoryGroup>()

  for (const item of items) {
    const template = getEquipmentTemplate(item.templateId)
    if (!template) continue
    const key = `${item.templateId}::${item.titleId ?? 'none'}`
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
      continue
    }
    grouped.set(key, { key, item, template, count: 1 })
  }

  const groups = Array.from(grouped.values())
  const templateOrder = new Map(getEquipmentTemplates().map((template, index) => [template.id, index]))

  return groups.sort((a, b) => {
    const catDiff = CATEGORY_ORDER[a.template.category] - CATEGORY_ORDER[b.template.category]
    if (catDiff !== 0) return catDiff
    const orderDiff = (templateOrder.get(a.template.id) ?? 0) - (templateOrder.get(b.template.id) ?? 0)
    if (orderDiff !== 0) return orderDiff
    return getSellPrice(a.item) - getSellPrice(b.item)
  })
}

function getSectionKey(template: EquipmentTemplate): string {
  return template.category === 'weapon'
    ? `weapon-${template.subCategory ?? 'unknown'}`
    : template.category
}

function getSectionLabel(template: EquipmentTemplate): string {
  return template.category === 'weapon' && template.subCategory
    ? WEAPON_SUB_CATEGORY_LABELS[template.subCategory]
    : CATEGORY_LABELS[template.category]
}

function matchesShopFilter(template: EquipmentTemplate, filter: ShopFilter): boolean {
  if (filter.type === 'all') return true
  if (filter.type === 'weaponSubCategory') {
    return template.category === 'weapon' && template.subCategory === filter.key
  }
  return template.category === filter.key
}

function buildShopFilterOptions(templates: EquipmentTemplate[]): ShopFilter[] {
  const categories = new Set(templates.map((template) => template.category))
  const weaponSubCategories = new Set(
    templates
      .map((template) => template.subCategory)
      .filter((subCategory): subCategory is WeaponSubCategory => Boolean(subCategory)),
  )

  return [
    ALL_SHOP_FILTER,
    ...WEAPON_SUB_CATEGORY_FILTER_ORDER
      .filter((subCategory) => weaponSubCategories.has(subCategory))
      .map((subCategory): ShopFilter => ({
        type: 'weaponSubCategory',
        key: subCategory,
        label: WEAPON_SUB_CATEGORY_LABELS[subCategory],
      })),
    ...CATEGORY_FILTER_ORDER
      .filter((category) => categories.has(category))
      .map((category): ShopFilter => ({
        type: 'category',
        key: category,
        label: CATEGORY_LABELS[category],
      })),
  ]
}

function buildBuyListEntries(templates: EquipmentTemplate[]): ShopListEntry[] {
  const entries: ShopListEntry[] = []
  let currentSectionKey: string | null = null

  for (const template of templates) {
    const sectionKey = getSectionKey(template)
    if (sectionKey !== currentSectionKey) {
      entries.push({
        type: 'category',
        key: `category-${sectionKey}-${entries.length}`,
        label: getSectionLabel(template),
      })
      currentSectionKey = sectionKey
    }

    entries.push({
      type: 'buyItem',
      key: template.id,
      template,
    })
  }

  return entries
}

function buildSellListEntries(groups: InventoryGroup[]): ShopListEntry[] {
  const entries: ShopListEntry[] = []
  let currentSectionKey: string | null = null

  for (const group of groups) {
    const sectionKey = getSectionKey(group.template)
    if (sectionKey !== currentSectionKey) {
      entries.push({
        type: 'category',
        key: `category-${sectionKey}-${entries.length}`,
        label: getSectionLabel(group.template),
      })
      currentSectionKey = sectionKey
    }

    entries.push({
      type: 'sellItem',
      key: group.key,
      group,
    })
  }

  return entries
}

function ShopItemDetail({
  selected,
  visible,
  processing,
  disabled,
  price,
  onClose,
  onAction,
}: {
  selected: SelectedShopItem
  visible: boolean
  processing: boolean
  disabled: boolean
  price: number
  onClose: () => void
  onAction: () => void
}) {
  const { t } = useTranslation()
  const template = selected.mode === 'buy' ? selected.template : selected.group.template
  const name = selected.mode === 'buy'
    ? getEquipmentLabel(template)
    : getEquipmentDisplayName(selected.group.item, template)
  const skills = template.grantedSkills ?? []

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlayBackground}>
        <View style={styles.detailCard}>
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.detailName}>{name}</Text>

            <View style={styles.detailList}>
              {template.statBonuses.map((bonus, index) => (
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

            {skills.length > 0 && (
              <View style={styles.detailSkillDescriptionSection}>
                {skills.map((skill, index) => (
                  <View key={`skill-detail-${index}`} style={styles.detailSkillDescriptionBlock}>
                    <Text style={styles.detailSkillName}>{describeCharacterSkill(skill)}</Text>
                    <Text style={styles.detailSkillDescription}>{getCharacterSkillDescription(skill)}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.detailActions}>
            <TouchableOpacity
              style={[
                selected.mode === 'buy' ? styles.buyButton : styles.sellDetailButton,
                disabled && styles.buttonDisabled,
              ]}
              onPress={onAction}
              disabled={disabled}
            >
              <Text style={styles.detailActionButtonText}>
                {processing
                  ? t('ui.shop.processing')
                  : selected.mode === 'buy'
                    ? `${t('ui.shop.buyTab')} ${formatPrice(price)}`
                    : t('ui.shop.sellPrice', { price })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailCloseButton} onPress={onClose}>
              <Text style={styles.detailCloseButtonText}>{t('ui.common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function ShopEquipmentRow({
  name,
  template,
  price,
  disabled,
  onPress,
  onShowDetail,
}: {
  name: string
  template: EquipmentTemplate
  price: number
  disabled?: boolean
  onPress: () => void
  onShowDetail: () => void
}) {
  const inlineStats = getInlineStats(template)

  return (
    <TouchableOpacity
      style={[styles.itemRow, disabled && styles.itemRowDisabled]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemStats} numberOfLines={1}>
          {inlineStats}
        </Text>
        <View style={styles.itemNameRow}>
          <Text style={styles.itemName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.itemPrice, disabled && styles.itemPriceDisabled]}>
            {formatPrice(price)}
          </Text>
        </View>
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

export default function EquipmentShopScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const rank = useBaseStore(selectRank)
  const gold = useBaseStore(selectGold)
  const baseLoading = useBaseStore((state) => state.isLoading)
  const updateBaseState = useBaseStore((state) => state.updateBaseState)
  const [mode, setMode] = useState<ShopMode>('buy')
  const [inventory, setInventory] = useState<EquipmentInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedShopItem | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<ShopFilter>(ALL_SHOP_FILTER)
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false)

  const shopItems = useMemo(() => sortTemplates(getShopEquipment(rank)), [rank])
  const sellGroups = useMemo(() => sortInventoryGroups(inventory), [inventory])
  const unlocked = rank >= SHOP_UNLOCK_RANK
  const activeTemplates = useMemo(
    () => mode === 'buy' ? shopItems : sellGroups.map((group) => group.template),
    [mode, shopItems, sellGroups],
  )
  const filterOptions = useMemo(
    () => buildShopFilterOptions(activeTemplates),
    [activeTemplates],
  )
  const filteredShopItems = useMemo(
    () => shopItems.filter((template) => matchesShopFilter(template, selectedFilter)),
    [shopItems, selectedFilter],
  )
  const filteredSellGroups = useMemo(
    () => sellGroups.filter((group) => matchesShopFilter(group.template, selectedFilter)),
    [sellGroups, selectedFilter],
  )
  const listEntries = useMemo(
    () => mode === 'buy'
      ? buildBuyListEntries(filteredShopItems)
      : buildSellListEntries(filteredSellGroups),
    [filteredShopItems, filteredSellGroups, mode],
  )
  const listBottomSpacerHeight = useMemo(
    () => insets.bottom + 96,
    [insets.bottom],
  )
  const badgeBottom = insets.bottom + 8
  const emptyListText = mode === 'buy'
    ? '条件に合う商品がありません'
    : sellGroups.length === 0
      ? t('ui.shop.emptySell')
      : '条件に合うアイテムがありません'

  useEffect(() => {
    const isSelectedAvailable = filterOptions.some(
      (option) => option.type === selectedFilter.type && option.key === selectedFilter.key,
    )
    if (!isSelectedAvailable) {
      setSelectedFilter(ALL_SHOP_FILTER)
    }
  }, [filterOptions, selectedFilter])

  const refreshInventory = useCallback(async () => {
    const unequipped = await equipmentRepository.getUnequipped()
    setInventory(unequipped)
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const unequipped = await equipmentRepository.getUnequipped()
        if (active) setInventory(unequipped)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const buyItem = useCallback(async (template: EquipmentTemplate) => {
    if (gold < template.price) {
      Alert.alert(t('ui.shop.insufficientGoldTitle'), t('ui.shop.insufficientGoldBody', { price: template.price, gold }))
      return
    }

    try {
      setProcessingId(template.id)
      await equipmentRepository.save(createPurchasedEquipment(template.id))
      await updateBaseState({ gold: gold - template.price })
      await refreshInventory()
      setSelectedItem(null)
      Alert.alert(t('ui.shop.buySuccessTitle'), t('ui.shop.buySuccessBody', { name: getEquipmentLabel(template) }))
    } catch (error) {
      console.error('[EquipmentShop] Failed to buy item', error)
      Alert.alert(t('ui.shop.failureTitle'), t('ui.shop.buyFailureBody'))
    } finally {
      setProcessingId(null)
    }
  }, [gold, refreshInventory, t, updateBaseState])

  const sellItem = useCallback(async (item: EquipmentInstance) => {
    const template = getEquipmentTemplate(item.templateId)
    if (!template) return
    const price = getSellPrice(item)
    const name = getEquipmentDisplayName(item, template)

    Alert.alert(
      t('ui.shop.sellConfirmTitle'),
      t('ui.shop.sellConfirmBody', { name, price }),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.shop.sellAction'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setProcessingId(item.id)
                await equipmentRepository.delete(item.id)
                await updateBaseState({ gold: gold + price })
                await refreshInventory()
                setSelectedItem(null)
              } catch (error) {
                console.error('[EquipmentShop] Failed to sell item', error)
                Alert.alert(t('ui.shop.failureTitle'), t('ui.shop.sellFailureBody'))
              } finally {
                setProcessingId(null)
              }
            })()
          },
        },
      ],
    )
  }, [gold, refreshInventory, t, updateBaseState])

  if (baseLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        data={unlocked ? listEntries : []}
        keyExtractor={(item) => item.key}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListHeaderComponent={(
          <>
            {!unlocked ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('ui.shop.locked', { rank: SHOP_UNLOCK_RANK })}</Text>
              </View>
            ) : (
              <>
                <View style={styles.segment}>
                  <TouchableOpacity
                    style={[styles.segmentButton, mode === 'buy' && styles.segmentButtonActive]}
                    onPress={() => setMode('buy')}
                  >
                    <Text style={[styles.segmentText, mode === 'buy' && styles.segmentTextActive]}>
                      {t('ui.shop.buyTab')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentButton, mode === 'sell' && styles.segmentButtonActive]}
                    onPress={() => setMode('sell')}
                  >
                    <Text style={[styles.segmentText, mode === 'sell' && styles.segmentTextActive]}>
                      {t('ui.shop.sellTab')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inventoryHeaderRow}>
                  <Text style={styles.flatSectionTitle}>
                    {mode === 'buy' ? t('ui.shop.buyTab') : t('ui.shop.sellTab')}
                  </Text>
                  <TouchableOpacity
                    style={styles.inventoryFilterButton}
                    activeOpacity={0.8}
                    onPress={() => setIsFilterSheetVisible(true)}
                  >
                    <Text style={styles.inventoryFilterStatus}>
                      {selectedFilter.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
        ListEmptyComponent={unlocked ? (
          <View style={styles.emptyInventory}>
            <Text style={styles.emptyInventoryText}>{emptyListText}</Text>
          </View>
        ) : null}
        ListFooterComponent={<View style={{ height: listBottomSpacerHeight }} />}
        renderItem={({ item }) => {
          if (item.type === 'category') {
            return (
              <View style={styles.inventoryCategoryHeader}>
                <Text style={styles.inventoryCategoryTitle}>{item.label}</Text>
              </View>
            )
          }

          if (item.type === 'buyItem') {
            const disabled = gold < item.template.price || processingId === item.template.id
            return (
              <ShopEquipmentRow
                name={getEquipmentLabel(item.template)}
                template={item.template}
                price={item.template.price}
                disabled={disabled}
                onPress={() => setSelectedItem({ mode: 'buy', template: item.template })}
                onShowDetail={() => setSelectedItem({ mode: 'buy', template: item.template })}
              />
            )
          }

          const price = getSellPrice(item.group.item)
          const name = item.group.count > 1
            ? `x${item.group.count} ${getEquipmentDisplayName(item.group.item, item.group.template)}`
            : getEquipmentDisplayName(item.group.item, item.group.template)
          return (
            <ShopEquipmentRow
              name={name}
              template={item.group.template}
              price={price}
              disabled={processingId === item.group.item.id}
              onPress={() => setSelectedItem({ mode: 'sell', group: item.group })}
              onShowDetail={() => setSelectedItem({ mode: 'sell', group: item.group })}
            />
          )
        }}
      />

      <CurrentTimeBadge bottom={badgeBottom} />
      <GoldenAcornBadge bottom={badgeBottom + 32} />
      <GoldBadge bottom={badgeBottom} />

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
          <View style={[styles.filterSheet, { paddingBottom: insets.bottom + 16 }]}>
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
              {filterOptions.map((option) => {
                const isSelected = option.type === selectedFilter.type && option.key === selectedFilter.key
                return (
                  <TouchableOpacity
                    key={`${option.type}-${option.key}`}
                    style={[styles.filterOption, isSelected && styles.filterOptionSelected]}
                    onPress={() => {
                      setSelectedFilter(option)
                      setIsFilterSheetVisible(false)
                    }}
                  >
                    <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {selectedItem && (
        <ShopItemDetail
          selected={selectedItem}
          visible={true}
          processing={
            selectedItem.mode === 'buy'
              ? processingId === selectedItem.template.id
              : processingId === selectedItem.group.item.id
          }
          disabled={
            selectedItem.mode === 'buy'
              ? gold < selectedItem.template.price || processingId === selectedItem.template.id
              : processingId === selectedItem.group.item.id
          }
          price={selectedItem.mode === 'buy' ? selectedItem.template.price : getSellPrice(selectedItem.group.item)}
          onClose={() => setSelectedItem(null)}
          onAction={() => {
            if (selectedItem.mode === 'buy') {
              void buyItem(selectedItem.template)
            } else {
              void sellItem(selectedItem.group.item)
            }
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 4,
    gap: 4,
    marginBottom: 14,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#111827',
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
    marginBottom: 10,
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
  inventoryCategoryHeader: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  inventoryCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
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
  itemRowDisabled: {
    opacity: 0.58,
  },
  itemSeparator: {
    height: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemStats: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    minHeight: 16,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  itemPriceDisabled: {
    color: '#9CA3AF',
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
  buyButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    alignItems: 'center',
  },
  sellDetailButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#374151',
    paddingVertical: 11,
    alignItems: 'center',
  },
  detailActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  detailCloseButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    paddingVertical: 11,
    alignItems: 'center',
  },
  detailCloseButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
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
})
