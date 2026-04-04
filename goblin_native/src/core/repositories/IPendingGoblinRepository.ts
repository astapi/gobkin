import type { Goblin } from '../../shared/types'

export interface IPendingGoblinRepository {
  getPendingGoblins(): Promise<Goblin[]>
  addPendingGoblin(goblin: Goblin): Promise<void>
  removePendingGoblin(id: number): Promise<void>
  clearPendingGoblins(): Promise<void>
}
