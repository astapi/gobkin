/**
 * 回復魔法スキルのスペル習得テーブル
 *
 * recoveryMagicLevel (スキルLv) はそのキャラクターが習得可能なスペルの上限を決める。
 * 各スペルは requiredCharacterLevel に達した時点で習得される。
 */

export interface RecoveryMagicSpellEntry {
  /** 回復魔法スキルのレベル（1〜7） */
  spellTier: number
  /** 習得に必要なキャラクターレベル */
  requiredCharacterLevel: number
  /** 習得するスペルID */
  spellId: string
}

/**
 * 回復魔法のスペル習得テーブル
 * spellTier が recoveryMagicLevel 以下、かつキャラクターレベルが requiredCharacterLevel 以上のスペルを習得する
 */
export const RECOVERY_MAGIC_SPELL_TABLE: readonly RecoveryMagicSpellEntry[] = [
  { spellTier: 1, requiredCharacterLevel: 1, spellId: 'heal' },
  { spellTier: 2, requiredCharacterLevel: 4, spellId: 'shield_barrier' },
  { spellTier: 3, requiredCharacterLevel: 7, spellId: 'cure' },
  { spellTier: 4, requiredCharacterLevel: 10, spellId: 'heal_plus' },
  { spellTier: 5, requiredCharacterLevel: 13, spellId: 'magic_barrier' },
  { spellTier: 6, requiredCharacterLevel: 16, spellId: 'full_heal' },
  { spellTier: 7, requiredCharacterLevel: 19, spellId: 'party_heal' },
] as const

/**
 * 指定した回復魔法レベルとキャラクターレベルに基づき、習得可能なスペルIDリストを返す
 */
export function getRecoveryMagicSpellIds(
  recoveryMagicLevel: number,
  characterLevel: number,
): string[] {
  return RECOVERY_MAGIC_SPELL_TABLE
    .filter(entry => entry.spellTier <= recoveryMagicLevel && characterLevel >= entry.requiredCharacterLevel)
    .map(entry => entry.spellId)
}
