/** 呪文のターゲティング方式 */
export type SpellTargeting =
  | { type: 'random_hits'; hitCount: number }
  | { type: 'multi_target'; baseTargets: number; scalePerLevel: number; scaleLevelInterval: number }
  | { type: 'single_ally_lowest_hp' }
  | { type: 'single_ally_below_half_hp' }
  | { type: 'all_allies' }

/** 呪文定義（マスターデータ） */
export interface SpellDef {
  id: string
  name: string
  power: number              // Skill.power と同じ（ATKベース）
  targeting: SpellTargeting
  defaultCharges: number     // 1戦闘あたりの使用回数（デフォルト1）
  effect?: 'damage' | 'heal' | 'barrier' | 'cure'
  spellCoefficient?: number  // 魔法追加ダメージの呪文係数（デフォルト0 = 追加なし）
  spellCoefficientPerLevel?: number // 呪文係数に加算するレベル係数
  healBonus?: number
  fullHeal?: boolean         // trueの場合、対象のHPを全回復する
  damageReductionPercent?: number
  breathDamageReductionPercent?: number
  magicDamageReductionPercent?: number
}

/** キャラクターが習得した呪文 */
export interface LearnedSpell {
  spellId: string
  extraCharges?: number      // Modによる追加チャージ数
}
