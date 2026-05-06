import { getCharacterSkill } from '../../shared/data/skillCatalog'
import {
  factorSkillInheritanceRules,
  pureGoblinSkillManifestationRules,
  PURE_GOBLIN_BIRTH_SKILL_SLOT_MAX,
  type BirthSkillLotteryEntry,
} from '../../shared/data/skillBirthRules'
import type { CharacterSkill } from '../../shared/types/CharacterSkill'

interface RollPureGoblinBirthSkillsOptions {
  inheritedFactorIds: string[]
  baseRank?: number
  existingSkillIds?: Iterable<string>
  rng: () => number
}

export class BirthSkillService {
  static rollPureGoblinBirthSkills({
    inheritedFactorIds,
    baseRank,
    existingSkillIds = [],
    rng,
  }: RollPureGoblinBirthSkillsOptions): CharacterSkill[] {
    const inheritedCandidates = inheritedFactorIds.flatMap(
      (factorId) => factorSkillInheritanceRules[factorId]?.skills ?? [],
    )
    const manifestedCandidates = baseRank === undefined
      ? []
      : pureGoblinSkillManifestationRules
          .filter((rule) => rule.baseRank <= baseRank)
          .flatMap((rule) => rule.skills)

    if (inheritedCandidates.length === 0 && manifestedCandidates.length === 0) {
      return []
    }

    const slotCount = PURE_GOBLIN_BIRTH_SKILL_SLOT_MAX
    const selectedSkillIds = new Set(existingSkillIds)
    const birthSkillIds: string[] = []

    this.rollCandidates(inheritedCandidates, slotCount, selectedSkillIds, birthSkillIds, rng)
    this.rollCandidates(manifestedCandidates, slotCount, selectedSkillIds, birthSkillIds, rng)

    return birthSkillIds.map((skillId) => getCharacterSkill(skillId))
  }

  private static rollCandidates(
    candidates: BirthSkillLotteryEntry[],
    slotCount: number,
    selectedSkillIds: Set<string>,
    birthSkillIds: string[],
    rng: () => number,
  ): void {
    for (const candidate of candidates) {
      if (birthSkillIds.length >= slotCount) return
      if (selectedSkillIds.has(candidate.skillId)) continue
      if (rng() >= candidate.probability) continue

      selectedSkillIds.add(candidate.skillId)
      birthSkillIds.push(candidate.skillId)
    }
  }
}
