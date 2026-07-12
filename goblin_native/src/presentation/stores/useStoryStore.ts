import { create } from 'zustand'
import { storyProgressRepository as repository } from '../di/repositories'
import { storiesData } from '../../shared/data/story'
import { TICKET_TYPES } from '../../shared/constants/purchases'
import { getCharacterSkill } from '../../shared/data/skillCatalog'
import { getDefaultSkillsForRace } from '../../shared/data/raceSkills'
import { getGoblinVariantByFactorId } from '../../shared/data/goblinVariants'
import {
  getNamedGoblinSeed,
  getNamedGoblinSeedBySkillReward,
  type NamedGoblinSeed,
} from '../../shared/data/namedGoblinSeeds'
import { getGoblinJobLabel, getRaceLabel, getSkillLabel } from '../../shared/i18n/entityLocalization'
import type { CharacterSkill, Goblin, GoblinJob } from '../../shared/types'
import type { Story } from '../../shared/types/Story'
import type { StoryProgressState } from '../../shared/types/StoryProgress'
import { calculateGoblinEffectiveStats, syncGoblinDerivedStats } from '../../shared/utils/goblinStats'
import { getLegacyRaceName } from '../../shared/types/Race'
import { useBaseStore } from './useBaseStore'
import { usePurchaseStore } from './usePurchaseStore'
import { useTutorialStore } from './useTutorialStore'
import { getGoblinRepository, useGoblinStore } from './useGoblinStore'

const goblinRepository = getGoblinRepository()

type StoryWithProgress = Story & { unlocked: boolean; read: boolean }

export type StoryRewardGrant =
  | { type: 'golden_acorn'; value: number }
  | { type: 'skill'; skillId: string; label: string }
  | { type: 'job'; jobId: GoblinJob; label: string }
  | { type: 'goblin'; goblinId: number; name: string; label: string }

const buildStories = (progress: StoryProgressState): StoryWithProgress[] =>
  storiesData.map(story => ({
    ...story,
    unlocked: progress[story.id]?.unlocked ?? (story.unlockCondition === null),
    read: progress[story.id]?.read ?? false,
  }))

const countUnread = (progress: StoryProgressState): number =>
  Object.values(progress).filter(p => p.unlocked && !p.read).length

interface StoryStoreState {
  progress: StoryProgressState
  stories: StoryWithProgress[]
  isLoading: boolean
  unreadCount: number
}

interface StoryStoreActions {
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  /** ダンジョンクリア時に対応するストーリーを解放。解放されたストーリーを返す */
  checkAndUnlockStories: (clearedDungeonId: string) => Promise<Story[]>
  /** ストーリーを読了済みにする */
  markStoryRead: (storyId: string) => Promise<StoryRewardGrant[]>
}

async function grantFounderSkill(skillId: string): Promise<StoryRewardGrant | null> {
  const founder = await goblinRepository.getGoblin(0)
  if (!founder) return null
  if (founder.skills.some(skill => skill.id === skillId)) return null
  const skill = getCharacterSkill(skillId)

  await goblinRepository.saveGoblin({
    ...founder,
    skills: [...founder.skills, skill],
    effectiveStats: undefined,
  })
  await useGoblinStore.getState().refresh()
  return {
    type: 'skill',
    skillId,
    label: getSkillLabel(skill),
  }
}

function createRewardGoblin(id: number, factorId: string): Goblin | null {
  const variant = getGoblinVariantByFactorId(factorId)
  if (!variant) return null

  const race = getLegacyRaceName(variant.raceId)
  const goblin = syncGoblinDerivedStats({
    id,
    name: variant.raceName,
    race,
    raceId: variant.raceId,
    level: 1,
    experience: 0,
    avatar: variant.avatar,
    baseAttributes: variant.baseAttributes,
    stats: {
      hp: 1,
      atk: 1,
      magicAtk: 1,
      def: 1,
      magicDef: 1,
      attackCount: 1,
      accuracy: 1,
      evasion: 1,
      magicHeal: 1,
      criticalRate: 0,
    },
    individualValue: 1,
    factors: [factorId],
    variantFactorId: factorId,
    skills: getDefaultSkillsForRace(variant.raceId),
  })

  return {
    ...goblin,
    effectiveStats: calculateGoblinEffectiveStats(goblin),
  }
}

async function grantPendingGoblin(factorId: string): Promise<StoryRewardGrant | null> {
  const nextId = await useBaseStore.getState().getNextGoblinId()
  const goblin = createRewardGoblin(nextId, factorId)
  if (!goblin) return null

  // 読了報酬は遠征産ゴブリンと異なり、待機枠上限を超えても必ず付与する。
  await useBaseStore.getState().addPendingGoblin(goblin)
  return {
    type: 'goblin',
    goblinId: goblin.id,
    name: goblin.name,
    label: getRaceLabel(goblin.raceId ?? goblin.race),
  }
}

/** 重複idを避けつつスキルを追加する。 */
function appendSkillsUnique(skills: CharacterSkill[], additions: CharacterSkill[]): CharacterSkill[] {
  const merged = [...skills]
  for (const skill of additions) {
    if (!merged.some((existing) => existing.id === skill.id)) merged.push(skill)
  }
  return merged
}

/**
 * 既読ストーリーの `named_goblin_skill` 報酬のうち、指定した固有種(raceId)向けの固有スキルを集める。
 * ギド未加入のまま story_after_subjugation を先に読んだ場合でも、後からギドが加入した時点で
 * 取りこぼしなくスキルを載せるために使う（順序両対応の (b)）。
 */
async function collectReadNamedGoblinSkillsForRace(raceId: NamedGoblinSeed['raceId']): Promise<CharacterSkill[]> {
  const progress = await repository.getAll()
  const skills: CharacterSkill[] = []
  for (const story of storiesData) {
    if (!progress[story.id]?.read) continue
    for (const reward of story.rewards) {
      if (reward.type !== 'named_goblin_skill' || typeof reward.value !== 'string') continue
      const targetSeed = getNamedGoblinSeedBySkillReward(reward.value)
      if (targetSeed?.raceId !== raceId) continue
      skills.push(getCharacterSkill(reward.value))
    }
  }
  return skills
}

function createNamedGoblin(id: number, seed: NamedGoblinSeed): Goblin {
  const race = getLegacyRaceName(seed.raceId)
  const goblin = syncGoblinDerivedStats({
    id,
    name: seed.name,
    race,
    raceId: seed.raceId,
    level: seed.level,
    experience: seed.experience,
    avatar: seed.avatar,
    stats: {
      hp: seed.stats.hp,
      atk: seed.stats.atk,
      magicAtk: 1,
      def: seed.stats.def,
      magicDef: 1,
      attackCount: seed.stats.attackCount,
      accuracy: seed.stats.accuracy,
      evasion: seed.stats.evasion,
      magicHeal: 1,
      criticalRate: 0,
    },
    individualValue: 1,
    skills: getDefaultSkillsForRace(seed.raceId),
  })

  return {
    ...goblin,
    effectiveStats: calculateGoblinEffectiveStats(goblin),
  }
}

async function grantNamedGoblin(seedKey: string): Promise<StoryRewardGrant | null> {
  const seed = getNamedGoblinSeed(seedKey)
  if (!seed) return null

  // 既に加入済みの固有種は二重付与しない（読了フローの冪等性を補強）。
  const existing = await goblinRepository.getGoblins()
  if (existing.some((goblin) => (goblin.raceId ?? goblin.race) === seed.raceId)) return null

  const nextId = await useBaseStore.getState().getNextGoblinId()
  const baseGoblin = createNamedGoblin(nextId, seed)

  // 順序両対応(b): 先に named_goblin_skill 報酬ストーリーを読了済みなら、加入時点でスキルを載せる。
  const willSkills = await collectReadNamedGoblinSkillsForRace(seed.raceId)
  const goblin = willSkills.length > 0
    ? { ...baseGoblin, skills: appendSkillsUnique(baseGoblin.skills, willSkills), effectiveStats: undefined }
    : baseGoblin

  // 読了報酬は待機枠上限を超えても必ず付与する。
  await useBaseStore.getState().addPendingGoblin(goblin)
  return {
    type: 'goblin',
    goblinId: goblin.id,
    name: goblin.name,
    label: getRaceLabel(goblin.raceId ?? goblin.race),
  }
}

/**
 * ネームド固有種へ固有スキルを付与する（順序両対応(a)）。
 * story_after_subjugation 読了時点で対象（ギド）が既に存在する場合に用いる。
 * - 本編加入済み: goblinRepository の個体へ追加保存。
 * - 待機枠(pending)在籍: pendingGoblinRepository の個体へ addPendingGoblin(INSERT OR REPLACE)で更新。
 * 既に同スキルを持つ場合は二重付与しない。対象が未加入なら null（後から (b) 経路で付与される）。
 */
async function grantNamedGoblinSkill(skillId: string): Promise<StoryRewardGrant | null> {
  const seed = getNamedGoblinSeedBySkillReward(skillId)
  if (!seed) return null
  const skill = getCharacterSkill(skillId)

  // (a) 本編に加入済みの個体へ付与
  const goblins = await goblinRepository.getGoblins()
  const owned = goblins.find((goblin) => (goblin.raceId ?? goblin.race) === seed.raceId)
  if (owned) {
    if (owned.skills.some((s) => s.id === skillId)) return null
    await goblinRepository.saveGoblin({
      ...owned,
      skills: appendSkillsUnique(owned.skills, [skill]),
      effectiveStats: undefined,
    })
    await useGoblinStore.getState().refresh()
    return { type: 'skill', skillId, label: getSkillLabel(skill) }
  }

  // (a) 待機枠(pending)に在籍する個体へ付与
  await useBaseStore.getState().refreshPendingGoblins()
  const pending = useBaseStore.getState().pendingGoblins
  const pendingGoblin = pending.find((goblin) => (goblin.raceId ?? goblin.race) === seed.raceId)
  if (pendingGoblin) {
    if (pendingGoblin.skills.some((s) => s.id === skillId)) return null
    await useBaseStore.getState().addPendingGoblin({
      ...pendingGoblin,
      skills: appendSkillsUnique(pendingGoblin.skills, [skill]),
      effectiveStats: undefined,
    })
    return { type: 'skill', skillId, label: getSkillLabel(skill) }
  }

  // 対象が未加入: (b) の経路（grantNamedGoblin）で加入時に付与する。
  return null
}

async function applyStoryRewards(story: Story): Promise<StoryRewardGrant[]> {
  const grants: StoryRewardGrant[] = []

  for (const reward of story.rewards) {
    if (reward.type === 'golden_acorn' && typeof reward.value === 'number' && reward.value > 0) {
      try {
        await usePurchaseStore.getState().addTickets(TICKET_TYPES.GOLDEN_ACORN, reward.value)
        grants.push({ type: 'golden_acorn', value: reward.value })
      } catch (error) {
        console.error('[Story] Failed to grant golden acorn reward:', error)
      }
    }
    if (reward.type === 'skill' && typeof reward.value === 'string') {
      try {
        const grant = await grantFounderSkill(reward.value)
        if (grant) grants.push(grant)
      } catch (error) {
        console.error('[Story] Failed to grant founder skill reward:', error)
      }
    }
    if (reward.type === 'job' && typeof reward.value === 'string') {
      grants.push({
        type: 'job',
        jobId: reward.value as GoblinJob,
        label: getGoblinJobLabel(reward.value as GoblinJob),
      })
    }
    if (reward.type === 'goblin' && typeof reward.value === 'string') {
      try {
        const grant = await grantPendingGoblin(reward.value)
        if (grant) grants.push(grant)
      } catch (error) {
        console.error('[Story] Failed to grant pending goblin reward:', error)
      }
    }
    if (reward.type === 'named_goblin' && typeof reward.value === 'string') {
      try {
        const grant = await grantNamedGoblin(reward.value)
        if (grant) grants.push(grant)
      } catch (error) {
        console.error('[Story] Failed to grant named goblin reward:', error)
      }
    }
    if (reward.type === 'named_goblin_skill' && typeof reward.value === 'string') {
      try {
        const grant = await grantNamedGoblinSkill(reward.value)
        if (grant) grants.push(grant)
      } catch (error) {
        console.error('[Story] Failed to grant named goblin skill reward:', error)
      }
    }
  }

  return grants
}

async function backfillReadStorySkillRewards(progress: StoryProgressState): Promise<void> {
  for (const story of storiesData) {
    if (!progress[story.id]?.read) continue
    for (const reward of story.rewards) {
      if (reward.type === 'skill' && typeof reward.value === 'string') {
        try {
          await grantFounderSkill(reward.value)
        } catch (error) {
          console.error('[Story] Failed to backfill founder skill reward:', error)
        }
      }
    }
  }
}

export const useStoryStore = create<StoryStoreState & StoryStoreActions>()((set, get) => {
  const refresh = async () => {
    const storedProgress = await repository.getAll()
    // プロローグ (unlockCondition === null) はDBに未登録でも unlocked 扱い
    for (const story of storiesData) {
      if (story.unlockCondition === null && !storedProgress[story.id]) {
        storedProgress[story.id] = { unlocked: true, read: false }
        await repository.save(story.id, { unlocked: true, read: false })
      }
    }
    await backfillReadStorySkillRewards(storedProgress)
    set({
      progress: storedProgress,
      stories: buildStories(storedProgress),
      unreadCount: countUnread(storedProgress),
    })
  }

  return {
    progress: {},
    stories: buildStories({}),
    isLoading: true,
    unreadCount: 0,

    initialize: async () => {
      await refresh()
      set({ isLoading: false })
    },

    refresh,

    checkAndUnlockStories: async (clearedDungeonId: string): Promise<Story[]> => {
      const { progress } = get()
      const unlocked: Story[] = []

      for (const story of storiesData) {
        if (
          story.unlockCondition?.type === 'dungeon_cleared' &&
          story.unlockCondition.dungeonId === clearedDungeonId &&
          !progress[story.id]?.unlocked
        ) {
          await repository.unlock(story.id)
          unlocked.push(story)
        }
      }

      if (unlocked.length > 0) {
        await refresh()
      }

      return unlocked
    },

    markStoryRead: async (storyId: string): Promise<StoryRewardGrant[]> => {
      // 既読への遷移時のみ報酬を付与（再読での重複付与を防ぐ）
      const wasUnread = !get().progress[storyId]?.read
      await repository.markRead(storyId)
      let grants: StoryRewardGrant[] = []
      if (wasUnread) {
        const story = storiesData.find(s => s.id === storyId)
        if (story) {
          grants = await applyStoryRewards(story)
        }
      }
      await refresh()

      // チュートリアル進行: 該当ストーリーの読了でステップを進める
      // （スライム洞窟クリア後の完了は、一覧画面でのゴブリン追加まで延長したため
      //   story_after_slime_cave 読了では完了させない）
      if (storyId === 'prologue') {
        await useTutorialStore.getState().advanceTo('see_first_goblin')
      }
      return grants
    },
  }
})
