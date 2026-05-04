import type { Goblin } from '../types'
import { normalizeGoblinRaceId } from '../types/Race'

export function isProtectedGoblin(goblin: Pick<Goblin, 'id' | 'race' | 'raceId'>): boolean {
  return goblin.id === 0 || normalizeGoblinRaceId(goblin.raceId ?? goblin.race) === 'founder'
}
