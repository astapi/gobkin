/**
 * SQLiteを使用した装備リポジトリ実装
 * SQLiteGoblinRepository と同じシングルトン+キャッシュパターン
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
  private cache: Map<string, EquipmentInstance> = new Map()
  private initialized = false

  static getInstance(): SQLiteEquipmentRepository {
    if (!SQLiteEquipmentRepository.instance) {
      SQLiteEquipmentRepository.instance = new SQLiteEquipmentRepository()
    }
    return SQLiteEquipmentRepository.instance
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const db = await getDatabase()
    const rows = await db.getAllAsync<EquipmentRow>('SELECT * FROM equipment')

    this.cache.clear()
    for (const row of rows) {
      const eq = this.rowToEquipment(row)
      this.cache.set(eq.id, eq)
    }

    this.initialized = true
  }

  getAll(): EquipmentInstance[] {
    return Array.from(this.cache.values())
  }

  getByGoblinId(goblinId: number): EquipmentInstance[] {
    return Array.from(this.cache.values()).filter(
      (eq) => eq.goblinId === goblinId && eq.slotIndex >= 0
    )
  }

  getUnequipped(): EquipmentInstance[] {
    return Array.from(this.cache.values()).filter(
      (eq) => eq.goblinId === null || eq.slotIndex < 0
    )
  }

  save(equipment: EquipmentInstance): void {
    this.cache.set(equipment.id, equipment)

    this.saveAsync(equipment).catch((err) => {
      console.error('[SQLiteEquipmentRepository] Failed to save equipment:', err)
    })
  }

  delete(id: string): void {
    this.cache.delete(id)

    this.deleteAsync(id).catch((err) => {
      console.error('[SQLiteEquipmentRepository] Failed to delete equipment:', err)
    })
  }

  // --- Private methods ---

  private async saveAsync(equipment: EquipmentInstance): Promise<void> {
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

  private async deleteAsync(id: string): Promise<void> {
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
