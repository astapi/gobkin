import type { Goblin } from '../../shared/types'

export interface IGoblinRepository {
  getGoblins(): Promise<Goblin[]>
  getGoblin(id: number): Promise<Goblin | null>
  saveGoblin(goblin: Goblin): Promise<void>
  deleteGoblin(id: number): Promise<void>
  updateGoblinStats(id: number, stats: Goblin['stats']): Promise<void>
  updateGoblinLevel(id: number, level: number): Promise<void>
  updateGoblinFactors(id: number, factors: string[], effectiveStats: Goblin['stats']): Promise<void>
  updateGoblinCurrentHp(id: number, currentHp: number | null): Promise<void>
}
