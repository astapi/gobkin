import type { Goblin } from '../../shared/types'

export interface IPendingGoblinRepository {
  initialize(): Promise<void>
  getPendingGoblins(): Goblin[]
  addPendingGoblin(goblin: Goblin): void
  removePendingGoblin(id: number): void
  clearPendingGoblins(): void
}
