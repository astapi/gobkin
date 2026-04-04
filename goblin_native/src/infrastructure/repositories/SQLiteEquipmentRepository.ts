/**
 * SQLiteを使用した装備リポジトリ実装
 * DBから直接読み書きする設計
 */
import type { EquipmentInstance } from '../../shared/types'
import type { IEquipmentRepository } from '../../core/repositories/IEquipmentRepository'
import { getDatabase } from '../database'

interface EquipmentRow {
  id: string
  template_id: string
  slot_index: number
  goblin_id: number | null
  title_id: string | null
  title_name: string | null
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
      `INSERT OR REPLACE INTO equipment (id, template_id, slot_index, goblin_id, title_id, title_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        equipment.id,
        equipment.templateId,
        equipment.slotIndex,
        equipment.goblinId,
        equipment.titleId ?? null,
        equipment.titleName ?? null,
      ]
    )
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM equipment WHERE id = ?', [id])
  }

  private rowToEquipment(row: EquipmentRow): EquipmentInstance {
    return {
      id: row.id,
      templateId: row.template_id,
      slotIndex: row.slot_index,
      goblinId: row.goblin_id,
      titleId: row.title_id as EquipmentInstance['titleId'],
      titleName: row.title_name ?? undefined,
    }
  }
}
