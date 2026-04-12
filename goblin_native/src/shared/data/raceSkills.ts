import type { CharacterSkill } from '../types'
import { getGoblinVariantByRace } from './goblinVariants'
import { getCharacterSkills } from './skillCatalog'
import type { CharacterSkillId } from './skillCatalog'
import { normalizeGoblinRaceId } from '../types/Race'

const PURE_GOBLIN_DEFAULT_SKILL_IDS: CharacterSkillId[] = [
  'exp_bonus_70',
]

export function getDefaultSkillsForRace(race: string): CharacterSkill[] {
  const normalizedRace = normalizeGoblinRaceId(race)
  if (normalizedRace === 'goblin') {
    return getCharacterSkills(PURE_GOBLIN_DEFAULT_SKILL_IDS)
  }
  return getCharacterSkills(getGoblinVariantByRace(normalizedRace)?.defaultSkillIds ?? [])
}
