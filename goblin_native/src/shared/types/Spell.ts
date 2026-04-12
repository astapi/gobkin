/** 呪文のターゲティング方式 */
export type SpellTargeting =
  | { type: 'random_hits'; hitCount: number }
  | { type: 'multi_target'; baseTargets: number; scalePerLevel: number; scaleLevelInterval: number }
  | { type: 'single_ally_lowest_hp' }
  | { type: 'all_allies' }

/** 呪文定義（マスターデータ） */
export interface SpellDef {
  id: string
  name: string
  power: number              // Skill.power と同じ（ATKベース）
  targeting: SpellTargeting
  defaultCharges: number     // 1戦闘あたりの使用回数（デフォルト1）
  effect?: 'damage' | 'heal' | 'barrier'
  spellCoefficient?: number  // 魔法追加ダメージの呪文係数（デフォルト0 = 追加なし）
  healBonus?: number
  damageReductionPercent?: number
  breathDamageReductionPercent?: number
}

/** キャラクターが習得した呪文 */
export interface LearnedSpell {
  spellId: string
  extraCharges?: number      // Modによる追加チャージ数
}
