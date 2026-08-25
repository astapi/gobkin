import type { IEquipmentAutoSellFilterRepository } from '../../core/repositories'
import {
  DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS,
  EquipmentAutoSellService,
} from '../../core/services/EquipmentAutoSellService'
import type { EquipmentAutoSellSettings } from '../../shared/types'
import { getDatabase } from '../database'

const METADATA_KEY = 'equipment_auto_sell_filter_v1'

export class SQLiteEquipmentAutoSellFilterRepository implements IEquipmentAutoSellFilterRepository {
  private static instance: SQLiteEquipmentAutoSellFilterRepository | null = null

  static getInstance(): SQLiteEquipmentAutoSellFilterRepository {
    if (!SQLiteEquipmentAutoSellFilterRepository.instance) {
      SQLiteEquipmentAutoSellFilterRepository.instance = new SQLiteEquipmentAutoSellFilterRepository()
    }
    return SQLiteEquipmentAutoSellFilterRepository.instance
  }

  async getSettings(): Promise<EquipmentAutoSellSettings> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?',
      [METADATA_KEY],
    )
    if (!row) return DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS

    try {
      return EquipmentAutoSellService.normalizeSettings(JSON.parse(row.value))
    } catch {
      return DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS
    }
  }

  async saveSettings(settings: EquipmentAutoSellSettings): Promise<void> {
    const db = await getDatabase()
    const normalized = EquipmentAutoSellService.normalizeSettings(settings)
    await db.runAsync(
      'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
      [METADATA_KEY, JSON.stringify(normalized)],
    )
  }
}
