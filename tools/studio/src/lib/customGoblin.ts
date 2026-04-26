import {
  goblinVariantDefinitions,
  getGoblinVariantByFactorId,
  BASE_GOBLIN_BASE_ATTRIBUTES,
} from '@app/shared/data/goblinVariants'
import {
  getGoblinJobDefinitions,
  getGoblinJobDefinition,
} from '@app/shared/data/goblinJobs'
import { getDefaultSkillsForRace } from '@app/shared/data/raceSkills'
import {
  CHARACTER_SKILL_CATALOG,
  getCharacterSkill,
  getCharacterSkillDefinition,
  type CharacterSkillId,
} from '@app/shared/data/skillCatalog'
import {
  syncGoblinDerivedStats,
  calculateGoblinEffectiveStats,
} from '@app/shared/utils/goblinStats'
import type { CharacterSkill, Goblin, GoblinJob } from '@app/shared/types'
import { getLegacyRaceName, type GoblinRaceId } from '@app/shared/types/Race'
import { getSkillLabel } from '@app/shared/i18n/entityLocalization'

import type { BackupGoblin } from './goblinMapper'

export const PURE_GOBLIN_VARIANT_ID = '__pure__'

export type VariantOptionId = string

export interface VariantOption {
  id: VariantOptionId
  label: string
  raceId: string
  isPure: boolean
}

export interface JobOption {
  id: GoblinJob | null
  label: string
}

export interface SkillOption {
  id: CharacterSkillId
  label: string
}

export interface CharacterDraft {
  id: number | null
  name: string
  variantId: VariantOptionId
  job: GoblinJob | null
  level: number
  individualValue: number
  extraSkillIds: CharacterSkillId[]
}

export const DEFAULT_DRAFT: CharacterDraft = {
  id: null,
  name: '',
  variantId: PURE_GOBLIN_VARIANT_ID,
  job: 'guard',
  level: 1,
  individualValue: 64,
  extraSkillIds: [],
}

const VARIANT_OPTIONS: VariantOption[] = [
  {
    id: PURE_GOBLIN_VARIANT_ID,
    label: 'ゴブリン (純正)',
    raceId: 'goblin',
    isPure: true,
  },
  ...Object.values(goblinVariantDefinitions).map((v) => ({
    id: v.factorId,
    label: v.raceName,
    raceId: v.raceId,
    isPure: false,
  })),
]

export function listVariantOptions(): VariantOption[] {
  return VARIANT_OPTIONS
}

export function listJobOptions(): JobOption[] {
  return [
    { id: null, label: 'なし' },
    ...getGoblinJobDefinitions().map((j) => ({ id: j.id, label: j.name })),
  ]
}

export function listSkillOptions(): SkillOption[] {
  return Object.keys(CHARACTER_SKILL_CATALOG)
    .map((id) => {
      const skill = getCharacterSkillDefinition(id)
      return {
        id: id as CharacterSkillId,
        label: skillLabelOrId(skill),
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

function skillLabelOrId(skill: CharacterSkill): string {
  const localized = getSkillLabel(skill)
  return localized && localized !== skill.id ? `${localized} (${skill.id})` : skill.id
}

export interface BuildGoblinResult {
  goblin: BackupGoblin
  baseDefaultSkillIds: string[]
}

export function buildCustomGoblin(
  draft: CharacterDraft,
  options: { id: number },
): BuildGoblinResult {
  const variant =
    draft.variantId !== PURE_GOBLIN_VARIANT_ID
      ? getGoblinVariantByFactorId(draft.variantId) ?? null
      : null
  const raceId: GoblinRaceId = variant?.raceId ?? 'goblin'
  const race = getLegacyRaceName(raceId)
  const jobDef = draft.job ? getGoblinJobDefinition(draft.job) : null

  const baseAttributes =
    variant?.baseAttributes ??
    jobDef?.baseAttributes ??
    BASE_GOBLIN_BASE_ATTRIBUTES

  const raceDefaultSkills = getDefaultSkillsForRace(raceId)
  const jobSkills = jobDef
    ? jobDef.skills
        .filter((s) => (s.unlockLevel ?? 1) <= draft.level)
        .map((s) => getCharacterSkill(s.skillId))
    : []
  const extraSkills = draft.extraSkillIds.map((id) => getCharacterSkill(id))

  const baseDefaultSkillIds = [
    ...raceDefaultSkills.map((s) => s.id),
    ...jobSkills.map((s) => s.id),
  ]

  const skillMap = new Map<string, CharacterSkill>()
  for (const s of [...raceDefaultSkills, ...jobSkills, ...extraSkills]) {
    skillMap.set(s.id, s)
  }
  const skills = Array.from(skillMap.values())

  const proto: Goblin = {
    id: options.id,
    name: draft.name,
    race,
    raceId,
    job: draft.job ?? undefined,
    level: draft.level,
    experience: 0,
    avatar: variant?.avatar ?? '',
    stats: {
      hp: 0,
      atk: 0,
      magicAtk: 0,
      def: 0,
      magicDef: 0,
      attackCount: 1,
      accuracy: 0,
      evasion: 0,
      magicHeal: 0,
      criticalRate: 0,
    },
    baseAttributes,
    factors: variant ? [variant.factorId] : [],
    variantFactorId: variant?.factorId,
    individualValue: draft.individualValue,
    skills,
  }

  const synced = syncGoblinDerivedStats(proto)
  const effective = calculateGoblinEffectiveStats(synced)

  const goblin: BackupGoblin = {
    id: synced.id,
    name: synced.name,
    race: synced.race,
    raceId: synced.raceId as string,
    job: synced.job as string | undefined,
    level: synced.level,
    experience: synced.experience,
    avatar: synced.avatar,
    stats: {
      hp: synced.stats.hp,
      atk: synced.stats.atk,
      magicAtk: synced.stats.magicAtk,
      def: synced.stats.def,
      magicDef: synced.stats.magicDef,
      attackCount: synced.stats.attackCount,
      accuracy: synced.stats.accuracy,
      evasion: synced.stats.evasion,
      magicHeal: synced.stats.magicHeal,
      criticalRate: synced.stats.criticalRate,
    },
    effectiveStats: { ...effective },
    currentHp: effective.hp,
    factors: synced.factors,
    variantFactorId: synced.variantFactorId,
    individualValue: synced.individualValue,
    skills: synced.skills,
  }

  return { goblin, baseDefaultSkillIds }
}

export function nextCustomGoblinId(existingIds: number[]): number {
  const max = existingIds.reduce((acc, id) => (id > acc ? id : acc), 0)
  return Math.max(max + 1, 100_000)
}

export function draftFromBackupGoblin(g: BackupGoblin): CharacterDraft {
  const variantId = g.variantFactorId ?? PURE_GOBLIN_VARIANT_ID
  const validVariant = listVariantOptions().some((v) => v.id === variantId)
  const job = (g.job ?? null) as GoblinJob | null
  const raceDefaultSkillIds = new Set(
    getDefaultSkillsForRace(g.raceId ?? 'goblin').map((s) => s.id),
  )
  const jobSkillIds = new Set(
    job
      ? getGoblinJobDefinition(job).skills.map((s) => s.skillId as string)
      : [],
  )
  const extraSkillIds = (g.skills ?? [])
    .map((s) => (s as CharacterSkill).id as string)
    .filter((id) => !raceDefaultSkillIds.has(id) && !jobSkillIds.has(id))
    .filter((id): id is CharacterSkillId => id in CHARACTER_SKILL_CATALOG)

  return {
    id: g.id,
    name: g.name,
    variantId: validVariant ? variantId : PURE_GOBLIN_VARIANT_ID,
    job,
    level: g.level,
    individualValue: g.individualValue ?? 64,
    extraSkillIds,
  }
}
