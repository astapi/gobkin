import type { CharacterSkill } from '../types'
import { getGoblinVariantByRace } from './goblinVariants'
import { getCharacterSkills } from './skillCatalog'
import { normalizeGoblinRaceId } from '../types/Race'
import { getRaceSkillIds } from './races'
import { pureGoblinSeed } from './pureGoblin'
import { founderGoblinSeed } from './founderGoblin'
import { getNamedGoblinSeedByRaceId } from './namedGoblinSeeds'

export function getDefaultSkillsForRace(race: string): CharacterSkill[] {
  const normalizedRace = normalizeGoblinRaceId(race)
  const raceSkillIds = getRaceSkillIds([normalizedRace])
  const defaultSkillIds =
    normalizedRace === 'founder'
      ? founderGoblinSeed.defaultSkillIds
      : normalizedRace === 'goblin'
      ? pureGoblinSeed.defaultSkillIds
      : (getNamedGoblinSeedByRaceId(normalizedRace)?.defaultSkillIds
        ?? getGoblinVariantByRace(normalizedRace)?.defaultSkillIds
        ?? [])

  return getCharacterSkills([...new Set([...raceSkillIds, ...defaultSkillIds])])
}
