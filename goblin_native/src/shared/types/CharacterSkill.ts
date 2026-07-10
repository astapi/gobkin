import type { EquipmentCategory, EquipmentStat, WeaponSubCategory } from './Equipment'
import type { GoblinBaseAttributes, GoblinStats } from './Goblin'

export type RaceBuckets = {
  add?: Partial<Record<string, number>>
  mult?: Partial<Record<string, number>>
}

export type MagicDamageFollowUp = {
  attackCountMultiplier: number
  criticalRateMultiplier: number
}

export type PhysicalCounterAttack = {
  attackCountMultiplier: number
  criticalRateMultiplier: number
}

export type TurnStartAoeMagic = {
  /** 発動ターン(1始まり)。everyTurn 指定時は不要 */
  turn?: number
  /** 毎ターン発動する場合 true */
  everyTurn?: boolean
  /** 魔法攻撃力に対するダメージ倍率(%) */
  powerPercent: number
}

export interface CharacterSkill {
  id: string
  descriptionKey?: string
  baseAttributeBonuses?: Partial<Record<keyof GoblinBaseAttributes, number>>
  statBonuses?: Partial<Record<keyof GoblinStats, number>>
  statMultipliers?: Partial<Record<keyof GoblinStats, number>>
  baseStatMultipliers?: Partial<Record<keyof GoblinStats, number>>
  defToHpPercent?: number
  magicHealToHpPercent?: number
  criticalRateBonusPercent?: number
  criticalDamageBonusPercent?: number
  actionOrderMultiplier?: number
  equipmentCategoryMultiplier?: Partial<Record<EquipmentCategory, number>>
  weaponSubCategoryMultiplier?: Partial<Record<WeaponSubCategory, number>>
  equipmentStatMultipliers?: Partial<Record<EquipmentStat, number>>
  enablesMeleeRowDamagePenalty?: boolean
  enablesRangedRowDamagePenalty?: boolean
  physicalDamageReductionPercent?: number
  physicalDamageTakenMultiplier?: number
  rangedAttackDamageReductionPercent?: number
  magicDamageReductionPercent?: number
  magicDamageTakenMultiplier?: number
  breathDamageReductionPercent?: number
  breathDamageMultiplier?: number
  physicalDamagePercent?: number
  spellDamagePercent?: number
  spellDamageMultipliers?: Partial<Record<string, number>>
  additionalDamage?: number
  protectRearAllyNormalAttackMultiplier?: number
  protectRearAllyMagicDamageMultiplier?: number
  rearAllyDamageMultiplier?: number
  coverLowHpAlly?: boolean
  twoColumnAttack?: boolean
  actTwicePerTurn?: boolean
  surviveLethalDamageAtHp1?: boolean
  recoverRandomUsedSpellOnDefend?: boolean
  immediateReviveOnAllyDeath?: boolean
  grantsSpellId?: string
  spellChargeBonusForId?: string
  extraSpellCharges?: number
  expBonusPercent?: number
  expMultiplier?: number
  factorDropBonusPercent?: number
  factorDropMultiplier?: number
  goldBonusPercent?: number
  partyRareMultiplier?: number
  partyTitleMultiplier?: number
  partyMagicDamageMultiplier?: number
  expeditionTimeMultiplier?: number
  raceBonus?: RaceBuckets
  raceTakenBonus?: RaceBuckets
  spellTakenMultipliers?: Partial<Record<string, number>>
  undead?: boolean
  hpRegenPercent?: number
  hpRegenAmount?: number
  itemSlotsBonus?: boolean
  recoveryMagicLevel?: number
  mageMagicLevel?: number
  magicDamageFollowUp?: MagicDamageFollowUp
  criticalAttackFollowUp?: MagicDamageFollowUp
  physicalCounterAttack?: PhysicalCounterAttack
  counterAttackAvoidanceRate?: number
  pureGoblinPartyStatBonusPercent?: number
  pureGoblinPartyStatBonusMinLevel?: number
  /** 攻撃で与えたダメージのN%だけHP回復(1回の回復上限は最大HPの25%) */
  lifestealPercent?: number
  /** ターン終了時、味方全員のHPを自分の魔法回復量のN%回復 */
  partyHpRegenFromMagicHealPercent?: number
  /** 攻撃行動のたびに与ダメージ+N%(戦闘中持続・加算) */
  damageRampPerAttackPercent?: number
  /** damageRampPerAttackPercent の上限(%) */
  damageRampMaxPercent?: number
  /** ターン経過ごとに魔法攻撃力+N%(戦闘中持続・加算) */
  magicAtkRampPerTurnPercent?: number
  /** magicAtkRampPerTurnPercent の上限(%) */
  magicAtkRampMaxPercent?: number
  /** 攻撃回数が1のとき攻撃力に掛かる倍率 */
  singleStrikeAttackMultiplier?: number
  /** 攻撃回数が1のとき命中精度に掛かる倍率 */
  singleStrikeAccuracyMultiplier?: number
  /** 敵の物理攻撃をN回、1/3に軽減する障壁で味方全員を保護 */
  physicalBarrierCharges?: number
  /** 敵の魔法攻撃をN回、1/3に軽減する障壁で味方全員を保護 */
  magicBarrierCharges?: number
  /** 味方全員の物理攻撃ダメージ倍率(重複時は最大値のみ) */
  partyPhysicalDamageMultiplier?: number
  /** 攻撃で敵を倒したとき、N%の確率で再攻撃 */
  reattackOnKillChancePercent?: number
  /** 必殺攻撃で受けるダメージをN%軽減 */
  criticalDamageTakenReductionPercent?: number
  /** 受ける追加ダメージをN%軽減 */
  additionalDamageTakenReductionPercent?: number
  /** 攻撃回数が半減し、半減した回数×N だけ防御力上昇 */
  halveAttackCountToDefRate?: number
  /** 攻撃回数が半減し、半減した回数×N だけ魔法攻撃力上昇 */
  halveAttackCountToMagicAtkRate?: number
  /** 通常攻撃時、N%の確率で使用済み魔法が1つ使用可能に戻る */
  recoverUsedSpellOnAttackChancePercent?: number
  /** ターン開始時に敵全体へ魔法攻撃 */
  turnStartAoeMagic?: TurnStartAoeMagic
  /** 自分よりLvが低い相手から受けるダメージをN%軽減(敵専用想定) */
  lowerLevelDamageTakenReductionPercent?: number
  /** 攻撃後N%の確率で再攻撃を繰り返す(敵専用想定) */
  chainReattackChancePercent?: number
}
