import type { BattleActionPolicy, BattleLogEntry, CharacterSkill } from '../../../shared/types'
import type { SpellDef } from '../../../shared/types/Spell'
import type { Combatant } from '../DamageCalculator'

export type SpellCategory = 'cleric' | 'mage'

export interface SpellCharge {
  spellId: string
  remaining: number   // 残りチャージ
  maxCharges: number  // 最大チャージ
  category: SpellCategory
}

export interface BattleUnit {
  instanceId?: string
  combatant: Combatant
  logName?: string
  currentHP: number
  maxHP: number
  initialHP: number
  power?: number
  agility: number
  luck: number
  attackCount: number
  accuracy: number
  evasion: number
  isAlly: boolean
  originalIndex: number
  damageReduction: number  // 汎用の被ダメージ軽減率（0〜100）
  physicalDamageReduction: number  // 物理ダメージ軽減率（0〜100）
  rangedAttackDamageReduction: number // 遠距離通常攻撃ダメージ軽減率（0〜100）
  magicDamageReduction: number  // 魔法ダメージ軽減率（0〜100）
  breathDamageReduction: number // ブレスダメージ軽減率（0〜100）
  shieldBarrierDamageReduction: number // シールドバリアの攻撃ダメージ軽減率（0〜100）
  shieldBarrierBreathDamageReduction: number // シールドバリアのブレスダメージ軽減率（0〜100）
  magicBarrierDamageReduction: number // マジックバリアの魔法ダメージ軽減率（0〜100）
  physicalDamageDealtMultiplier: number // 物理与ダメージ倍率
  physicalDamagePercent: number   // 物理威力の増減（%）
  magicAtk: number              // 魔法攻撃力
  magicHeal: number             // 魔法回復量
  criticalRate: number          // 必殺率（%）
  criticalDamageBonusPercent: number // 会心威力上昇（%）
  spellDamagePercent: number    // 魔法威力の増減（%）
  magicFieldDamageMultiplier: number // PT効果による魔法与ダメージ倍率
  shieldBarrierActive?: boolean  // シールドバリア状態
  magicBarrierActive?: boolean   // マジックバリア状態
  row: number              // 隊列の列番号（0-based）
  rowSlot: number          // 列内のスロット番号（0-based）
  level: number            // 呪文のターゲット数計算用
  spellCharges: SpellCharge[]  // 戦闘中の呪文チャージ状態
  skills: CharacterSkill[]
  battleActionPolicy: BattleActionPolicy
  isDefending: boolean
  attackType: 'melee' | 'range'
}

export interface BattleResult {
  rounds: number
  outcome: 'win' | 'lose' | 'retreat'
  allyHPDelta: number[]
  enemyDefeated: number
  detailedLog: BattleLogEntry[]
}

export interface UsableSpellCharge {
  charge: SpellCharge
  def: SpellDef
}
