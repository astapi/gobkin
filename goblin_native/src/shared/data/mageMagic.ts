/**
 * 魔法使い魔法スキルのスペル習得テーブル
 *
 * mageMagicLevel (スキルLv) はそのキャラクターが習得可能なスペルの上限を決める。
 * 各スペルは requiredCharacterLevel に達した時点で習得される。
 */

export interface MageMagicSpellEntry {
  /** 魔法使い魔法スキルのレベル（1〜7） */
  spellTier: number
  /** 習得に必要なキャラクターレベル */
  requiredCharacterLevel: number
  /** 習得するスペルID */
  spellId: string
}

export const MAGE_MAGIC_SPELL_TABLE: readonly MageMagicSpellEntry[] = [
  { spellTier: 1, requiredCharacterLevel: 1, spellId: 'magic_arrow' },
  { spellTier: 2, requiredCharacterLevel: 4, spellId: 'sleep_mist' },
  { spellTier: 3, requiredCharacterLevel: 7, spellId: 'fireball' },
  { spellTier: 4, requiredCharacterLevel: 10, spellId: 'blizzard' },
  { spellTier: 5, requiredCharacterLevel: 13, spellId: 'attack_up' },
] as const

/**
 * 指定した魔法使い魔法レベルとキャラクターレベルに基づき、習得可能なスペルIDリストを返す
 */
export function getMageMagicSpellIds(
  mageMagicLevel: number,
  characterLevel: number,
): string[] {
  return MAGE_MAGIC_SPELL_TABLE
    .filter(entry => entry.spellTier <= mageMagicLevel && characterLevel >= entry.requiredCharacterLevel)
    .map(entry => entry.spellId)
}
