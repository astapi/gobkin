import type { Goblin, GoblinStats } from '../../shared/types/Goblin'
import type { ModInstance } from '../../shared/types/Mod'
import type { CharacterSkill } from '../../shared/types/CharacterSkill'
import type { EquipmentStatBonus } from '../../shared/types/Equipment'
import { getModTemplate, getDamageReductionCap } from '../../shared/data/modPoolLoader'
import {
  applySkillBonusesToEquipmentBonuses,
  getUniqueSkillsById,
  getSkillStatBonuses,
  getSkillStatMultipliers,
} from '../../shared/data/characterSkills'
import { FactorInheritanceService } from './FactorInheritanceService'
import { factorDatabase } from '../../shared/data/factors'
import {
  calculateGoblinBaseAccuracy,
  calculateGoblinBaseAtk,
  calculateGoblinBaseAttackCount,
  calculateGoblinBaseDef,
  calculateGoblinBaseEvasion,
  calculateGoblinBaseHp,
  calculateGoblinBaseMagicAtk,
  calculateGoblinBaseMagicDef,
  calculateGoblinBaseMagicHeal,
} from '../../shared/utils/goblinHp'

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
  ): GoblinStats {
    const base = {
      ...goblin.stats,
      hp: calculateGoblinBaseHp(goblin.level, goblin),
      atk: calculateGoblinBaseAtk(goblin.level, goblin),
      magicAtk: calculateGoblinBaseMagicAtk(goblin.level, goblin),
      def: calculateGoblinBaseDef(goblin.level, goblin),
      magicDef: calculateGoblinBaseMagicDef(goblin.level, goblin),
      attackCount: calculateGoblinBaseAttackCount(goblin.level, goblin),
      accuracy: calculateGoblinBaseAccuracy(goblin.level, goblin),
      evasion: calculateGoblinBaseEvasion(goblin.level, goblin),
      magicHeal: calculateGoblinBaseMagicHeal(goblin.level, goblin),
    }
    const mods = goblin.mods ?? []

    // 1. 因子ボーナスを計算（亜種の追加効果も含む）
    const variantFactor = goblin.variantFactorId ? factorDatabase[goblin.variantFactorId] : undefined
    const factorBonuses = FactorInheritanceService.calculateFactorBonuses(goblin.factors ?? [], variantFactor)

    // 2. Modフラット加算を集計
    const flatBonuses = this.aggregateFlatBonuses(mods)

    // 3. Mod%増加を集計
    const percentBonuses = this.aggregatePercentBonuses(mods)

    // 4. 装備ボーナスを集計
    const skillBonuses = getSkillStatBonuses(goblin.skills)
    const skillMultipliers = getSkillStatMultipliers(goblin.skills)
    const adjustedEquipmentBonuses = applySkillBonusesToEquipmentBonuses(goblin.skills, equipmentBonuses ?? [])
    const equipFlat = this.aggregateEquipmentFlat(adjustedEquipmentBonuses)
    const equipPercent = this.aggregateEquipmentPercent(adjustedEquipmentBonuses)

    // 5. 計算: 通常は (基礎 + 因子 + Modフラット + 装備フラット) * %
    // HPのみ、因子を最後に加算する
    const calc = (key: keyof GoblinStats) =>
      Math.floor(
        (base[key] + factorBonuses[key] + flatBonuses[key] + equipFlat[key] + (skillBonuses[key] ?? 0)) *
        (1 + (percentBonuses[key] + equipPercent[key]) / 100)
      )

    const calcHp = () =>
      Math.floor(
        (base.hp + flatBonuses.hp + equipFlat.hp + (skillBonuses.hp ?? 0)) *
        (1 + (percentBonuses.hp + equipPercent.hp) / 100)
      ) + factorBonuses.hp

    const withMultiplier = (key: keyof GoblinStats) => Math.floor(calc(key) * (skillMultipliers[key] ?? 1))

    const result: GoblinStats = {
      hp: Math.floor(calcHp() * (skillMultipliers.hp ?? 1)),
      atk: withMultiplier('atk'),
      magicAtk: withMultiplier('magicAtk'),
      def: withMultiplier('def'),
      magicDef: withMultiplier('magicDef'),
      attackCount: Math.max(1, withMultiplier('attackCount')),
      accuracy: withMultiplier('accuracy'),
      evasion: withMultiplier('evasion'),
      magicHeal: withMultiplier('magicHeal'),
    }

    // 6. パッシブスキル由来の最終効果を適用（ステータス確定後）
    this.applyPassiveSkillEffects(result, goblin.skills)

    return result
  }

  /**
   * 被ダメージ軽減率を取得（戦闘時に使用）
   * Mod + 装備の合算値。上限はmodPool.jsonのdamageReductionCapで設定
   */
  static getDamageReduction(goblin: Goblin, equipmentBonuses?: EquipmentStatBonus[]): number {
    const mods = goblin.mods ?? []
    let total = 0
    const adjustedEquipmentBonuses = applySkillBonusesToEquipmentBonuses(goblin.skills, equipmentBonuses ?? [])

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (template?.stat === 'damage_reduction') {
        total += mod.value
      }
    }

    // 装備の被ダメージ軽減を加算
    for (const bonus of adjustedEquipmentBonuses) {
      if (bonus.stat === 'damage_reduction') {
        total += bonus.value
      }
    }

    // 上限適用
    return Math.min(total, getDamageReductionCap())
  }

  private static readonly ZERO_STATS: Record<keyof GoblinStats, number> = {
    hp: 0, atk: 0, magicAtk: 0, def: 0, magicDef: 0, attackCount: 0, accuracy: 0, evasion: 0, magicHeal: 0,
  }

  /** 装備のstat名からGoblinStatsのキーへの特別マッピング */
  private static readonly EQUIPMENT_STAT_ALIAS: Record<string, keyof GoblinStats> = {
    magic_atk: 'magicAtk',
    magic_def: 'magicDef',
  }

  /** stat名からGoblinStatsのキーを抽出（例: 'hp_flat' → 'hp', 'magic_atk_flat' → 'magicAtk'） */
  private static statKeyFromSuffix(stat: string, suffix: string): keyof GoblinStats | undefined {
    if (!stat.endsWith(suffix)) return undefined
    const key = stat.slice(0, -suffix.length)
    if (key in this.ZERO_STATS) return key as keyof GoblinStats
    if (key in this.EQUIPMENT_STAT_ALIAS) return this.EQUIPMENT_STAT_ALIAS[key]
    return undefined
  }

  /**
   * フラット加算ボーナスを集計
   */
  private static aggregateFlatBonuses(
    mods: ModInstance[]
  ): Record<keyof GoblinStats, number> {
    const bonuses = { ...this.ZERO_STATS }

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (!template) continue
      const key = this.statKeyFromSuffix(template.stat, '_flat')
      if (key) bonuses[key] += mod.value
    }

    return bonuses
  }

  /**
   * %増加ボーナスを集計
   */
  private static aggregatePercentBonuses(
    mods: ModInstance[]
  ): Record<keyof GoblinStats, number> {
    const bonuses = { ...this.ZERO_STATS }

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (!template) continue
      const key = this.statKeyFromSuffix(template.stat, '_percent')
      if (key) bonuses[key] += mod.value
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
    const result = { ...this.ZERO_STATS }

    for (const bonus of bonuses) {
      const key = this.statKeyFromSuffix(bonus.stat, '_flat')
      if (key) result[key] += bonus.value
    }

    return result
  }

  /**
   * 装備の%増加ボーナスを集計
   */
  private static aggregateEquipmentPercent(
    bonuses: EquipmentStatBonus[]
  ): Record<keyof GoblinStats, number> {
    const result = { ...this.ZERO_STATS }

    for (const bonus of bonuses) {
      const key = this.statKeyFromSuffix(bonus.stat, '_percent')
      if (key) result[key] += bonus.value
    }

    return result
  }

  private static applyPassiveSkillEffects(
    stats: GoblinStats,
    skills: CharacterSkill[],
  ): void {
    for (const skill of getUniqueSkillsById(skills)) {
      if (skill.defToHpPercent !== undefined) {
        stats.hp += Math.floor(stats.def * skill.defToHpPercent / 100)
      }
      if (skill.magicHealToHpPercent !== undefined) {
        stats.hp += Math.floor(stats.magicHeal * skill.magicHealToHpPercent / 100)
      }
    }
  }
}
