import type { BaseRankConfig, BaseState, RankUpCheckResult } from '../../shared/types/BaseState'

/**
 * 拠点ランク設定
 */
export const BASE_RANK_CONFIGS: BaseRankConfig[] = [
  {
    rank: 1,
    maxParties: 1,
    maxGoblins: 10,
    ivBonus: 0,
    upgradeCost: 0,  // 初期ランク
    unlockCondition: { dungeonId: 'initial' },
  },
  {
    rank: 2,
    maxParties: 2,
    maxGoblins: 20,
    ivBonus: 2,
    upgradeCost: 100,  // ランク2への引っ越し資金
    unlockCondition: {
      dungeonId: 'goblin_village_3',  // ゴブリン集落・中枢
      clearCount: 1,
    },
  },
  {
    rank: 3,
    maxParties: 3,
    maxGoblins: 35,
    ivBonus: 4,
    upgradeCost: 500,  // ランク3への引っ越し資金
    unlockCondition: {
      dungeonId: 'orc_camp_3',  // オークの野営地・本陣
      clearCount: 1,
    },
  },
  {
    rank: 4,
    maxParties: 4,
    maxGoblins: 50,
    ivBonus: 6,
    upgradeCost: 1500,
    unlockCondition: {
      dungeonId: 'subjugation_force_3',
      clearCount: 1,
    },
  },
  {
    rank: 5,
    maxParties: 5,
    maxGoblins: 70,
    ivBonus: 8,
    upgradeCost: 4000,
    unlockCondition: {
      dungeonId: 'dwarf_mine_3',
      clearCount: 1,
    },
  },
  {
    rank: 6,
    maxParties: 6,
    maxGoblins: 100,
    ivBonus: 10,
    upgradeCost: 10000,
    unlockCondition: {
      dungeonId: 'human_fortress_3',
      clearCount: 1,
    },
  },
  {
    rank: 7,
    maxParties: 8,
    maxGoblins: 150,
    ivBonus: 12,
    upgradeCost: 25000,
    unlockCondition: {
      dungeonId: 'royal_capital_3',
      clearCount: 1,
    },
  },
]

/**
 * エリアレベルごとのベース個体値範囲
 */
export const AREA_LEVEL_IV_RANGES: Record<number, [number, number]> = {
  1: [1, 8],      // 序盤（スライムの洞窟、周辺の森）
  2: [6, 14],     // 初期中盤（ゴブリン集落、忘れられた廃墟）
  3: [12, 20],    // 中盤（オークの野営地、vs討伐隊防衛戦）
  4: [18, 28],    // 中盤後期（辺境の村）
  5: [26, 36],    // 上級（ドワーフ坑道、エルフの隠れ里）
  6: [34, 44],    // 終盤（リザードマンの沼砦、トロルの峡谷）
  7: [42, 52],    // 最終盤（人間の城塞）
  8: [50, 60],    // 最終決戦（王都決戦）
}

function getAreaLevelIvRange(areaLevel: number): [number, number] {
  const range = AREA_LEVEL_IV_RANGES[areaLevel]
  if (range) return range
  if (areaLevel > 8) return AREA_LEVEL_IV_RANGES[8]
  return AREA_LEVEL_IV_RANGES[1]
}

/**
 * 拠点ランクボーナス
 */
export const BASE_RANK_BONUS: Record<number, number> = {
  1: 0,
  2: 2,
  3: 4,
  4: 6,
  5: 8,
  6: 10,
  7: 12,
}

/**
 * 個体値を計算する
 * @param areaLevel ダンジョンのエリアレベル（1-8）
 * @param baseRank 拠点ランク（1-7）
 * @param random 乱数生成関数（0-1）
 * @returns 最終個体値（1-64）
 */
export function calculateIndividualValue(
  areaLevel: number,
  baseRank: number,
  random: () => number
): number {
  // エリアレベルのベース範囲を取得
  const [min, max] = getAreaLevelIvRange(areaLevel)
  const baseIV = Math.floor(min + (max - min) * random())

  // 拠点ランクボーナスを加算
  const bonus = BASE_RANK_BONUS[baseRank] || 0
  const finalIV = baseIV + bonus

  // 1-64にクランプ
  return Math.max(1, Math.min(64, finalIV))
}

/**
 * ランクアップ可能かチェックする
 * @param baseState 拠点状態
 * @returns ランクアップ可否チェック結果
 */
export function checkRankUpAvailable(baseState: BaseState): RankUpCheckResult {
  const nextConfig = BASE_RANK_CONFIGS.find((c) => c.rank === baseState.rank + 1)
  if (!nextConfig) {
    return { canRankUp: false }
  }

  const hasCaptured = baseState.capturedDungeons.includes(
    nextConfig.unlockCondition.dungeonId
  )

  if (!hasCaptured) {
    return {
      canRankUp: false,
      requirement: `${nextConfig.unlockCondition.dungeonId}を制圧する必要があります`,
      nextRank: nextConfig.rank,
    }
  }

  return { canRankUp: true, nextRank: nextConfig.rank }
}

/**
 * ダンジョン制圧を記録する（ランクアップは行わない）
 * @param dungeonId 制圧したダンジョンID
 * @param baseState 現在の拠点状態
 * @returns 更新後の拠点状態
 */
export function captureDungeon(
  dungeonId: string,
  baseState: BaseState
): BaseState {
  // 制圧済みリストに追加
  const capturedDungeons = baseState.capturedDungeons.includes(dungeonId)
    ? baseState.capturedDungeons
    : [...baseState.capturedDungeons, dungeonId]

  return {
    ...baseState,
    capturedDungeons,
  }
}

/**
 * ランクアップを実行する（ゴールドを消費）
 * @param baseState 現在の拠点状態
 * @returns 更新後の拠点状態、またはエラー
 */
export function performRankUp(
  baseState: BaseState
): { success: true; state: BaseState } | { success: false; error: string } {
  const { canRankUp, nextRank, requirement } = checkRankUpAvailable(baseState)

  if (!canRankUp) {
    return {
      success: false,
      error: requirement || 'ランクアップできません',
    }
  }

  if (!nextRank) {
    return {
      success: false,
      error: '次のランクが見つかりません',
    }
  }

  const nextConfig = BASE_RANK_CONFIGS.find((c) => c.rank === nextRank)
  if (!nextConfig) {
    return {
      success: false,
      error: 'ランク設定が見つかりません',
    }
  }

  // ゴールドが足りるかチェック
  if (baseState.gold < nextConfig.upgradeCost) {
    return {
      success: false,
      error: `ゴールドが不足しています（必要: ${nextConfig.upgradeCost}G、所持: ${baseState.gold}G）`,
    }
  }

  // ランクアップを実行
  const updatedState: BaseState = {
    ...baseState,
    rank: nextRank,
    currentMaxParties: nextConfig.maxParties,
    currentMaxGoblins: nextConfig.maxGoblins,
    currentIVBonus: nextConfig.ivBonus,
    capacity: nextConfig.maxGoblins,
    gold: baseState.gold - nextConfig.upgradeCost,
  }

  return {
    success: true,
    state: updatedState,
  }
}

/**
 * 初期の拠点状態を生成する
 * @returns 初期拠点状態
 */
export function createInitialBaseState(): BaseState {
  const initialConfig = BASE_RANK_CONFIGS[0]
  return {
    rank: initialConfig.rank,
    capacity: initialConfig.maxGoblins,
    nextGoblinId: 1,
    capturedDungeons: [],
    currentMaxParties: initialConfig.maxParties,
    currentMaxGoblins: initialConfig.maxGoblins,
    currentIVBonus: initialConfig.ivBonus,
    gold: 500,  // 初期ゴールド（テスト用に少し多めに設定）
  }
}
