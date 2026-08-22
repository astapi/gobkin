import type { EnemySnap } from "./Enemy"
import type { CombatReplay } from "./Battle"
import type { EquipmentTitleId } from "./EquipmentTitle"
import type { Goblin } from "./Goblin"
import type { PartyRewardMultipliers } from "./Party"
import type { DungeonTier } from "./DungeonTier"

export interface ExpeditionRequest {
  partyId: string
  areaId: string
  tier?: DungeonTier
  targetFloor?: number | null
  returnPolicy: "if_any_ko" | "if_two_ko" | "last_one" | "never"
  clientVersion: string
  /** 自動周回結果をセッション単位で集計するためのID */
  autoExpeditionSessionId?: string
  /**
   * 実際の帰還・表示に使う時間。
   * デバッグ短縮時は 1 秒になることがある。
   */
  durationSec?: number
  /**
   * 戦闘・探索イベントの生成に使う時間。
   * durationSec と分けることで、デバッグ短縮時も通常時間相当のイベント密度を維持する。
   */
  simulationDurationSec?: number
}

/**
 * 遠征の終了理由（実行結果）
 * returnPolicyは事前設定、ExpeditionEndReasonは実際の終了理由
 */
export type ExpeditionEndReason =
  | "completed"      // ダンジョン踏破（ボスクリア）
  | "defeated"       // 全滅
  | "policy_return"  // リターンポリシーによる帰還
  | "abort"          // 緊急帰還（ユーザー操作）

export interface ExpeditionReplay {
  meta: {
    expeditionId: string
    areaId: string
    areaName: string
    areaLevel?: number
    effectiveAreaLevel?: number
    floors: number
    baseDurationSec: number
    party: string[]
    partySnapshot?: Goblin[]
    partyRewardMultipliers: PartyRewardMultipliers
    expeditionBoost?: ExpeditionBoost
    returnPolicy: ExpeditionRequest["returnPolicy"]
    tier?: DungeonTier
    seed: number
    serverCommitHash?: string
    autoExpeditionSessionId?: string
  }
  durationSec: number
  events: TimelineEvent[]
  summary: RewardSummary
}

export interface TreasureDrop {
  templateId: string  // EquipmentTemplate.id
  titleId?: EquipmentTitleId   // 称号ID（未設定 = 称号なし）
}

export type TimelineEvent =
  | { type: "move_start"; at: number; floor: number }
  | { type: "floor_up"; at: number; from: number; to: number }
  | { type: "floor_end"; at: number; floor: number }
  | { type: "battle"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number }
  | { type: "boss"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number }
  | { type: "exploring"; at: number; floor: number }
  | { type: "gold_treasure"; at: number; floor: number; gold: number }
  | { type: "treasure"; at: number; floor: number; items: TreasureDrop[] }
  | { type: "return"; at: number; reason: ExpeditionEndReason }

/**
 * 出撃時に消費する課金/補助アイテム（金のドングリ等）によるブースト設定。
 * 探索時間の短縮は ExpeditionRequest.durationSec 計算時点で適用するため、ここでは扱わない。
 *
 * - rareDropMultiplier: レアドロップ判定の倍率（1 で無効）
 * - expMultiplier: 戦闘で得られる経験値の倍率（1 で無効）
 * - goldMultiplier: 戦闘で得られる Gold の倍率（1 で無効）
 * - titleMultiplier: 装備に付与される称号の倍率（1 で無効）
 * - factorDropMultiplier: 遠征完了時の因子獲得率倍率（1 で無効）
 * - goldenAcornUsed: 金のドングリ専用の追加イベントを有効化する
 */
export interface ExpeditionBoost {
  rareDropMultiplier?: number
  expMultiplier?: number
  goldMultiplier?: number
  titleMultiplier?: number
  factorDropMultiplier?: number
  goldenAcornUsed?: boolean
}

/**
 * 遅延計算用メタデータ
 * 出撃時にシミュレーションを実行せず、このメタ情報を保存する。
 * プレイバック画面表示時または帰還時に、このデータから ExpeditionReplay を再計算する。
 */
export interface ExpeditionMeta {
  seed: number
  request: ExpeditionRequest
  departingGoblins: Goblin[]
  rewardMultipliers: PartyRewardMultipliers
  expeditionBoost?: ExpeditionBoost
}

export interface ExpeditionRecord {
  id: string
  userId: string
  partyId: number
  partyName: string
  dungeonId: string
  dungeonName: string
  startTime: Date
  returnTime: Date | null
  status: 'ongoing' | 'completed' | 'failed'
  returnPolicy: ExpeditionRequest["returnPolicy"]
  replay?: ExpeditionReplay
  expeditionMeta?: ExpeditionMeta
  createdAt: Date
  updatedAt: Date
}

export interface MemberLevelUp {
  goblinId: number
  oldLevel: number
  newLevel: number
}

export interface FactorAcquisition {
  goblinId: number
  factorIds: string[]
}

export interface RewardSummary {
  success: boolean
  maxFloorReached: number
  xpGained: number
  goldGained: number
  goldMultiplier?: number  // PT倍率×スキル補正の合成値（Goldログ表示用）
  casualties: string[]
  treasureDrops?: TreasureDrop[]  // 宝箱から獲得した装備
  memberLevelUps?: MemberLevelUp[]  // 遠征完了時に確定したレベルアップ情報
  factorAcquisitions?: FactorAcquisition[]  // 遠征完了時に獲得した因子情報
}

export interface AreaConfig {
  id: string
  name: string
  areaLevel: number
  floors: number
  baseDurationSec: number
  moveSpeedScale?: number
  encounter: {
    eventIntervalSec: number
    perFloorEvents?: number
    eventWeights: {
      battle: number
      exploring: number
      goldTreasure?: number
      trap?: number
      npc?: number
    }
    pityTimerSec?: number
  }
  enemyTable?: Array<{ id: string; weight: number; lvl: number }>
  boss?: { id: string; lvl: number }
  unlockNext?: string
}
