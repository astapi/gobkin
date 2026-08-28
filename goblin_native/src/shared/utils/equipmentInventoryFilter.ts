import type {
  EquipmentCategory,
  EquipmentInstance,
  EquipmentTemplate,
  EquipmentTitleId,
} from '@/shared/types'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import { getEquipmentDisplayName } from '@/shared/i18n/entityLocalization'

export type EquipmentModCountFilter = 'all' | 1 | 2
export type EquipmentCategoryFilter = 'all' | EquipmentCategory

export interface EquipmentInventoryFilter {
  nameQuery: string
  modCount: EquipmentModCountFilter
  category: EquipmentCategoryFilter
  titleIds: EquipmentTitleId[]
}

export interface EquipmentInventoryFilterTarget {
  equipment: EquipmentInstance
  template: EquipmentTemplate
}

export const DEFAULT_EQUIPMENT_INVENTORY_FILTER: EquipmentInventoryFilter = {
  nameQuery: '',
  modCount: 'all',
  category: 'all',
  titleIds: [],
}

export const EQUIPMENT_CATEGORY_FILTER_ORDER: EquipmentCategory[] = [
  'weapon',
  'armor',
  'robe',
  'shield',
  'large_shield',
  'gauntlet',
  'wand',
  'rod',
  'accessory',
]

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase()
}

export function getEquipmentModCount(equipment: EquipmentInstance): number {
  return Number(Boolean(equipment.prefixMod)) + Number(Boolean(equipment.suffixMod))
}

export function matchesEquipmentInventoryFilter(
  target: EquipmentInventoryFilterTarget,
  filter: EquipmentInventoryFilter,
): boolean {
  const normalizedQuery = normalizeSearchText(filter.nameQuery)
  if (normalizedQuery) {
    const displayName = normalizeSearchText(
      getEquipmentDisplayName(target.equipment, target.template),
    )
    if (!displayName.includes(normalizedQuery)) return false
  }

  if (filter.modCount !== 'all' && getEquipmentModCount(target.equipment) !== filter.modCount) {
    return false
  }

  if (filter.category !== 'all' && target.template.category !== filter.category) {
    return false
  }

  const titleId = target.equipment.titleId ?? 'none'
  if (filter.titleIds.length > 0 && !filter.titleIds.includes(titleId)) {
    return false
  }

  return true
}

export function getAvailableEquipmentCategories(
  targets: EquipmentInventoryFilterTarget[],
): EquipmentCategory[] {
  const available = new Set(targets.map((target) => target.template.category))
  return EQUIPMENT_CATEGORY_FILTER_ORDER.filter((category) => available.has(category))
}

export function getAvailableEquipmentTitleIds(
  targets: EquipmentInventoryFilterTarget[],
): EquipmentTitleId[] {
  const available = new Set(
    targets.map((target) => target.equipment.titleId ?? 'none'),
  )
  return EQUIPMENT_TITLE_DEFS
    .map((definition) => definition.id)
    .filter((titleId) => available.has(titleId))
}

export function getEquipmentInventoryFilterActiveCount(
  filter: EquipmentInventoryFilter,
): number {
  return Number(normalizeSearchText(filter.nameQuery).length > 0)
    + Number(filter.modCount !== 'all')
    + Number(filter.category !== 'all')
    + Number(filter.titleIds.length > 0)
}
