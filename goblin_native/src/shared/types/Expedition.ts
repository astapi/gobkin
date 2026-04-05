import type { EnemySnap } from "./Enemy"
import type { CombatReplay } from "./Battle"
import type { EquipmentTitleId } from "./EquipmentTitle"
import type { Goblin } from "./Goblin"

export interface ExpeditionRequest {
  partyId: string
  areaId: string
  returnPolicy: "until_floor2" | "until_floor3" | "if_any_ko" | "if_two_ko" | "last_one" | "never"
  clientVersion: string
  durationSec?: number
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
    partySnapshot?: Goblin[]
    returnPolicy: ExpeditionRequest["returnPolicy"]
    seed: number
    serverCommitHash?: string
  }
  durationSec: number
  events: TimelineEvent[]
  summary: RewardSummary
}

export interface TreasureDrop {
  templateId: string  // EquipmentTemplate.id
  name: string        // 表示用の装備名（称号付き）
  titleId?: EquipmentTitleId   // 称号ID（未設定 = 称号なし）
  titleName?: string           // 称号の表示名（例: "伝説の"）
}

export type TimelineEvent =
  | { type: "move_start"; at: number; floor: number }
  | { type: "floor_up"; at: number; from: number; to: number }
  | { type: "battle"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number }
  | { type: "boss"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number }
  | { type: "exploring"; at: number; floor: number }
  | { type: "treasure"; at: number; floor: number; items: TreasureDrop[] }
  | { type: "return"; at: number; reason: ExpeditionEndReason }

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
  createdAt: Date
  updatedAt: Date
}

export interface RewardSummary {
  success: boolean
  maxFloorReached: number
  xpGained: number
  goldGained: number
  casualties: string[]
  treasureDrops?: TreasureDrop[]  // 宝箱から獲得した装備
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
    xpBoss?: number
  }
  dropChance?: number  // 戦闘勝利ごとの宝箱出現確率 (0.0〜1.0)、areaLevelに応じた装備がドロップ
  unlockNext?: string
}
