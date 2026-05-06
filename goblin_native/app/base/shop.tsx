import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { SQLiteEquipmentRepository } from '@/infrastructure/repositories/SQLiteEquipmentRepository'
import { selectGold, selectRank, useBaseStore } from '@/presentation/stores/useBaseStore'
import { describeCharacterSkill, getCharacterSkillDescription } from '@/shared/data/characterSkills'
import { getShopEquipment, getEquipmentTemplate, getEquipmentTemplates } from '@/shared/data/equipmentPoolLoader'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import { getEquipmentDisplayName, getEquipmentLabel, getStatLabel } from '@/shared/i18n/entityLocalization'
import type { EquipmentCategory, EquipmentInstance, EquipmentTemplate } from '@/shared/types'

const SHOP_UNLOCK_RANK = 2
const SELL_PRICE_RATE = 0.5
const equipmentRepository = SQLiteEquipmentRepository.getInstance()

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

type ShopMode = 'buy' | 'sell'
type SelectedShopItem =
  | { mode: 'buy'; template: EquipmentTemplate }
  | { mode: 'sell'; group: InventoryGroup }

type InventoryGroup = {
  key: string
  item: EquipmentInstance
  template: EquipmentTemplate
  count: number
}

function formatPrice(value: number): string {
  return `${value.toLocaleString()}G`
}

function formatBonus(stat: string, value: number): string {
  const displayValue = Number.isInteger(value) ? value : Math.trunc(value * 10) / 10
  const isPercent = stat.includes('percent') || stat === 'damage_reduction'
  return `${displayValue > 0 ? '+' : ''}${displayValue}${isPercent ? '%' : ''}`
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

export default function EquipmentShopScreen() {
  const { t } = useTranslation()
  const rank = useBaseStore(selectRank)
  const gold = useBaseStore(selectGold)
  const baseLoading = useBaseStore((state) => state.isLoading)
  const updateBaseState = useBaseStore((state) => state.updateBaseState)
  const [mode, setMode] = useState<ShopMode>('buy')
  const [inventory, setInventory] = useState<EquipmentInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedShopItem | null>(null)

  const shopItems = useMemo(() => sortTemplates(getShopEquipment(rank)), [rank])
  const sellGroups = useMemo(() => sortInventoryGroups(inventory), [inventory])
  const unlocked = rank >= SHOP_UNLOCK_RANK

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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('ui.shop.title')}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('ui.shop.goldLabel')}</Text>
            <Text style={styles.summaryValue}>{formatPrice(gold)}</Text>
          </View>
        </View>

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
                <Text style={[styles.segmentText, mode === 'buy' && styles.segmentTextActive]}>{t('ui.shop.buyTab')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, mode === 'sell' && styles.segmentButtonActive]}
                onPress={() => setMode('sell')}
              >
                <Text style={[styles.segmentText, mode === 'sell' && styles.segmentTextActive]}>{t('ui.shop.sellTab')}</Text>
              </TouchableOpacity>
            </View>

            {mode === 'buy' ? (
              shopItems.map((template) => {
                const disabled = gold < template.price || processingId === template.id
                return (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.itemCard}
                    onPress={() => setSelectedItem({ mode: 'buy', template })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.itemName} numberOfLines={1}>{getEquipmentLabel(template)}</Text>
                    <Text style={[styles.itemPrice, disabled && styles.itemPriceDisabled]}>
                      {formatPrice(template.price)}
                    </Text>
                  </TouchableOpacity>
                )
              })
            ) : sellGroups.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('ui.shop.emptySell')}</Text>
              </View>
            ) : (
              sellGroups.map((group) => {
                const price = getSellPrice(group.item)
                return (
                  <TouchableOpacity
                    key={group.key}
                    style={styles.itemCard}
                    onPress={() => setSelectedItem({ mode: 'sell', group })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.itemName} numberOfLines={1}>
                      {group.count > 1
                        ? `x${group.count} ${getEquipmentDisplayName(group.item, group.template)}`
                        : getEquipmentDisplayName(group.item, group.template)}
                    </Text>
                    <Text style={styles.itemPrice}>{formatPrice(price)}</Text>
                  </TouchableOpacity>
                )
              })
            )}
          </>
        )}
      </ScrollView>

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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 88,
    gap: 8,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 4,
    gap: 4,
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
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  itemPriceDisabled: {
    color: '#9CA3AF',
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  detailCard: {
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  detailScroll: {
    maxHeight: 440,
  },
  detailScrollContent: {
    padding: 16,
    gap: 12,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  detailList: {
    gap: 6,
  },
  detailListText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
  },
  detailSkillDescriptionSection: {
    gap: 10,
    marginTop: 4,
  },
  detailSkillDescriptionBlock: {
    gap: 4,
  },
  detailSkillName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  detailSkillDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
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
    backgroundColor: '#F3F4F6',
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
})
