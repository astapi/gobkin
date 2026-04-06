import type { ExpeditionRequest } from "./Expedition"
import type { CharacterSkill } from "./CharacterSkill"
import type { ModInstance } from "./Mod"
import type { LearnedSpell } from "./Spell"

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
  race: string
  // HP管理
  currentHP: number   // 現在HP（Mod適用後、戦闘でダメージを受けると減少）
  maxHP: number       // 最大HP（Mod適用後、参照用）
  // 基礎ステータス（ModStatCalculatorが因子・Modを適用する）
  baseHP: number
  atk: number
  def: number
  spd: number
  sp: number
  attackCount: number
  accuracy: number
  evasion: number
  isKO: boolean
  isDead: boolean
  mods: ModInstance[]
  skills: CharacterSkill[]
  factors: string[]   // 因子ID配列（ModStatCalculatorでボーナス計算に使用）
  variantFactorId?: string  // 亜種の元となった因子ID（追加効果適用に使用）
  spells?: LearnedSpell[]
  level: number
  avatar: string
}

export interface PartySnapshot {
  members: string[]
  returnPolicy: ExpeditionRequest["returnPolicy"]
  foodSupply: number
  speedMod: number
  luckMod: number
  carryWeight: number
  powerRating: number
}
