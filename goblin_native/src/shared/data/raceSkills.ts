import type { CharacterSkill } from '../types'
import { getGoblinVariantByRace } from './goblinVariants'
import { getCharacterSkills } from './skillCatalog'
import { normalizeGoblinRaceId } from '../types/Race'

export function getDefaultSkillsForRace(race: string): CharacterSkill[] {
  return getCharacterSkills(getGoblinVariantByRace(normalizeGoblinRaceId(race))?.defaultSkillIds ?? [])
}
