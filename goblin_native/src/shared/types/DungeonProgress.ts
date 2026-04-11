export type DungeonProgressState = Record<
  string,
  { unlocked: boolean; cleared: boolean; unlockNotified: boolean; maxClearedTier: number }
>
