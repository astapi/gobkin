/**
 * 拠点の状態を表す型
 */
export type BaseState = {
  capacity: number                 // 収容可能なゴブリン数（互換性のため残す、currentMaxGoblinsと同じ）
  rank: number                     // 現在の拠点ランク（1-7）
  nextGoblinId?: number            // 次のゴブリンID
  capturedDungeons: string[]       // 制圧済みダンジョンIDのリスト
  currentMaxParties: number        // 現在の最大パーティ数
  currentMaxGoblins: number        // 現在の最大ゴブリン数
  gold: number                     // 所持ゴールド
}

/**
 * 拠点ランク設定
 */
export interface BaseRankConfig {
  rank: number                     // ランク（1-7）
  maxParties: number               // 編成可能なパーティ数
  maxGoblins: number               // 収容可能なゴブリン数
  upgradeCost: number              // ランクアップに必要なゴールド
  unlockCondition: {
    dungeonId: string              // 制圧する必要のあるダンジョンID
    clearCount?: number            // 必要なクリア回数（デフォルト1）
  }
}

/**
 * ランクアップ可否チェック結果
 */
export interface RankUpCheckResult {
  canRankUp: boolean
  requirement?: string
  nextRank?: number
}
