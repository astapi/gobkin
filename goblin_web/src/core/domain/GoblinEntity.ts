import type { Goblin, GoblinStats } from '../../shared/types'
import { addExperience, type LevelUpResult } from '../services/ExperienceSystem'

export class GoblinEntity {
  private readonly base: Goblin
  private stats: GoblinStats
  private level: number
  private experience: number

  constructor(goblin: Goblin) {
    this.base = {
      ...goblin,
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

  public calculateCombatPower(): number {
    const { atk, def, sp, spd, hp } = this.stats
    const rawPower = atk * 1.5 + def * 1.2 + sp + spd + hp / 10
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
    return {
      ...this.base,
      level: this.level,
      experience: this.experience,
      stats: { ...this.stats },
    }
  }

  /**
   * レベルアップ時のステータス上昇処理
   * TODO: 種族ごとの成長率を設定する
   */
  private applyLevelUpBonus(levelsGained: number): void {
    for (let i = 0; i < levelsGained; i++) {
      this.stats = {
        hp: this.stats.hp + 5,
        atk: this.stats.atk + 2,
        def: this.stats.def + 1,
        sp: this.stats.sp + 1,
        spd: this.stats.spd + 1,
      }
    }
  }
}
