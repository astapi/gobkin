import type { Goblin, GoblinStats } from '../../shared/types/Goblin'
import type { ModInstance } from '../../shared/types/Mod'
import type { EquipmentStatBonus, EquipmentEffect } from '../../shared/types/Equipment'
import { getModTemplate, getDamageReductionCap } from '../../shared/data/modPoolLoader'
import { FactorInheritanceService } from './FactorInheritanceService'
import { factorDatabase } from '../../shared/data/factors'

/**
 * 因子・Modを適用した最終ステータスを計算するサービス
 */
export class ModStatCalculator {
  /**
   * 基礎ステータス + 因子ボーナス + Mod効果 + 装備効果 = 最終ステータス
   * 計算順序:
   *   1. (基礎 + 因子 + Modフラット + 装備フラット) * (1 + (Mod% + 装備%)/100)
   *   2. 装備特殊効果を適用（def→HP変換など）
   */
  static calculate(
    goblin: Goblin,
    equipmentBonuses?: EquipmentStatBonus[],
    equipmentEffects?: EquipmentEffect[]
  ): GoblinStats {
    const base = { ...goblin.stats }
    const mods = goblin.mods ?? []

    // 1. 因子ボーナスを計算（亜種の追加効果も含む）
    const variantFactor = goblin.variantFactorId ? factorDatabase[goblin.variantFactorId] : undefined
    const factorBonuses = FactorInheritanceService.calculateFactorBonuses(goblin.factors ?? [], variantFactor)

    // 2. Modフラット加算を集計
    const flatBonuses = this.aggregateFlatBonuses(mods)

    // 3. Mod%増加を集計
    const percentBonuses = this.aggregatePercentBonuses(mods)

    // 4. 装備ボーナスを集計
    const equipFlat = this.aggregateEquipmentFlat(equipmentBonuses ?? [])
    const equipPercent = this.aggregateEquipmentPercent(equipmentBonuses ?? [])

    // 5. 計算: (基礎 + 因子 + Modフラット + 装備フラット) * (1 + (Mod% + 装備%)/100)
    const result: GoblinStats = {
      hp: Math.floor(
        (base.hp + factorBonuses.hp + flatBonuses.hp + equipFlat.hp) * (1 + (percentBonuses.hp + equipPercent.hp) / 100)
      ),
      atk: Math.floor(
        (base.atk + factorBonuses.atk + flatBonuses.atk + equipFlat.atk) * (1 + (percentBonuses.atk + equipPercent.atk) / 100)
      ),
      def: Math.floor(
        (base.def + factorBonuses.def + flatBonuses.def + equipFlat.def) * (1 + (percentBonuses.def + equipPercent.def) / 100)
      ),
      sp: Math.floor(
        (base.sp + factorBonuses.sp + flatBonuses.sp + equipFlat.sp) * (1 + (percentBonuses.sp + equipPercent.sp) / 100)
      ),
      spd: Math.floor(
        (base.spd + factorBonuses.spd + flatBonuses.spd + equipFlat.spd) * (1 + (percentBonuses.spd + equipPercent.spd) / 100)
      ),
    }

    // 6. 装備特殊効果を適用（ステータス確定後）
    this.applyEquipmentEffects(result, equipmentEffects ?? [])

    return result
  }

  /**
   * 被ダメージ軽減率を取得（戦闘時に使用）
   * Mod + 装備の合算値。上限はmodPool.jsonのdamageReductionCapで設定
   */
  static getDamageReduction(goblin: Goblin, equipmentBonuses?: EquipmentStatBonus[]): number {
    const mods = goblin.mods ?? []
    let total = 0

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (template?.stat === 'damage_reduction') {
        total += mod.value
      }
    }

    // 装備の被ダメージ軽減を加算
    for (const bonus of equipmentBonuses ?? []) {
      if (bonus.stat === 'damage_reduction') {
        total += bonus.value
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
        case 'spd_flat':
          bonuses.spd += mod.value
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

  /**
   * 装備のフラット加算ボーナスを集計
   */
  private static aggregateEquipmentFlat(
    bonuses: EquipmentStatBonus[]
  ): Record<keyof GoblinStats, number> {
    const result = { hp: 0, atk: 0, def: 0, sp: 0, spd: 0 }

    for (const bonus of bonuses) {
      switch (bonus.stat) {
        case 'hp_flat':
          result.hp += bonus.value
          break
        case 'atk_flat':
          result.atk += bonus.value
          break
        case 'def_flat':
          result.def += bonus.value
          break
        case 'sp_flat':
          result.sp += bonus.value
          break
        case 'spd_flat':
          result.spd += bonus.value
          break
      }
    }

    return result
  }

  /**
   * 装備の%増加ボーナスを集計
   */
  private static aggregateEquipmentPercent(
    bonuses: EquipmentStatBonus[]
  ): Record<keyof GoblinStats, number> {
    const result = { hp: 0, atk: 0, def: 0, sp: 0, spd: 0 }

    for (const bonus of bonuses) {
      switch (bonus.stat) {
        case 'hp_percent':
          result.hp += bonus.value
          break
        case 'atk_percent':
          result.atk += bonus.value
          break
        case 'def_percent':
          result.def += bonus.value
          break
        case 'sp_percent':
          result.sp += bonus.value
          break
        case 'spd_percent':
          result.spd += bonus.value
          break
      }
    }

    return result
  }

  /**
   * 装備特殊効果をステータス確定後に適用
   * - def_to_hp: 最終防御力のX%をHPに加算
   * - critical_damage_bonus / accuracy_boost: BattleSystem側で処理（ステータス計算には影響しない）
   */
  private static applyEquipmentEffects(
    stats: GoblinStats,
    effects: EquipmentEffect[]
  ): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'def_to_hp':
          stats.hp += Math.floor(stats.def * effect.value / 100)
          break
        // critical_damage_bonus, accuracy_boost は戦闘時に参照（BattleSystem未実装）
      }
    }
  }
}
