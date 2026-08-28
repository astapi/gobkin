import type { EquipmentInstance, EquipmentTemplate } from '@/shared/types'
import { groupEquipmentVariantsByTemplate } from '../equipmentInventoryGrouping'

const sword: EquipmentTemplate = {
  id: 'sword',
  name: '剣',
  category: 'weapon',
  statBonuses: [],
  price: 10,
}

const axe: EquipmentTemplate = {
  ...sword,
  id: 'axe',
  name: '斧',
}

function variant(
  key: string,
  template: EquipmentTemplate,
  count: number,
) {
  const equipment: EquipmentInstance = {
    id: key,
    templateId: template.id,
    slotIndex: -1,
    goblinId: null,
  }
  return { key, equipment, template, count }
}

describe('groupEquipmentVariantsByTemplate', () => {
  it('フィルター一致個体をベース装備単位にまとめ、総数も保持する', () => {
    const masterworkSword = variant('masterwork-sword', sword, 2)
    const imbuedSword = variant('imbued-sword', sword, 1)
    const normalSword = variant('normal-sword', sword, 4)
    const normalAxe = variant('normal-axe', axe, 3)

    const groups = groupEquipmentVariantsByTemplate(
      [masterworkSword, imbuedSword, normalSword, normalAxe],
      [masterworkSword, imbuedSword],
    )

    expect(groups).toEqual([{
      key: 'base::sword',
      template: sword,
      variants: [masterworkSword, imbuedSword],
      matchedCount: 3,
      totalCount: 7,
    }])
  })
})
