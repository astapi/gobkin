import type { EquipmentInstance } from '../../shared/types'

export interface IEquipmentRepository {
  getAll(): Promise<EquipmentInstance[]>
  getByGoblinId(goblinId: number): Promise<EquipmentInstance[]>
  getUnequipped(): Promise<EquipmentInstance[]>
  save(equipment: EquipmentInstance): Promise<void>
  delete(id: string): Promise<void>
  deleteMany(ids: string[]): Promise<void>
}
