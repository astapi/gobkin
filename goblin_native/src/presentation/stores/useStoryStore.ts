import { create } from 'zustand'
import { SQLiteStoryProgressRepository } from '../../infrastructure/repositories/SQLiteStoryProgressRepository'
import { storiesData } from '../../shared/data/story'
import { TICKET_TYPES } from '../../shared/constants/purchases'
import type { Story } from '../../shared/types/Story'
import type { StoryProgressState } from '../../shared/types/StoryProgress'
import { usePurchaseStore } from './usePurchaseStore'
import { useTutorialStore } from './useTutorialStore'

const repository = SQLiteStoryProgressRepository.getInstance()

type StoryWithProgress = Story & { unlocked: boolean; read: boolean }

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
  markStoryRead: (storyId: string) => Promise<void>
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

    markStoryRead: async (storyId: string) => {
      // 既読への遷移時のみ報酬を付与（再読での重複付与を防ぐ）
      const wasUnread = !get().progress[storyId]?.read
      await repository.markRead(storyId)
      if (wasUnread) {
        const story = storiesData.find(s => s.id === storyId)
        if (story) {
          for (const reward of story.rewards) {
            if (reward.type === 'golden_acorn' && typeof reward.value === 'number' && reward.value > 0) {
              try {
                await usePurchaseStore.getState().addTickets(TICKET_TYPES.GOLDEN_ACORN, reward.value)
              } catch (error) {
                console.error('[Story] Failed to grant golden acorn reward:', error)
              }
            }
          }
        }
      }
      await refresh()

      // チュートリアル進行: 該当ストーリーの読了でステップを進める
      if (storyId === 'prologue') {
        await useTutorialStore.getState().advanceTo('see_first_goblin')
      } else if (storyId === 'story_after_slime_cave') {
        await useTutorialStore.getState().complete()
      }
    },
  }
})
