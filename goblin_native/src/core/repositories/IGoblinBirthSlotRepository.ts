import type { GoblinBirthSlot } from '../../shared/types'

export interface IGoblinBirthSlotRepository {
  getAll(): Promise<GoblinBirthSlot[]>
  save(slot: GoblinBirthSlot): Promise<void>
  remove(slotIndex: number): Promise<void>
}
