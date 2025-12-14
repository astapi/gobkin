import type { Goblin, GoblinStats } from '../../shared/types/Goblin'
import type { ModInstance } from '../../shared/types/Mod'
import { getModTemplate, getDamageReductionCap } from '../../shared/data/modPoolLoader'

/**
 * Modを適用した最終ステータスを計算するサービス
 */
export class ModStatCalculator {
  /**
   * 基礎ステータス + Mod効果 = 最終ステータス
   * 計算順序: (基礎 + フラット) * (1 + %合計)
   */
  static calculate(goblin: Goblin): GoblinStats {
    const base = { ...goblin.stats }
    const mods = goblin.mods ?? []

    // 1. フラット加算を集計
    const flatBonuses = this.aggregateFlatBonuses(mods)

    // 2. %増加を集計
    const percentBonuses = this.aggregatePercentBonuses(mods)

    // 3. 計算: (基礎 + フラット) * (1 + %合計/100)
    return {
      hp: Math.floor(
        (base.hp + flatBonuses.hp) * (1 + percentBonuses.hp / 100)
      ),
      atk: Math.floor(
        (base.atk + flatBonuses.atk) * (1 + percentBonuses.atk / 100)
      ),
      def: Math.floor(
        (base.def + flatBonuses.def) * (1 + percentBonuses.def / 100)
      ),
      sp: Math.floor(
        (base.sp + flatBonuses.sp) * (1 + percentBonuses.sp / 100)
      ),
      spd: Math.floor(
        (base.spd + flatBonuses.spd) * (1 + percentBonuses.spd / 100)
      ),
    }
  }

  /**
   * 被ダメージ軽減率を取得（戦闘時に使用）
   * 上限はmodPool.jsonのdamageReductionCapで設定
   */
  static getDamageReduction(goblin: Goblin): number {
    const mods = goblin.mods ?? []
    let total = 0

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (template?.stat === 'damage_reduction') {
        total += mod.value
      }
    }

    // 上限適用
    return Math.min(total, getDamageReductionCap())
  }

  /**
   * フラット加算ボーナスを集計
   */
  private static aggregateFlatBonuses(
    mods: ModInstance[]
  ): Record<keyof GoblinStats, number> {
    const bonuses = { hp: 0, atk: 0, def: 0, sp: 0, spd: 0 }

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (!template) continue

      switch (template.stat) {
        case 'hp_flat':
          bonuses.hp += mod.value
          break
        case 'atk_flat':
          bonuses.atk += mod.value
          break
        case 'def_flat':
          bonuses.def += mod.value
          break
        case 'sp_flat':
          bonuses.sp += mod.value
          break
      }
    }

    return bonuses
  }

  /**
   * %増加ボーナスを集計
   */
  private static aggregatePercentBonuses(
    mods: ModInstance[]
  ): Record<keyof GoblinStats, number> {
    const bonuses = { hp: 0, atk: 0, def: 0, sp: 0, spd: 0 }

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (!template) continue

      switch (template.stat) {
        case 'hp_percent':
          bonuses.hp += mod.value
          break
        case 'atk_percent':
          bonuses.atk += mod.value
          break
        case 'def_percent':
          bonuses.def += mod.value
          break
        case 'sp_percent':
          bonuses.sp += mod.value
          break
        case 'spd_percent':
          bonuses.spd += mod.value
          break
      }
    }

    return bonuses
  }

  /**
   * Mod効果のサマリーを取得（UI表示用）
   */
  static getModSummary(goblin: Goblin): {
    flatBonuses: Record<keyof GoblinStats, number>
    percentBonuses: Record<keyof GoblinStats, number>
    damageReduction: number
  } {
    const mods = goblin.mods ?? []
    return {
      flatBonuses: this.aggregateFlatBonuses(mods),
      percentBonuses: this.aggregatePercentBonuses(mods),
      damageReduction: this.getDamageReduction(goblin),
    }
  }
}
