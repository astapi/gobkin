import type { EquipmentAutoSellSettings } from '../../shared/types'

export interface IEquipmentAutoSellFilterRepository {
  getSettings(): Promise<EquipmentAutoSellSettings>
  saveSettings(settings: EquipmentAutoSellSettings): Promise<void>
}
