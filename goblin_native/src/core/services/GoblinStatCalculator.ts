import type { Goblin, GoblinBaseAttributes, GoblinStats } from '../../shared/types/Goblin'
import type { CharacterSkill } from '../../shared/types/CharacterSkill'
import type { EquipmentStatBonus } from '../../shared/types/Equipment'
import {
  applySkillBonusesToEquipmentBonuses,
  getCriticalRateBonusFromSkills,
  getUniqueSkillsById,
  getSkillStatBonuses,
  getSkillStatMultipliers,
} from '../../shared/data/characterSkills'
import { FactorInheritanceService } from './FactorInheritanceService'
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
  calculateGoblinBaseCriticalRate,
} from '../../shared/utils/goblinHp'

/**
 * 因子・装備・スキルを適用した最終ステータスを計算するサービス
 */
export class GoblinStatCalculator {
  /**
   * 基礎ステータス + 因子ボーナス + 装備効果 + スキル効果 = 最終ステータス
   * 計算順序:
   *   1. (基礎 + 因子 + 装備フラット + スキルフラット) * (1 + 装備%/100)
   *   2. スキル倍率・パッシブ効果を適用
   */
  static calculate(
    goblin: Goblin,
    equipmentBonuses?: EquipmentStatBonus[],
  ): GoblinStats {
    const adjustedEquipmentBonuses = applySkillBonusesToEquipmentBonuses(goblin.skills, equipmentBonuses ?? [])
    const equipmentBaseAttributeBonuses = this.aggregateEquipmentBaseAttributes(adjustedEquipmentBonuses)
    const statContext = { ...goblin, equipmentBaseAttributeBonuses }
    const base = {
      ...goblin.stats,
      hp: calculateGoblinBaseHp(goblin.level, statContext),
      atk: calculateGoblinBaseAtk(goblin.level, statContext),
      magicAtk: calculateGoblinBaseMagicAtk(goblin.level, statContext),
      def: calculateGoblinBaseDef(goblin.level, statContext),
      magicDef: calculateGoblinBaseMagicDef(goblin.level, statContext),
      attackCount: calculateGoblinBaseAttackCount(goblin.level, statContext),
      accuracy: calculateGoblinBaseAccuracy(goblin.level, statContext),
      evasion: calculateGoblinBaseEvasion(goblin.level, statContext),
      magicHeal: calculateGoblinBaseMagicHeal(goblin.level, statContext),
      criticalRate: calculateGoblinBaseCriticalRate(goblin.level, statContext),
    }
    // 1. 因子ボーナスを計算
    const factorBonuses = FactorInheritanceService.calculateFactorBonuses(goblin.factors ?? [])

    // 2. 装備・スキルボーナスを集計
    const skillBonuses = getSkillStatBonuses(goblin.skills)
    const skillMultipliers = getSkillStatMultipliers(goblin.skills)
    const equipFlat = this.aggregateEquipmentFlat(adjustedEquipmentBonuses)
    const equipPercent = this.aggregateEquipmentPercent(adjustedEquipmentBonuses)

    // 3. 計算: 通常は (基礎 + 因子 + 装備フラット + スキルフラット) * %
    // HPのみ、因子を最後に加算する
    const calc = (key: keyof GoblinStats) =>
      Math.floor(
        (base[key] + factorBonuses[key] + equipFlat[key] + (skillBonuses[key] ?? 0)) *
        (1 + equipPercent[key] / 100)
      )

    const calcHp = () =>
      Math.floor(
        (base.hp + equipFlat.hp + (skillBonuses.hp ?? 0)) *
        (1 + equipPercent.hp / 100)
      ) + factorBonuses.hp

    const withMultiplier = (key: keyof GoblinStats) => Math.floor(calc(key) * (skillMultipliers[key] ?? 1))

    // 装備の critical_rate_percent をフラット加算として集計
    const equipCriticalRateFlat = this.aggregateEquipmentCriticalRate(adjustedEquipmentBonuses)

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
      criticalRate: Math.min(50, withMultiplier('criticalRate') + equipCriticalRateFlat + getCriticalRateBonusFromSkills(goblin.skills)),
    }

    // 4. パッシブスキル由来の最終効果を適用（ステータス確定後）
    this.applyPassiveSkillEffects(result, goblin.skills)

    return result
  }

  /**
   * 被ダメージ軽減率を取得（戦闘時に使用）
   * 装備由来の軽減値を合算する
   */
  static getDamageReduction(goblin: Goblin, equipmentBonuses?: EquipmentStatBonus[]): number {
    let total = 0
    const adjustedEquipmentBonuses = applySkillBonusesToEquipmentBonuses(goblin.skills, equipmentBonuses ?? [])

    // 装備の被ダメージ軽減を加算
    for (const bonus of adjustedEquipmentBonuses) {
      if (bonus.stat === 'damage_reduction') {
        total += bonus.value
      }
    }

    return total
  }

  /**
   * 装備の critical_rate_percent をフラット加算として集計
   */
  private static aggregateEquipmentCriticalRate(bonuses: EquipmentStatBonus[]): number {
    let total = 0
    for (const bonus of bonuses) {
      if (bonus.stat === 'critical_rate_percent') {
        total += bonus.value
      }
    }
    return total
  }

  private static readonly ZERO_STATS: Record<keyof GoblinStats, number> = {
    hp: 0, atk: 0, magicAtk: 0, def: 0, magicDef: 0, attackCount: 0, accuracy: 0, evasion: 0, magicHeal: 0, criticalRate: 0,
  }

  private static readonly ZERO_BASE_ATTRIBUTES: GoblinBaseAttributes = {
    power: 0,
    wisdom: 0,
    spirit: 0,
    vitality: 0,
    agility: 0,
    luck: 0,
  }

  private static aggregateEquipmentBaseAttributes(
    bonuses: EquipmentStatBonus[],
  ): GoblinBaseAttributes {
    const result = { ...this.ZERO_BASE_ATTRIBUTES }
    for (const bonus of bonuses) {
      if (!bonus.stat.endsWith('_flat')) continue
      const key = bonus.stat.slice(0, -'_flat'.length)
      if (key in result) result[key as keyof GoblinBaseAttributes] += bonus.value
    }
    return result
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
    // 構え系(攻撃回数半減→ステータス変換)を先に適用し、変換後の値を他の変換の入力にする
    for (const skill of getUniqueSkillsById(skills)) {
      if (skill.halveAttackCountToDefRate === undefined && skill.halveAttackCountToMagicAtkRate === undefined) {
        continue
      }
      const halvedCount = Math.max(1, Math.ceil(stats.attackCount / 2))
      const lostCount = stats.attackCount - halvedCount
      if (lostCount <= 0) continue
      if (skill.halveAttackCountToDefRate !== undefined) {
        stats.def += lostCount * skill.halveAttackCountToDefRate
      }
      if (skill.halveAttackCountToMagicAtkRate !== undefined) {
        stats.magicAtk += lostCount * skill.halveAttackCountToMagicAtkRate
      }
      stats.attackCount = halvedCount
    }

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
