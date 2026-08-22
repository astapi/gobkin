import type { ExpeditionRequest } from "./Expedition"
import type { DungeonTier } from "./DungeonTier"
import type { CharacterSkill } from "./CharacterSkill"
import type { LearnedSpell } from "./Spell"
import type { BattleActionPolicy } from "./Battle"
import type { GoblinStats } from "./Goblin"
import type { EquipmentTitleId } from './EquipmentTitle'

export type PartyStatus = "idle" | "expedition"

export interface PartyRewardMultipliers {
  gold: number
  rare: number
  title: number
}

export const DEFAULT_PARTY_REWARD_MULTIPLIERS: PartyRewardMultipliers = {
  gold: 1.0,
  rare: 1.0,
  title: 1.0,
}

export interface AutoExpeditionRewardItemSummary {
  templateId: string
  titleId?: EquipmentTitleId
  count: number
}

export interface AutoExpeditionLevelUpSummary {
  goblinId: number
  oldLevel: number
  newLevel: number
}

export interface AutoExpeditionSessionSummary {
  sessionId: string
  runCount: number
  /** ダンジョンをクリアして帰還した回数（既存セーブでは未設定） */
  clearCount?: number
  /** 全滅して帰還した回数（既存セーブでは未設定） */
  wipeoutCount?: number
  /** 帰還条件により退却した回数（既存セーブでは未設定） */
  retreatCount?: number
  xpGained: number
  goldGained: number
  rewardItems: AutoExpeditionRewardItemSummary[]
  factorCount: number
  levelUps: AutoExpeditionLevelUpSummary[]
}

export function normalizePartyRewardMultipliers(
  multipliers?: Partial<PartyRewardMultipliers> | null
): PartyRewardMultipliers {
  const normalize = (value: number | undefined, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return fallback
    }
    return value
  }

  return {
    gold: normalize(multipliers?.gold, DEFAULT_PARTY_REWARD_MULTIPLIERS.gold),
    rare: normalize(multipliers?.rare, DEFAULT_PARTY_REWARD_MULTIPLIERS.rare),
    title: normalize(multipliers?.title, DEFAULT_PARTY_REWARD_MULTIPLIERS.title),
  }
}

export type Party = {
  id: number
  name: string
  memberIds: number[]
  status?: PartyStatus
  dungeonId?: string
  targetFloor?: number | null  // null = どこまでも進む
  returnPolicy?: ExpeditionRequest["returnPolicy"]
  dungeonTier?: DungeonTier
  rewardMultipliers?: PartyRewardMultipliers
  autoExpeditionEnabled?: boolean
  /** 現在の自動周回セッションID。OFF後は結果確認まで保持する。 */
  autoExpeditionSessionId?: string
  /** 最新の自動周回セッションで確定済みの累計結果 */
  autoExpeditionSummary?: AutoExpeditionSessionSummary
  /** @deprecated 旧8時間上限の互換読込用。新しい自動周回では使用しない。 */
  autoExpeditionDate?: string
  /** @deprecated 旧8時間上限の互換読込用。新しい自動周回では使用しない。 */
  autoExpeditionUsedSec?: number
}

export interface PartyState {
  id: string
  name: string
  race: string
  // HP管理
  currentHP: number   // 現在HP（戦闘でダメージを受けると減少）
  maxHP: number       // 最大HP
  // 基礎ステータス（GoblinStatCalculatorが因子を適用する）
  baseHP: number
  atk: number
  magicAtk: number
  def: number
  magicDef: number
  agility: number
  luck: number       // 運（基礎能力値、ドロップ判定の運乱数算出に使用）
  attackCount: number
  accuracy: number
  evasion: number
  magicHeal: number
  // 装備・スキル適用済みステータス。遠征中の戦闘再構築で装備補正を保持する。
  effectiveStats?: GoblinStats
  isKO: boolean
  isDead: boolean
  skills: CharacterSkill[]
  factors: string[]   // 因子ID配列（GoblinStatCalculatorでボーナス計算に使用）
  variantFactorId?: string  // 亜種の元となった因子ID
  spells?: LearnedSpell[]
  battleActionPolicy?: BattleActionPolicy
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
