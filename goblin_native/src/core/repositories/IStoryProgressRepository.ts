import type { StoryProgressState } from '../../shared/types/StoryProgress'

export interface StoryProgress {
  unlocked: boolean
  read: boolean
}

export interface IStoryProgressRepository {
  getAll(): Promise<StoryProgressState>
  get(storyId: string): Promise<StoryProgress | null>
  save(storyId: string, progress: StoryProgress): Promise<void>
  unlock(storyId: string): Promise<void>
  markRead(storyId: string): Promise<void>
}
