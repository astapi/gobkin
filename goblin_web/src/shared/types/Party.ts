import type { ExpeditionRequest } from "./Expedition"
import type { ModInstance } from "./Mod"

export type PartyStatus = "idle" | "expedition"

export type Party = {
  id: number
  name: string
  memberIds: number[]
  status?: PartyStatus
  dungeonId?: string
  targetFloor?: number | null  // null = どこまでも進む
  returnPolicy?: ExpeditionRequest["returnPolicy"]
}

export interface PartyState {
  id: string
  name: string
  currentHP: number
  maxHP: number
  atk: number
  def: number
  spd: number
  sp: number
  isKO: boolean
  isDead: boolean
  mods: ModInstance[]
  level: number
  avatar: string
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
