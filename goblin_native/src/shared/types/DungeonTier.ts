/** ダンジョンティア（難易度バリエーション） */
export type DungeonTier = 0 | 1 | 2 | 3 | 4 | 5

export const DUNGEON_TIER_LIST = [0, 1, 2, 3, 4, 5] as const

export const DUNGEON_TIER_META = [
  { tier: 0 as const, prefix: '', labelKey: 'dungeonTier.normal' },
  { tier: 1 as const, prefix: '魔性', labelKey: 'dungeonTier.majou' },
  { tier: 2 as const, prefix: '宿った', labelKey: 'dungeonTier.yadotta' },
  { tier: 3 as const, prefix: '伝説', labelKey: 'dungeonTier.densetsu' },
  { tier: 4 as const, prefix: '恐ろしい', labelKey: 'dungeonTier.osoroshii' },
  { tier: 5 as const, prefix: '壊れた', labelKey: 'dungeonTier.kowareta' },
] as const

/** ティアごとの敵ステータス倍率・Lv加算・EXP倍率 */
export const DUNGEON_TIER_SCALING = [
  {
    statScale: 1.0,
    levelBonus: 0,
    rewardScale: 1.0,
    hpScale: 1.0,
    defScale: 1.0,
    evasionScale: 1.0,
    magicDefScale: 1.0,
    physicalResistancePercent: 44.2,
    penetrationResistancePercent: 100.0,
    criticalResistancePercent: 50.0,
    magicResistancePercent: 42.5,
  },
  {
    statScale: 1.58,
    levelBonus: 1,
    rewardScale: 1.58,
    hpScale: 163177 / 65315,
    defScale: 3950 / 2500,
    evasionScale: 2844 / 1800,
    magicDefScale: 12640 / 8000,
    physicalResistancePercent: 38.0,
    penetrationResistancePercent: 100.0,
    criticalResistancePercent: 50.0,
    magicResistancePercent: 36.5,
  },
  {
    statScale: 2.10,
    levelBonus: 3,
    rewardScale: 2.10,
    hpScale: 288480 / 65315,
    defScale: 5250 / 2500,
    evasionScale: 3780 / 1800,
    magicDefScale: 16800 / 8000,
    physicalResistancePercent: 32.7,
    penetrationResistancePercent: 100.0,
    criticalResistancePercent: 50.0,
    magicResistancePercent: 34.8,
  },
  {
    statScale: 2.75,
    levelBonus: 6,
    rewardScale: 2.75,
    hpScale: 495759 / 65315,
    defScale: 6875 / 2500,
    evasionScale: 4950 / 1800,
    magicDefScale: 22000 / 8000,
    physicalResistancePercent: 28.3,
    penetrationResistancePercent: 100.0,
    criticalResistancePercent: 50.0,
    magicResistancePercent: 33.1,
  },
  {
    statScale: 3.50,
    levelBonus: 11,
    rewardScale: 3.50,
    hpScale: 805008 / 65315,
    defScale: 11550 / 2500,
    evasionScale: 8050 / 1800,
    magicDefScale: 29750 / 8000,
    physicalResistancePercent: 24.3,
    penetrationResistancePercent: 100.0,
    criticalResistancePercent: 50.0,
    magicResistancePercent: 31.4,
  },
  {
    statScale: 5.00,
    levelBonus: 24,
    rewardScale: 5.00,
    hpScale: 1657875 / 65315,
    defScale: 22500 / 2500,
    evasionScale: 14000 / 1800,
    magicDefScale: 45000 / 8000,
    physicalResistancePercent: 21.2,
    penetrationResistancePercent: 100.0,
    criticalResistancePercent: 50.0,
    magicResistancePercent: 29.7,
  },
] as const

const DUNGEON_TIER_AREA_LEVEL_FLAT_BONUS = [0, 2.8, 3.9, 5.25, 6.5, 10] as const

/** ティアを反映した実効エリアレベルを返す */
export function getDungeonTierAreaLevel(baseAreaLevel: number, tier: DungeonTier = 0): number {
  const scaling = DUNGEON_TIER_SCALING[tier] ?? DUNGEON_TIER_SCALING[0]
  const flatBonus = DUNGEON_TIER_AREA_LEVEL_FLAT_BONUS[tier] ?? 0
  return Math.max(1, Math.round(baseAreaLevel * scaling.statScale + flatBonus))
}

/** ティアに応じたダンジョン表示名を返す */
export function getDungeonTierDisplayName(baseName: string, tier: DungeonTier): string {
  const meta = DUNGEON_TIER_META[tier]
  if (!meta.prefix) return baseName
  return `${meta.prefix} ${baseName}`
}
