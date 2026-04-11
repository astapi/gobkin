/** ダンジョンティア（難易度バリエーション） */
export type DungeonTier = 0 | 1 | 2 | 3

export const DUNGEON_TIER_LIST = [0, 1, 2, 3] as const

export const DUNGEON_TIER_META = [
  { tier: 0 as const, prefix: '', labelKey: 'dungeonTier.normal' },
  { tier: 1 as const, prefix: '魔性', labelKey: 'dungeonTier.majou' },
  { tier: 2 as const, prefix: '宿った', labelKey: 'dungeonTier.yadotta' },
  { tier: 3 as const, prefix: '伝説', labelKey: 'dungeonTier.densetsu' },
] as const

/** ティアごとの敵レベル倍率・報酬倍率 */
export const DUNGEON_TIER_SCALING = [
  { enemyLvScale: 1.0, rewardScale: 1.0 },
  { enemyLvScale: 1.5, rewardScale: 1.3 },
  { enemyLvScale: 2.0, rewardScale: 1.6 },
  { enemyLvScale: 3.0, rewardScale: 2.0 },
] as const

/** ティアに応じたダンジョン表示名を返す */
export function getDungeonTierDisplayName(baseName: string, tier: DungeonTier): string {
  const meta = DUNGEON_TIER_META[tier]
  if (!meta.prefix) return baseName
  return `${meta.prefix} ${baseName}`
}
