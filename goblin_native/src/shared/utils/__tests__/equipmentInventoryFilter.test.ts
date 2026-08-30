import type { EquipmentInstance, EquipmentTemplate } from '@/shared/types'
import {
  DEFAULT_EQUIPMENT_INVENTORY_FILTER,
  EQUIPMENT_CATEGORY_FILTER_ORDER,
  EQUIPMENT_TITLE_FILTER_ORDER,
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
      createFilter({ modCounts: [2] }),
    )).toBe(true)
  })

  it('MOD数を複数選択するとどれかに一致すれば残る', () => {
    const noMod = { equipment: createEquipment(), template }
    const oneMod = { equipment: createEquipment({ prefixMod: { id: 'power', tier: 5 } }), template }
    const filter = createFilter({ modCounts: [1, 2] })

    expect(matchesEquipmentInventoryFilter(oneMod, filter)).toBe(true)
    expect(matchesEquipmentInventoryFilter(noMod, filter)).toBe(false)
    expect(matchesEquipmentInventoryFilter(noMod, createFilter({ modCounts: [] }))).toBe(true)
  })

  it('カテゴリと複数称号を組み合わせて絞り込む', () => {
    const equipment = createEquipment({ titleId: 'legendary' })
    const target = { equipment, template }

    expect(matchesEquipmentInventoryFilter(
      target,
      createFilter({ categories: ['weapon'], titleIds: ['masterwork', 'legendary'] }),
    )).toBe(true)
    expect(matchesEquipmentInventoryFilter(
      target,
      createFilter({ categories: ['armor'], titleIds: ['masterwork', 'legendary'] }),
    )).toBe(false)
  })

  it('カテゴリを複数選択するとどれかに一致すれば残る', () => {
    const armorTemplate: EquipmentTemplate = { ...template, id: 'filter_test_armor', category: 'armor' }
    const filter = createFilter({ categories: ['weapon', 'armor'] })

    expect(matchesEquipmentInventoryFilter({ equipment: createEquipment(), template }, filter)).toBe(true)
    expect(matchesEquipmentInventoryFilter(
      { equipment: createEquipment(), template: armorTemplate },
      filter,
    )).toBe(true)
    expect(matchesEquipmentInventoryFilter(
      { equipment: createEquipment(), template: { ...template, id: 'filter_test_robe', category: 'robe' } },
      filter,
    )).toBe(false)
  })

  it('未設定の称号を称号なしとして扱う', () => {
    expect(matchesEquipmentInventoryFilter(
      { equipment: createEquipment(), template },
      createFilter({ titleIds: ['none'] }),
    )).toBe(true)
  })

  it('候補は在庫ではなく定義から作る', () => {
    expect(EQUIPMENT_CATEGORY_FILTER_ORDER).toContain('armor')
    expect(EQUIPMENT_CATEGORY_FILTER_ORDER).toHaveLength(9)
    expect(EQUIPMENT_TITLE_FILTER_ORDER).toEqual([
      'none', 'masterwork', 'magical', 'imbued', 'legendary', 'terrifying', 'broken',
    ])
  })

  it('有効条件数を返す', () => {
    expect(getEquipmentInventoryFilterActiveCount(createFilter({
      nameQuery: 'sword',
      modCounts: [1, 2],
      categories: ['weapon', 'armor'],
      titleIds: ['none', 'magical'],
    }))).toBe(4)
  })
})
