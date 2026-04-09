import type { CharacterSkill, Goblin, GoblinJob } from '../types'
import { cloneCharacterSkills } from './characterSkills'
import { getDefaultSkillsForRace } from './raceSkills'
import { syncGoblinDerivedStats } from '../utils/goblinStats'
import { getGoblinBaseAttributes } from '../utils/goblinHp'
import { getCharacterSkill, type CharacterSkillId } from './skillCatalog'
import { normalizeGoblinRaceId } from '../types/Race'
import {
  getGoblinJobDescription,
  getGoblinJobLabel,
  getGoblinJobShortLabel,
  getGoblinJobSummary,
  getSkillLabel,
} from '../i18n/entityLocalization'

type GoblinJobSkill = {
  unlockLevel?: number
  skillId: CharacterSkillId
}

type GoblinJobDefinition = {
  id: GoblinJob
  name: string
  shortLabel: string
  accentColor: string
  summary: string
  description: string
  skills: GoblinJobSkill[]
}

const GOBLIN_JOB_DEFINITIONS: Record<GoblinJob, GoblinJobDefinition> = {
  guard: {
    id: 'guard',
    name: getGoblinJobLabel('guard'),
    shortLabel: getGoblinJobShortLabel('guard'),
    accentColor: '#2563EB',
    summary: getGoblinJobSummary('guard'),
    description: getGoblinJobDescription('guard'),
    skills: [
      {
        skillId: 'armor_mastery_150',
      },
      {
        skillId: 'physical_reduction_5',
      },
      {
        unlockLevel: 15,
        skillId: 'cover_low_hp_ally',
      },
    ],
  },
  thief: {
    id: 'thief',
    name: getGoblinJobLabel('thief'),
    shortLabel: getGoblinJobShortLabel('thief'),
    accentColor: '#059669',
    summary: getGoblinJobSummary('thief'),
    description: getGoblinJobDescription('thief'),
    skills: [
      {
        skillId: 'action_order_150',
      },
      {
        unlockLevel: 15,
        skillId: 'evasion_150',
      },
    ],
  },
  mage: {
    id: 'mage',
    name: getGoblinJobLabel('mage'),
    shortLabel: getGoblinJobShortLabel('mage'),
    accentColor: '#B91C1C',
    summary: getGoblinJobSummary('mage'),
    description: getGoblinJobDescription('mage'),
    skills: [
      {
        skillId: 'grant_fireball',
      },
      {
        skillId: 'grant_magic_arrow',
      },
      {
        unlockLevel: 15,
        skillId: 'grant_blizzard',
      },
    ],
  },
  warrior: {
    id: 'warrior',
    name: getGoblinJobLabel('warrior'),
    shortLabel: getGoblinJobShortLabel('warrior'),
    accentColor: '#EA580C',
    summary: getGoblinJobSummary('warrior'),
    description: getGoblinJobDescription('warrior'),
    skills: [
      {
        skillId: 'armor_mastery_120',
      },
      {
        skillId: 'inspire_150',
      },
    ],
  },
}

const GOBLIN_JOB_SKILL_IDS = new Set<string>(
  Object.values(GOBLIN_JOB_DEFINITIONS)
    .flatMap((job) => job.skills.map((entry) => entry.skillId))
)

export const GOBLIN_TRAINING_UNLOCK_RANK = 2

export function getGoblinJobDefinitions(): GoblinJobDefinition[] {
  return Object.values(GOBLIN_JOB_DEFINITIONS)
}

export function getGoblinJobDefinition(job: GoblinJob): GoblinJobDefinition {
  return GOBLIN_JOB_DEFINITIONS[job]
}

export function isPureGoblin(goblin: Goblin): boolean {
  return normalizeGoblinRaceId(goblin.raceId ?? goblin.race) === 'goblin'
}

export function canTrainGoblin(goblin: Goblin): boolean {
  return isPureGoblin(goblin)
}

export function getGoblinJobSkills(job: GoblinJob, level: number): CharacterSkill[] {
  return GOBLIN_JOB_DEFINITIONS[job].skills
    .filter((entry) => (entry.unlockLevel ?? 1) <= level)
    .map((entry) => getCharacterSkill(entry.skillId))
}

export function normalizeGoblinJobSkills(goblin: Goblin): Goblin {
  const raceDefaultSkills = getDefaultSkillsForRace(goblin.race)
  const raceDefaultSkillIds = new Set<string>(raceDefaultSkills.map((skill) => skill.id))
  const preservedSkills = goblin.skills.filter((skill) => (
    !raceDefaultSkillIds.has(skill.id) && !GOBLIN_JOB_SKILL_IDS.has(skill.id as string)
  ))
  const jobSkills = goblin.job ? cloneCharacterSkills(getGoblinJobSkills(goblin.job, goblin.level)) : []

  return {
    ...goblin,
    skills: [...cloneCharacterSkills(raceDefaultSkills), ...jobSkills, ...preservedSkills],
  }
}

export function applyGoblinJob(goblin: Goblin, job?: GoblinJob): Goblin {
  return syncGoblinDerivedStats(normalizeGoblinJobSkills({
    ...goblin,
    baseAttributes: getGoblinBaseAttributes(goblin),
    job,
  }))
}

export function formatGoblinJobSkillName(jobSkill: GoblinJobSkill): string {
  const skill = getCharacterSkill(jobSkill.skillId)
  const label = getSkillLabel(skill)
  if (!jobSkill.unlockLevel || jobSkill.unlockLevel <= 1) return label
  return `Lv${jobSkill.unlockLevel} ${label}`
}

export function getGoblinJobSkillEntries(job: GoblinJob): GoblinJobSkill[] {
  return GOBLIN_JOB_DEFINITIONS[job].skills.map((entry) => ({
    unlockLevel: entry.unlockLevel,
    skillId: entry.skillId,
  }))
}
