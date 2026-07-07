import { create } from 'zustand'
import { storyProgressRepository as repository } from '../di/repositories'
import { storiesData } from '../../shared/data/story'
import { TICKET_TYPES } from '../../shared/constants/purchases'
import { getCharacterSkill } from '../../shared/data/skillCatalog'
import { getDefaultSkillsForRace } from '../../shared/data/raceSkills'
import { getGoblinVariantByFactorId } from '../../shared/data/goblinVariants'
import { getGoblinJobLabel, getRaceLabel, getSkillLabel } from '../../shared/i18n/entityLocalization'
import type { Goblin, GoblinJob } from '../../shared/types'
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
