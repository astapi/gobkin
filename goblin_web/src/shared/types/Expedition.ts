import type { EnemySnap } from "./Enemy"
import type { CombatReplay } from "./Battle"
import type { Drop } from "./Item"

export interface ExpeditionRequest {
  partyId: string
  areaId: string
  returnPolicy: "until_floor2" | "until_floor3" | "if_any_ko" | "if_two_ko" | "last_one" | "never"
  clientVersion: string
}

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
  | { type: "battle"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number; drops: Drop[] }
  | { type: "boss"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number; drops: Drop[] }
  | { type: "resource"; at: number; floor: number; loot: Drop[] }
  | { type: "exploring"; at: number; floor: number }
  | { type: "return"; at: number; reason: ExpeditionRequest["returnPolicy"] }

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
  loot: Drop[]
  captures: Drop[]
  casualties: string[]
  injuries: string[]
}

export interface AreaConfig {
  id: string
  name: string
  floors: number
  baseDurationSec: number
  moveSpeedScale?: number
  encounter: {
    perFloorEvents: number
    eventWeights: {
      battle: number
      resource: number
      trap: number
      npc: number
    }
    pityTimerSec?: number
  }
  enemyTable?: Array<{ id: string; weight: number; lvl: number }>
  boss?: { id: string; lvl: number }
  rewards: {
    xpFloor: number[]
    xpBoss: number
    lootPool: { id: string; w: number }[]
    captureBonus: number
  }
  unlockNext?: string
}
