export type StoryCategory = 'main' | 'side'

export type StoryUnlockCondition = {
  type: 'dungeon_cleared'
  dungeonId: string
} | {
  type: 'purchase'
  entitlementId: string
}

export type StoryReward = {
  type: 'gold' | 'goblin' | 'equipment' | 'golden_acorn' | 'skill' | 'job'
  value: number | string
}

export type StoryChapter = {
  id: string
  text: string
}

export type Story = {
  id: string
  title: string
  category: StoryCategory
  order: number
  unlockCondition: StoryUnlockCondition | null
  rewards: StoryReward[]
  chapters: StoryChapter[]
}
