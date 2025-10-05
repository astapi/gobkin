export type GoblinStats = {
  hp: number
  atk: number
  sp: number
  spd: number
  def: number
}

export type Goblin = {
  id: number
  name: string
  race: string
  level: number
  avatar: string
  stats: GoblinStats
}

export type Dungeon = {
  id: number
  name: string
  floors: number
  exploration_time_sec_first: number
  exploration_time_sec: number
  description: string
  cleared?: boolean
  icon?: string
  difficulty?: string
}

export type PartyStatus = "idle" | "expedition"

export type Party = {
  id: number
  name: string
  memberIds: number[]
  status?: PartyStatus
  dungeonId?: number
  targetFloor?: number
  returnPolicy?: ExpeditionRequest["returnPolicy"]
}

// 遠征システム関連の型定義

export interface ExpeditionRequest {
  partyId: string
  areaId: string
  returnPolicy: "until_floor2" | "until_floor3" | "if_any_ko" | "last_one" | "never"
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
  | { type: "trap"; at: number; floor: number; trapId: string; effect: Record<string, unknown> }
  | { type: "return"; at: number; reason: "until_floorN"|"if_any_ko"|"last_one"|"boss_clear"|"abort"|"lose" }

export interface EnemySnap {
  id: string
  name: string
  lvl: number
  count: number
}

export interface Drop {
  id: string
  qty: number
}

export interface BattleLogEntry {
  turn: number
  actorId: string
  actorName: string
  action: string
  targetId?: string
  targetName?: string
  damage?: number
  healing?: number
  isAlly: boolean
  targetDefeated?: boolean
  actorHP?: number
  targetHP?: number
  turnState?: {
    allies: Array<{ id: string; name: string; currentHP: number; maxHP: number }>
    enemies: Array<{ id: string; name: string; currentHP: number; maxHP: number }>
  }
}

export interface CombatReplay {
  rounds: number
  outcome: "win" | "lose" | "escape"
  allyHPDelta: number[]
  enemyDefeated: number
  detailedLog?: BattleLogEntry[] // 戦闘の詳細ログ
  capture?: {
    eligible: boolean
    success?: boolean
    rate?: number
    captured?: Drop
  }
}

export interface ExpeditionRecord {
  id: string
  userId: string
  partyId: number
  partyName: string
  dungeonId: number
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
  encounter: {
    perFloorEvents: number
    eventWeights: {
      battle: number
      resource: number
      trap: number
      npc: number
    }
  }
  rewards: {
    xpFloor: number[]
    xpBoss: number
    lootPool: { id: string; w: number }[]
    captureBonus: number
  }
  unlockNext?: string
}

export interface PartySnapshot {
  members: string[]
  returnPolicy: ExpeditionRequest["returnPolicy"]
  foodSupply: number
  speedMod: number
  luckMod: number
  captureSlots: number
  carryWeight: number
  powerRating: number
}

// 敵関連の型定義
export interface Enemy {
  id: string
  name: string
  raceTags: string[]
  level: number
  hp: number
  atk: number
  def: number
  spd: number
  sp: number
  exp: number
  gold: number
}

export interface EnemyPattern {
  id: string
  floors: number[]
  enemies: string[]
  isBoss?: boolean
}

export interface EnemyDatabase {
  enemies: Enemy[]
  patterns: EnemyPattern[]
}