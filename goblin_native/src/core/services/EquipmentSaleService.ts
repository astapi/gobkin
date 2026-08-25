import { EQUIPMENT_TITLE_DEFS } from '../../shared/data/equipmentTitleConfig'
import { getEquipmentTemplate } from '../../shared/data/equipmentPoolLoader'
import type { EquipmentInstance, TreasureDrop } from '../../shared/types'

const SELL_PRICE_RATE = 0.5

export class EquipmentSaleService {
  static getSellPrice(item: Pick<EquipmentInstance, 'templateId' | 'titleId'> | TreasureDrop): number {
    const template = getEquipmentTemplate(item.templateId)
    if (!template) return 0
    const titleDefinition = item.titleId
      ? EQUIPMENT_TITLE_DEFS.find(definition => definition.id === item.titleId)
      : undefined
    return Math.max(
      1,
      Math.floor(template.price * (titleDefinition?.priceMultiplier ?? 1) * SELL_PRICE_RATE),
    )
  }
}
