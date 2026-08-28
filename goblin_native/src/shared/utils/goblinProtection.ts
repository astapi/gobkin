import type { Goblin } from '../types'
import { normalizeGoblinRaceId } from '../types/Race'

const PROTECTED_RACE_IDS = new Set(['founder', 'elder', 'gale'])

export function isProtectedGoblin(goblin: Pick<Goblin, 'id' | 'race' | 'raceId'>): boolean {
  return goblin.id === 0 || PROTECTED_RACE_IDS.has(normalizeGoblinRaceId(goblin.raceId ?? goblin.race))
}
