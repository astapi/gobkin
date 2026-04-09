import type { CharacterSkill } from '../types'
import { getGoblinVariantByRace } from './goblinVariants'
import { getCharacterSkills } from './skillCatalog'

export function getDefaultSkillsForRace(race: string): CharacterSkill[] {
  return getCharacterSkills(getGoblinVariantByRace(race)?.defaultSkillIds ?? [])
}
