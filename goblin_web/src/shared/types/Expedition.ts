import type { EnemySnap } from "./Enemy"
import type { CombatReplay } from "./Battle"
import type { Drop } from "./Item" // capturesで使用

export interface ExpeditionRequest {
  partyId: string
  areaId: string
  returnPolicy: "until_floor2" | "until_floor3" | "if_any_ko" | "if_two_ko" | "last_one" | "never"
  clientVersion: string
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
    floors: number
    baseDurationSec: number
    party: string[]
    returnPolicy: ExpeditionRequest["returnPolicy"]
    seed: number
    serverCommitHash?: string
  }
  durationSec: number
  events: TimelineEvent[]
  summary: RewardSummary
}

export type TimelineEvent =
  | { type: "move_start"; at: number; floor: number }
  | { type: "floor_up"; at: number; from: number; to: number }
  | { type: "battle"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number }
  | { type: "boss"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number }
  | { type: "exploring"; at: number; floor: number }
  | { type: "return"; at: number; reason: ExpeditionEndReason }

export interface ExpeditionRecord {
  id: string
  userId: string
  partyId: number
  partyName: string
  dungeonId: string
  dungeonName: string
  startTime: Date
  returnTime: Date
  status: 'ongoing' | 'completed' | 'failed'
  returnPolicy: ExpeditionRequest["returnPolicy"]
  replay?: ExpeditionReplay
  createdAt: Date
  updatedAt: Date
}

export interface RewardSummary {
  success: boolean
  maxFloorReached: number
  xpGained: number
  goldGained: number
  captures: Drop[]
  casualties: string[]
  injuries: string[]
}

export interface AreaConfig {
  id: string
  name: string
  areaLevel: number
  floors: number
  baseDurationSec: number
  moveSpeedScale?: number
  encounter: {
    perFloorEvents: number
    eventWeights: {
      battle: number
      exploring: number
      trap?: number
      npc?: number
    }
    pityTimerSec?: number
  }
  enemyTable?: Array<{ id: string; weight: number; lvl: number }>
  boss?: { id: string; lvl: number }
  rewards: {
    xpFloor: number[]
    xpBoss: number
    captureBonus: number
  }
  unlockNext?: string
}
