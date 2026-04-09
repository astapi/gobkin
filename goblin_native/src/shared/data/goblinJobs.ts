import type { CharacterSkill, Goblin, GoblinJob } from '../types'
import { cloneCharacterSkills } from './characterSkills'
import { getDefaultSkillsForRace } from './raceSkills'

type GoblinJobSkill = {
  unlockLevel?: number
  skill: CharacterSkill
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
    name: 'ゴブリンガード',
    shortLabel: '防御',
    accentColor: '#2563EB',
    summary: '耐久と防御を強化し、前線維持に寄せる。',
    description: '盾役として鍛え上げ、打たれ強さと防御能力を伸ばします。',
    skills: [
      {
        skill: {
          id: 'goblin_job_guard_armor',
          name: '[1.5倍]鎧装備',
          equipmentCategoryMultiplier: { armor: 1.5 },
        },
      },
      {
        skill: {
          id: 'goblin_job_guard_wall',
          name: '[-5%]物理ダメージ軽減(%)',
          physicalDamageReductionPercent: 5,
        },
      },
      {
        unlockLevel: 15,
        skill: {
          id: 'goblin_job_guard_cover',
          name: 'かばう',
          coverLowHpAlly: true,
        },
      },
    ],
  },
  thief: {
    id: 'thief',
    name: 'ゴブリンシーフ',
    shortLabel: '速さ',
    accentColor: '#059669',
    summary: '速度と回避を伸ばし、手数と奇襲に寄せる。',
    description: '斥候として鍛え上げ、素早さと回避能力を高めます。',
    skills: [
      {
        skill: {
          id: 'goblin_job_thief_initiative',
          name: '先制攻撃',
          statMultipliers: { spd: 1.2 },
        },
      },
      {
        unlockLevel: 15,
        skill: {
          id: 'goblin_job_thief_evasion',
          name: '回避適正',
          statMultipliers: { evasion: 1.5 },
        },
      },
    ],
  },
  mage: {
    id: 'mage',
    name: 'ゴブリンメイジ',
    shortLabel: '魔法',
    accentColor: '#B91C1C',
    summary: '呪文を習得し、範囲攻撃を扱えるようになる。',
    description: '呪文訓練を施し、魔力と範囲攻撃を扱える後衛に変えます。',
    skills: [
      {
        skill: {
          id: 'goblin_job_mage_fireball',
          name: 'ファイヤーボール',
          grantsSpellId: 'fireball',
        },
      },
      {
        skill: {
          id: 'goblin_job_mage_magic_arrow',
          name: 'マジックアロー',
          grantsSpellId: 'magic_arrow',
        },
      },
      {
        unlockLevel: 15,
        skill: {
          id: 'goblin_job_mage_blizzard',
          name: 'ブリザード',
          grantsSpellId: 'blizzard',
        },
      },
    ],
  },
  warrior: {
    id: 'warrior',
    name: 'ゴブリンウォリアー',
    shortLabel: '攻撃',
    accentColor: '#EA580C',
    summary: '攻撃性能を大きく伸ばし、殴り合いに強くする。',
    description: '武闘訓練を施し、攻撃力と手数を前線向けに強化します。',
    skills: [
      {
        skill: {
          id: 'goblin_job_warrior_armor',
          name: '[1.2倍]鎧装備',
          equipmentCategoryMultiplier: { armor: 1.2 },
        },
      },
      {
        skill: {
          id: 'goblin_job_warrior_inspire',
          name: '鼓舞',
          rearAllyDamageMultiplier: 1.5,
        },
      },
    ],
  },
}

const GOBLIN_JOB_SKILL_IDS = new Set(
  Object.values(GOBLIN_JOB_DEFINITIONS)
    .flatMap((job) => job.skills.map((entry) => entry.skill))
    .map((skill) => skill.id)
)

export const GOBLIN_TRAINING_UNLOCK_RANK = 2

export function getGoblinJobDefinitions(): GoblinJobDefinition[] {
  return Object.values(GOBLIN_JOB_DEFINITIONS)
}

export function getGoblinJobDefinition(job: GoblinJob): GoblinJobDefinition {
  return GOBLIN_JOB_DEFINITIONS[job]
}

export function isPureGoblin(goblin: Goblin): boolean {
  return goblin.race === 'ゴブリン'
}

export function canTrainGoblin(goblin: Goblin): boolean {
  return isPureGoblin(goblin)
}

export function getGoblinJobSkills(job: GoblinJob, level: number): CharacterSkill[] {
  return GOBLIN_JOB_DEFINITIONS[job].skills
    .filter((entry) => (entry.unlockLevel ?? 1) <= level)
    .map((entry) => entry.skill)
    .map((skill) => ({ ...skill }))
}

export function normalizeGoblinJobSkills(goblin: Goblin): Goblin {
  const raceDefaultSkills = getDefaultSkillsForRace(goblin.race)
  const raceDefaultSkillIds = new Set(raceDefaultSkills.map((skill) => skill.id))
  const preservedSkills = goblin.skills.filter((skill) => (
    !raceDefaultSkillIds.has(skill.id) && !GOBLIN_JOB_SKILL_IDS.has(skill.id)
  ))
  const jobSkills = goblin.job ? cloneCharacterSkills(getGoblinJobSkills(goblin.job, goblin.level)) : []

  return {
    ...goblin,
    skills: [...cloneCharacterSkills(raceDefaultSkills), ...jobSkills, ...preservedSkills],
  }
}

export function applyGoblinJob(goblin: Goblin, job?: GoblinJob): Goblin {
  return normalizeGoblinJobSkills({
    ...goblin,
    job,
  })
}

export function formatGoblinJobSkillName(jobSkill: GoblinJobSkill): string {
  if (!jobSkill.unlockLevel || jobSkill.unlockLevel <= 1) return jobSkill.skill.name
  return `Lv${jobSkill.unlockLevel} ${jobSkill.skill.name}`
}

export function getGoblinJobSkillEntries(job: GoblinJob): GoblinJobSkill[] {
  return GOBLIN_JOB_DEFINITIONS[job].skills.map((entry) => ({
    unlockLevel: entry.unlockLevel,
    skill: { ...entry.skill },
  }))
}
