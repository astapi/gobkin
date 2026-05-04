import { create } from 'zustand'
import { SQLiteStoryProgressRepository } from '../../infrastructure/repositories/SQLiteStoryProgressRepository'
import { storiesData } from '../../shared/data/story'
import { TICKET_TYPES } from '../../shared/constants/purchases'
import { getCharacterSkill } from '../../shared/data/skillCatalog'
import { getSkillLabel } from '../../shared/i18n/entityLocalization'
import type { Story } from '../../shared/types/Story'
import type { StoryProgressState } from '../../shared/types/StoryProgress'
import { usePurchaseStore } from './usePurchaseStore'
import { useTutorialStore } from './useTutorialStore'
import { getGoblinRepository, useGoblinStore } from './useGoblinStore'

const repository = SQLiteStoryProgressRepository.getInstance()
const goblinRepository = getGoblinRepository()

type StoryWithProgress = Story & { unlocked: boolean; read: boolean }

export type StoryRewardGrant =
  | { type: 'golden_acorn'; value: number }
  | { type: 'skill'; skillId: string; label: string }

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
      if (storyId === 'prologue') {
        await useTutorialStore.getState().advanceTo('see_first_goblin')
      } else if (storyId === 'story_after_slime_cave') {
        await useTutorialStore.getState().complete()
      }
      return grants
    },
  }
})
