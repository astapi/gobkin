import i18n from '../../../shared/i18n'
import { RECOVERY_MAGIC_SPELL_TABLE } from '../../../shared/data/recoveryMagic'
import type { DamageOptions, Skill } from '../DamageCalculator'

export const BASIC_ATTACK_SKILL: Skill = {
  id: 'basic_attack',
  name: i18n.t('battle.normalAttack'),
  power: 1.0,
}

export const DEFAULT_DAMAGE_OPTIONS: DamageOptions = {
  defConstant: 100,
  randomMin: 0.6,
  randomMax: 1.05,
}

export const SPELL_DAMAGE_OPTIONS: DamageOptions = {
  ...DEFAULT_DAMAGE_OPTIONS,
  isMagic: true,
}

export const CLERIC_MAGIC_SPELL_IDS = new Set(RECOVERY_MAGIC_SPELL_TABLE.map(entry => entry.spellId))
export const ATTACK_UP_PHYSICAL_DAMAGE_MULTIPLIER = 1.6
export const TWO_COLUMN_ATTACK_DAMAGE_MULTIPLIER = 0.5
export const HEALTHY_HP_RATIO_THRESHOLD = 0.8
export const LOW_HP_RATIO_THRESHOLD = 0.79
export const CLERIC_BARRIER_SPELL_PRIORITY = ['shield_barrier', 'magic_barrier'] as const
export const CLERIC_SINGLE_HEAL_SPELL_PRIORITY = ['full_heal', 'heal_plus', 'heal'] as const
export const PARTY_HEAL_SPELL_ID = 'party_heal'
/** 反撃が反撃を呼ぶ相互再帰の深さ上限（スタックオーバーフロー防止） */
export const MAX_COUNTER_ATTACK_DEPTH = 10
