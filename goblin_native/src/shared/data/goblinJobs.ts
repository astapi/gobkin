import type { CharacterSkill, Goblin, GoblinBaseAttributes, GoblinJob } from '../types'
import { cloneCharacterSkills } from './characterSkills'
import { getDefaultSkillsForRace } from './raceSkills'
import { syncGoblinDerivedStats } from '../utils/goblinStats'
import { getGoblinBaseAttributes } from '../utils/goblinHp'
import { getCharacterSkill, type CharacterSkillId } from './skillCatalog'
import { isBaseGoblinRaceId, normalizeGoblinRaceId } from '../types/Race'
import { isProtectedGoblin } from '../utils/goblinProtection'
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
  unlockRequiresClearedArea?: string
  unlockRequiresReadStory?: string
  baseAttributes?: GoblinBaseAttributes
}

type GoblinJobDefinitionSeed = {
  id: GoblinJob
  accentColor: string
  skills: GoblinJobSkill[]
  unlockRequiresClearedArea?: string
  unlockRequiresReadStory?: string
  baseAttributes?: GoblinBaseAttributes
}

const GOBLIN_JOB_DEFINITION_SEEDS: Record<GoblinJob, GoblinJobDefinitionSeed> = {
  guard: {
    accentColor: "#2563EB",
    id: "guard",
    skills: [
      {
        skillId: "talent_def_150"
      },
      {
        skillId: "armor_mastery_150"
      },
      {
        skillId: "physical_reduction_5"
      },
      {
        skillId: "cover_low_hp_ally",
        unlockLevel: 15
      },
      {
        skillId: "rear_guard",
        unlockLevel: 15
      }
    ],
    baseAttributes: {
      power: 10,
      wisdom: 10,
      spirit: 10,
      vitality: 11,
      agility: 10,
      luck: 10
    }
  },
  thief: {
    accentColor: "#059669",
    id: "thief",
    skills: [
      {
        skillId: "action_order_150"
      },
      {
        skillId: "gold_bonus_50"
      },
      {
        skillId: "evasion_150",
        unlockLevel: 15
      }
    ],
    baseAttributes: {
      power: 10,
      wisdom: 10,
      spirit: 10,
      vitality: 10,
      agility: 11,
      luck: 11
    }
  },
  mage: {
    accentColor: "#B91C1C",
    id: "mage",
    skills: [
      {
        skillId: "mage_magic_lv7"
      },
      {
        skillId: "mana_recovery"
      },
      {
        skillId: "spell_damage_20"
      }
    ],
    baseAttributes: {
      power: 10,
      wisdom: 11,
      spirit: 10,
      vitality: 10,
      agility: 10,
      luck: 10
    }
  },
  warrior: {
    accentColor: "#EA580C",
    id: "warrior",
    skills: [
      {
        skillId: "talent_attackCount_150"
      },
      {
        skillId: "armor_mastery_120"
      },
      {
        skillId: "inspire_150"
      }
    ],
    baseAttributes: {
      power: 10,
      wisdom: 10,
      spirit: 10,
      vitality: 11,
      agility: 10,
      luck: 10
    }
  },
  cleric: {
    accentColor: "#0D9488",
    id: "cleric",
    skills: [
      {
        skillId: "recovery_magic_lv7"
      },
      {
        skillId: "magic_rear_guard"
      },
      {
        skillId: "magic_field"
      },
      {
        skillId: "instant_revive",
        unlockLevel: 70
      }
    ],
    unlockRequiresClearedArea: "road_1",
    baseAttributes: {
      power: 10,
      wisdom: 10,
      spirit: 11,
      vitality: 10,
      agility: 10,
      luck: 10
    }
  },
  rider: {
    accentColor: "#7C3AED",
    baseAttributes: {
      agility: 15,
      luck: 12,
      power: 12,
      spirit: 10,
      vitality: 10,
      wisdom: 8
    },
    id: "rider",
    skills: [
      {
        skillId: "critical_support"
      },
      {
        skillId: "attack_count_up_3"
      },
      {
        skillId: "action_order_150"
      },
      {
        skillId: "counter_avoidance_2_3"
      }
    ],
    unlockRequiresReadStory: "story_after_wolf_grassland"
  }
}

function buildGoblinJobDefinition(seed: GoblinJobDefinitionSeed): GoblinJobDefinition {
  return {
    ...seed,
    name: getGoblinJobLabel(seed.id),
    shortLabel: getGoblinJobShortLabel(seed.id),
    summary: getGoblinJobSummary(seed.id),
    description: getGoblinJobDescription(seed.id),
  }
}

export const GOBLIN_JOB_SKILL_IDS = new Set<string>(
  [
    ...Object.values(GOBLIN_JOB_DEFINITION_SEEDS)
      .flatMap((job) => job.skills.map((entry) => entry.skillId)),
    'grant_fireball',
    'grant_magic_arrow',
    'grant_blizzard',
  ]
)

export const GOBLIN_TRAINING_UNLOCK_RANK = 2

export function getGoblinJobDefinitions(): GoblinJobDefinition[] {
  return Object.values(GOBLIN_JOB_DEFINITION_SEEDS).map(buildGoblinJobDefinition)
}

export function getGoblinTrainingJobDefinitions(
  clearedAreaIds: ReadonlySet<string>,
  readStoryIds: ReadonlySet<string> = new Set(),
): GoblinJobDefinition[] {
  return getGoblinJobDefinitions().filter((job) => (
    (!job.unlockRequiresClearedArea || clearedAreaIds.has(job.unlockRequiresClearedArea)) &&
    (!job.unlockRequiresReadStory || readStoryIds.has(job.unlockRequiresReadStory))
  ))
}

export function getGoblinJobDefinition(job: GoblinJob): GoblinJobDefinition {
  return buildGoblinJobDefinition(GOBLIN_JOB_DEFINITION_SEEDS[job])
}

export function isPureGoblin(goblin: Goblin): boolean {
  return isBaseGoblinRaceId(goblin.raceId ?? goblin.race)
}

export function canTrainGoblin(goblin: Goblin): boolean {
  return isPureGoblin(goblin) && !isProtectedGoblin(goblin) && !goblin.job
}

export function getGoblinJobSkills(job: GoblinJob, level: number): CharacterSkill[] {
  return GOBLIN_JOB_DEFINITION_SEEDS[job].skills
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
  const jobDefinition = job ? getGoblinJobDefinition(job) : null
  return syncGoblinDerivedStats(normalizeGoblinJobSkills({
    ...goblin,
    baseAttributes: jobDefinition?.baseAttributes ?? getGoblinBaseAttributes(goblin),
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
  return GOBLIN_JOB_DEFINITION_SEEDS[job].skills.map((entry) => ({
    unlockLevel: entry.unlockLevel,
    skillId: entry.skillId,
  }))
}
