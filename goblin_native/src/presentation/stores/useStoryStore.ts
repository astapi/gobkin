import { create } from 'zustand'
import { SQLiteStoryProgressRepository } from '../../infrastructure/repositories/SQLiteStoryProgressRepository'
import { storiesData } from '../../shared/data/story'
import type { Story } from '../../shared/types/Story'
import type { StoryProgressState } from '../../shared/types/StoryProgress'

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
      await repository.markRead(storyId)
      await refresh()
    },
  }
})
