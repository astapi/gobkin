import type { EquipmentInstance, EquipmentTemplate } from '@/shared/types'
import {
  DEFAULT_EQUIPMENT_INVENTORY_FILTER,
  getAvailableEquipmentCategories,
  getAvailableEquipmentTitleIds,
  getEquipmentInventoryFilterActiveCount,
  getEquipmentModCount,
  matchesEquipmentInventoryFilter,
  type EquipmentInventoryFilter,
} from '../equipmentInventoryFilter'

const template: EquipmentTemplate = {
  id: 'filter_test_sword',
  name: 'Filter Sword',
  category: 'weapon',
  subCategory: 'sword',
  statBonuses: [],
  price: 10,
}

function createEquipment(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    id: 'equipment-1',
    templateId: template.id,
    slotIndex: -1,
    goblinId: null,
    ...overrides,
  }
}

function createFilter(overrides: Partial<EquipmentInventoryFilter>): EquipmentInventoryFilter {
  return { ...DEFAULT_EQUIPMENT_INVENTORY_FILTER, ...overrides }
}

describe('equipmentInventoryFilter', () => {
  it('名前を正規化して部分一致検索する', () => {
    const target = { equipment: createEquipment(), template }

    expect(matchesEquipmentInventoryFilter(target, createFilter({ nameQuery: 'FILTER' }))).toBe(true)
    expect(matchesEquipmentInventoryFilter(target, createFilter({ nameQuery: 'Ｓｗｏｒｄ' }))).toBe(true)
    expect(matchesEquipmentInventoryFilter(target, createFilter({ nameQuery: 'shield' }))).toBe(false)
  })

  it('prefixとsuffixからMOD数を判定する', () => {
    const oneMod = createEquipment({ prefixMod: { id: 'power', tier: 5 } })
    const twoMods = createEquipment({
      prefixMod: { id: 'power', tier: 5 },
      suffixMod: { id: 'agility', tier: 4 },
    })

    expect(getEquipmentModCount(oneMod)).toBe(1)
    expect(getEquipmentModCount(twoMods)).toBe(2)
    expect(matchesEquipmentInventoryFilter(
      { equipment: twoMods, template },
      createFilter({ modCount: 2 }),
    )).toBe(true)
  })

  it('カテゴリと称号を組み合わせて絞り込む', () => {
    const equipment = createEquipment({ titleId: 'legendary' })
    const target = { equipment, template }

    expect(matchesEquipmentInventoryFilter(
      target,
      createFilter({ category: 'weapon', titleId: 'legendary' }),
    )).toBe(true)
    expect(matchesEquipmentInventoryFilter(
      target,
      createFilter({ category: 'armor', titleId: 'legendary' }),
    )).toBe(false)
  })

  it('未設定の称号を称号なしとして扱う', () => {
    expect(matchesEquipmentInventoryFilter(
      { equipment: createEquipment(), template },
      createFilter({ titleId: 'none' }),
    )).toBe(true)
  })

  it('利用可能なカテゴリ・称号と有効条件数を返す', () => {
    const armorTemplate: EquipmentTemplate = { ...template, id: 'filter_test_armor', category: 'armor' }
    const targets = [
      { equipment: createEquipment(), template },
      { equipment: createEquipment({ id: 'equipment-2', titleId: 'magical' }), template: armorTemplate },
    ]

    expect(getAvailableEquipmentCategories(targets)).toEqual(['weapon', 'armor'])
    expect(getAvailableEquipmentTitleIds(targets)).toEqual(['none', 'magical'])
    expect(getEquipmentInventoryFilterActiveCount(createFilter({
      nameQuery: 'sword',
      modCount: 1,
      category: 'weapon',
      titleId: 'none',
    }))).toBe(4)
  })
})
