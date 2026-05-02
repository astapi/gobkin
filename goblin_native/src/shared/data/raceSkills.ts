import type { CharacterSkill } from '../types'
import { getGoblinVariantByRace } from './goblinVariants'
import { getCharacterSkills } from './skillCatalog'
import type { CharacterSkillId } from './skillCatalog'
import { normalizeGoblinRaceId } from '../types/Race'
import { getRaceSkillIds } from './races'

const PURE_GOBLIN_DEFAULT_SKILL_IDS: CharacterSkillId[] = [
  'exp_bonus_70',
  'goblin_pack_tactics',
]

export function getDefaultSkillsForRace(race: string): CharacterSkill[] {
  const normalizedRace = normalizeGoblinRaceId(race)
  const raceSkillIds = getRaceSkillIds([normalizedRace])
  const defaultSkillIds =
    normalizedRace === 'goblin'
      ? PURE_GOBLIN_DEFAULT_SKILL_IDS
      : (getGoblinVariantByRace(normalizedRace)?.defaultSkillIds ?? [])

  return getCharacterSkills([...new Set([...raceSkillIds, ...defaultSkillIds])])
}
