import type {
  EquipmentCategory,
  EquipmentInstance,
  EquipmentModCount,
  EquipmentTemplate,
  EquipmentTitleId,
} from '@/shared/types'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import { getEquipmentDisplayName } from '@/shared/i18n/entityLocalization'

/** 絞り込みで選べるMOD数。空配列は「すべて」を意味する。 */
export const EQUIPMENT_MOD_COUNT_FILTER_OPTIONS: EquipmentModCount[] = [1, 2]

/**
 * 装備一覧の絞り込み条件。
 * 配列項目は空なら「すべて」、複数選択時はOR判定になる。
 */
export interface EquipmentInventoryFilter {
  nameQuery: string
  modCounts: EquipmentModCount[]
  categories: EquipmentCategory[]
  titleIds: EquipmentTitleId[]
}

export interface EquipmentInventoryFilterTarget {
  equipment: EquipmentInstance
  template: EquipmentTemplate
}

export const DEFAULT_EQUIPMENT_INVENTORY_FILTER: EquipmentInventoryFilter = {
  nameQuery: '',
  modCounts: [],
  categories: [],
  titleIds: [],
}

/** 絞り込みで選べる称号。定義順に並べる（在庫の有無では絞らない）。 */
export const EQUIPMENT_TITLE_FILTER_ORDER: EquipmentTitleId[] = EQUIPMENT_TITLE_DEFS
  .map((definition) => definition.id)

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

function matchesSelection<T>(selection: readonly T[], actual: T): boolean {
  return selection.length === 0 || selection.includes(actual)
}

export function getEquipmentModCount(equipment: EquipmentInstance): EquipmentModCount {
  return (Number(Boolean(equipment.prefixMod)) + Number(Boolean(equipment.suffixMod))) as EquipmentModCount
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

  if (!matchesSelection(filter.modCounts, getEquipmentModCount(target.equipment))) {
    return false
  }

  if (!matchesSelection(filter.categories, target.template.category)) {
    return false
  }

  if (!matchesSelection(filter.titleIds, target.equipment.titleId ?? 'none')) {
    return false
  }

  return true
}

export function getEquipmentInventoryFilterActiveCount(
  filter: EquipmentInventoryFilter,
): number {
  return Number(normalizeSearchText(filter.nameQuery).length > 0)
    + Number(filter.modCounts.length > 0)
    + Number(filter.categories.length > 0)
    + Number(filter.titleIds.length > 0)
}
