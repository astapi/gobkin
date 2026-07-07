import type { Goblin, GoblinStats } from '../../shared/types'
import { addExperience, type LevelUpResult } from '../services/ExperienceSystem'
import { GoblinStatCalculator } from '../services/GoblinStatCalculator'
import {
  calculateGoblinDerivedStats,
  getGoblinBaseAttributes,
  getGoblinBaseAttributesAtLevel,
} from '../../shared/utils/goblinHp'

export class GoblinEntity {
  private readonly base: Goblin
  private stats: GoblinStats
  private level: number
  private experience: number

  constructor(goblin: Goblin) {
    this.base = {
      ...goblin,
      baseAttributes: getGoblinBaseAttributes(goblin),
      stats: { ...goblin.stats },
    }
    this.stats = { ...goblin.stats }
    this.level = goblin.level
    this.experience = goblin.experience
  }

  public get id(): number {
    return this.base.id
  }

  public get name(): string {
    return this.base.name
  }

  public get currentLevel(): number {
    return this.level
  }

  public get currentExperience(): number {
    return this.experience
  }

  /**
   * 因子・スキル適用後の実効ステータスを取得
   */
  public get effectiveStats(): GoblinStats {
    // 現在のステータス（レベルアップ込み）をベースに実効値を計算
    const currentSnapshot = this.toSnapshot()
    return GoblinStatCalculator.calculate(currentSnapshot)
  }

  /**
   * 被ダメージ軽減率を取得（戦闘時に使用）
   */
  public get damageReduction(): number {
    return GoblinStatCalculator.getDamageReduction(this.toSnapshot())
  }

  /**
   * 戦力計算（実効ステータスで計算）
   */
  public calculateCombatPower(): number {
    const stats = this.effectiveStats
    const agility = getGoblinBaseAttributesAtLevel(this.base, this.level).agility
    const rawPower = stats.atk * 1.5 + stats.def * 1.2 + agility + stats.hp / 10
    return Math.round(rawPower)
  }

  public takeDamage(damage: number): void {
    if (damage <= 0) return
    this.stats.hp = Math.max(0, this.stats.hp - Math.floor(damage))
  }

  /**
   * 経験値を獲得してレベルアップ処理を行う
   */
  public gainExperience(expAmount: number): LevelUpResult {
    const result = addExperience(this.level, this.experience, expAmount)
    this.level = result.newLevel
    this.experience = result.remainingExp

    // レベルアップした場合、ステータスを上昇させる（簡易実装）
    if (result.didLevelUp) {
      this.applyLevelUpBonus(result.levelsGained)
    }

    return result
  }

  public toSnapshot(): Goblin {
    const snapshot: Goblin = {
      ...this.base,
      level: this.level,
      experience: this.experience,
      baseAttributes: this.base.baseAttributes,
      stats: { ...this.stats },
      effectiveStats: { ...this.stats }, // 仮設定
    }
    // 実効ステータスを計算（因子・スキル適用後）
    snapshot.effectiveStats = GoblinStatCalculator.calculate(snapshot)
    return snapshot
  }

  /**
   * レベルアップ時のステータス上昇処理
   */
  private applyLevelUpBonus(_levelsGained: number): void {
    // GoblinStatCalculator.calculate と同じ基礎ステータス計算を再利用し、
    // magicAtk / magicDef / criticalRate を含む全派生ステータスを再計算する
    const statContext = {
      race: this.base.race,
      raceId: this.base.raceId,
      job: this.base.job,
      baseAttributes: this.base.baseAttributes,
      skills: this.base.skills,
    }

    this.stats = {
      ...this.stats,
      ...calculateGoblinDerivedStats(this.level, statContext),
    }
  }
}
