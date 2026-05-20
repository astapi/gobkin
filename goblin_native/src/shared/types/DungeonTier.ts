/** ダンジョンティア（難易度バリエーション） */
export type DungeonTier = 0 | 1 | 2 | 3 | 4 | 5

export const DUNGEON_TIER_LIST = [0, 1, 2, 3, 4, 5] as const
export const DUNGEON_TIER_SELECTABLE_MAX = 3 as const

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
  },
  {
    statScale: 1.58,
    levelBonus: 1,
    rewardScale: 1.58,
    hpScale: 636 / 205,
    hpCurve: [
      { base: 10, scale: 49 / 10 },
      { base: 98, scale: 369 / 98 },
      { base: 205, scale: 636 / 205 },
    ],
    defScale: 3950 / 2500,
    evasionScale: 1.58,
    magicDefScale: 1.58,
  },
  {
    statScale: 2.10,
    levelBonus: 3,
    rewardScale: 2.10,
    hpScale: 1345 / 205,
    hpCurve: [
      { base: 98, scale: 864 / 98 },
      { base: 205, scale: 1345 / 205 },
    ],
    defScale: 5250 / 2500,
    evasionScale: 2.10,
    magicDefScale: 2.10,
  },
  {
    statScale: 2.75,
    levelBonus: 6,
    rewardScale: 2.75,
    hpScale: 1482 / 98,
    defScale: 6875 / 2500,
    evasionScale: 2.75,
    magicDefScale: 2.75,
  },
  {
    statScale: 3.50,
    levelBonus: 11,
    rewardScale: 3.50,
    hpScale: 24.5,
    defScale: 7.0,
    evasionScale: 7.0,
    magicDefScale: 7.0,
  },
  {
    statScale: 5.00,
    levelBonus: 24,
    rewardScale: 5.00,
    hpScale: 50.0,
    defScale: 10.0,
    evasionScale: 10.0,
    magicDefScale: 10.0,
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

/** 探索時間 tier 係数: time(tier) = base + delta × DUNGEON_TIER_TIME_FACTOR[tier] */
export const DUNGEON_TIER_TIME_FACTOR = [0, 1, 8 / 3, 5, 10, 20] as const

/**
 * Tier ごとのボス因子ドロップ実効確率（敵JSONの `probability` は基準値 0.015 を想定し、
 * 実行時に `tierRate / baseRate` の倍率として `probabilityMultiplier` に合成する）
 *
 * - 0 通常: 1.5%
 * - 1 魔性: 2.5%
 * - 2 宿った: 3.5%
 * - 3 伝説: 4.5%
 * - 4 恐ろしい: 5.5%
 * - 5 壊れた: 6.5%（+1% の等差を延長）
 */
export const DUNGEON_TIER_FACTOR_DROP_RATE = [
  0.015,
  0.025,
  0.035,
  0.045,
  0.055,
  0.065,
] as const

const BASE_FACTOR_DROP_RATE = DUNGEON_TIER_FACTOR_DROP_RATE[0]

/** Tier に応じた因子ドロップ倍率（敵JSON の基準 1.5% に乗算する係数）を返す */
export function getDungeonTierFactorDropMultiplier(tier: DungeonTier = 0, minTier: DungeonTier = 0): number {
  if (tier < minTier) {
    return 0
  }

  const rate =
    minTier === 0
      ? DUNGEON_TIER_FACTOR_DROP_RATE[tier] ?? BASE_FACTOR_DROP_RATE
      : BASE_FACTOR_DROP_RATE + (tier - minTier) * 0.01

  return rate / BASE_FACTOR_DROP_RATE
}

/**
 * 称号抽選の判定回数（Tier 別）
 *
 * - 付与判定で「あり」となった場合のみ、この回数だけ称号テーブルを抽選し、
 *   その中で rank が最も高い称号を採用する
 * - Tier が高いほど高位称号の出現確率が上がる
 */
export const DUNGEON_TIER_TITLE_ROLL_COUNTS = [1, 2, 4, 7, 12, 25] as const

/** Tier に応じた称号抽選の判定回数を返す */
export function getDungeonTierTitleRollCount(tier: DungeonTier = 0): number {
  return DUNGEON_TIER_TITLE_ROLL_COUNTS[tier] ?? DUNGEON_TIER_TITLE_ROLL_COUNTS[0]
}

/** ダンジョン探索時間クラス */
export type DungeonTierClass = 'A' | 'B' | 'C'

/** クラスごとの tier delta（増分単位、秒）: first=踏破前, cleared=踏破後 */
export const DUNGEON_TIER_TIME_DELTA: Record<DungeonTierClass, { first: number; cleared: number }> = {
  A: { first: 540, cleared: 270 },
  B: { first: 2160, cleared: 675 },
  C: { first: 2160, cleared: 630 },
}

const DUNGEON_TIER_CLASS_MAP: Record<string, DungeonTierClass> = {
  // Class A: スライムの洞窟, 周辺の森, ゴブリン集落, 廃墟
  slime_cave: 'A',
  forest_outskirts: 'A',
  goblin_village_1: 'A',
  goblin_village_2: 'A',
  goblin_village_3: 'A',
  undead_ruins_1: 'A',
  undead_ruins_2: 'A',
  undead_ruins_3: 'A',
  // Class C: 街道, 辺境の村, オークの野営地, ウルフ草原, リザードマンの沼砦, オークの砦, vs討伐軍
  road_1: 'C',
  human_village: 'C',
  orc_camp_1: 'C',
  orc_camp_2: 'C',
  orc_camp_3: 'C',
  wolf_grassland_1: 'C',
  lizardman_swamp_1: 'C',
  lizardman_swamp_2: 'C',
  lizardman_swamp_3: 'C',
  orc_fortress_1: 'C',
  subjugation_force_1: 'C',
  subjugation_force_2: 'C',
  subjugation_force_3: 'C',
}

/** ダンジョン ID から探索時間クラスを取得（未指定は B） */
export function getDungeonTierClass(dungeonId: string): DungeonTierClass {
  return DUNGEON_TIER_CLASS_MAP[dungeonId] ?? 'B'
}

/** ダンジョンと tier からその tier の探索時間を算出 */
export function computeDungeonExplorationTime(
  dungeonId: string,
  baseFirst: number,
  baseCleared: number,
  tier: DungeonTier,
  isTierCleared: boolean,
): number {
  const cls = getDungeonTierClass(dungeonId)
  const delta = DUNGEON_TIER_TIME_DELTA[cls]
  const factor = DUNGEON_TIER_TIME_FACTOR[tier] ?? 0
  const base = isTierCleared ? baseCleared : baseFirst
  const deltaPerUnit = isTierCleared ? delta.cleared : delta.first
  return Math.round(base + deltaPerUnit * factor)
}
