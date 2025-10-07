import type { Goblin } from '../types/index.ts'

export interface GoblinRepository {
  getGoblins(): Goblin[]
  getGoblin(id: number): Goblin | null
  saveGoblin(goblin: Goblin): void
  deleteGoblin(id: number): void
  updateGoblinStats(id: number, stats: Goblin['stats']): void
  updateGoblinLevel(id: number, level: number): void
}
