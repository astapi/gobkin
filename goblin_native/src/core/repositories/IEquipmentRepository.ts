import type { EquipmentInstance } from '../../shared/types'

export interface IEquipmentRepository {
  getAll(): EquipmentInstance[]
  getByGoblinId(goblinId: number): EquipmentInstance[]
  getUnequipped(): EquipmentInstance[]
  save(equipment: EquipmentInstance): void
  delete(id: string): void
}
