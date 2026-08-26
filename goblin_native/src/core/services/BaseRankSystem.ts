import type { BaseRankConfig, BaseState, RankUpCheckResult } from '../../shared/types/BaseState'

/**
 * 拠点ランク設定
 */
export const BASE_RANK_CONFIGS: BaseRankConfig[] = [
  {
    rank: 1,
    maxParties: 1,
    maxGoblins: 10,
    upgradeCost: 0,  // 初期ランク
    unlockCondition: { dungeonId: 'initial' },
  },
  {
    rank: 2,
    maxParties: 2,
    maxGoblins: 20,
    upgradeCost: 100,  // ランク2への引っ越し資金
    unlockCondition: {
      dungeonId: 'goblin_village_1',  // ゴブリン集落
      clearCount: 1,
    },
  },
  {
    rank: 3,
    maxParties: 3,
    maxGoblins: 35,
    upgradeCost: 500,  // ランク3への引っ越し資金
    unlockCondition: {
      dungeonId: 'human_village',  // 辺境の村
      clearCount: 1,
    },
  },
  {
    rank: 4,
    maxParties: 4,
    maxGoblins: 50,
    upgradeCost: 1500,
    unlockCondition: {
      dungeonId: 'orc_fortress_1',
      clearCount: 1,
    },
  },
  {
    rank: 5,
    maxParties: 5,
    maxGoblins: 70,
    upgradeCost: 4000,
    unlockCondition: {
      dungeonId: 'human_fortress_1',
      clearCount: 1,
    },
  },
  {
    rank: 6,
    maxParties: 6,
    maxGoblins: 100,
    upgradeCost: 10000,
    unlockCondition: {
      dungeonId: 'vampire_castle_1',
      clearCount: 1,
    },
  },
  {
    rank: 7,
    maxParties: 8,
    maxGoblins: 150,
    upgradeCost: 25000,
    unlockCondition: {
      dungeonId: 'royal_capital_3',
      clearCount: 1,
    },
  },
]

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
    gold: 500,  // 初期ゴールド（テスト用に少し多めに設定）
  }
}
