/**
 * SQLiteを使用した装備リポジトリ実装
 * DBから直接読み書きする設計
 */
import type { EquipmentInstance } from '../../shared/types'
import type { IEquipmentRepository } from '../../core/repositories/IEquipmentRepository'
import { getDatabase } from '../database'
import { getEquipmentTitleLabel } from '../../shared/i18n/entityLocalization'
import { EquipmentModService } from '../../core/services/EquipmentModService'

interface EquipmentRow {
  id: string
  template_id: string
  slot_index: number
  goblin_id: number | null
  title_id: string | null
  title_name: string | null
  prefix_mod_json: string | null
  suffix_mod_json: string | null
  created_at: string
}

export class SQLiteEquipmentRepository implements IEquipmentRepository {
  private static instance: SQLiteEquipmentRepository | null = null

  static getInstance(): SQLiteEquipmentRepository {
    if (!SQLiteEquipmentRepository.instance) {
      SQLiteEquipmentRepository.instance = new SQLiteEquipmentRepository()
    }
    return SQLiteEquipmentRepository.instance
  }

  async getAll(): Promise<EquipmentInstance[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<EquipmentRow>('SELECT * FROM equipment')
    return rows.map(row => this.rowToEquipment(row))
  }

  async getByGoblinId(goblinId: number): Promise<EquipmentInstance[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<EquipmentRow>(
      'SELECT * FROM equipment WHERE goblin_id = ? AND slot_index >= 0',
      [goblinId]
    )
    return rows.map(row => this.rowToEquipment(row))
  }

  async getUnequipped(): Promise<EquipmentInstance[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<EquipmentRow>(
      'SELECT * FROM equipment WHERE goblin_id IS NULL OR slot_index < 0'
    )
    return rows.map(row => this.rowToEquipment(row))
  }

  async save(equipment: EquipmentInstance): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO equipment (
         id, template_id, slot_index, goblin_id, title_id, title_name,
         prefix_mod_json, suffix_mod_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipment.id,
        equipment.templateId,
        equipment.slotIndex,
        equipment.goblinId,
        equipment.titleId ?? null,
        null,
        equipment.prefixMod ? JSON.stringify(equipment.prefixMod) : null,
        equipment.suffixMod ? JSON.stringify(equipment.suffixMod) : null,
      ]
    )
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM equipment WHERE id = ?', [id])
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const db = await getDatabase()
    await db.withTransactionAsync(async () => {
      for (const id of ids) {
        await db.runAsync('DELETE FROM equipment WHERE id = ?', [id])
      }
    })
  }

  private rowToEquipment(row: EquipmentRow): EquipmentInstance {
    const titleId = row.title_id as EquipmentInstance['titleId']
    return {
      id: row.id,
      templateId: row.template_id,
      slotIndex: row.slot_index,
      goblinId: row.goblin_id,
      titleId,
      titleName: titleId ? getEquipmentTitleLabel(titleId) : (row.title_name ?? undefined),
      prefixMod: this.parseMod(row.prefix_mod_json, 'prefix'),
      suffixMod: this.parseMod(row.suffix_mod_json, 'suffix'),
    }
  }

  private parseMod(
    json: string | null,
    slot: 'prefix' | 'suffix',
  ): EquipmentInstance['prefixMod'] {
    if (!json) return undefined
    try {
      return EquipmentModService.normalizeRoll(JSON.parse(json), slot)
    } catch {
      return undefined
    }
  }
}
