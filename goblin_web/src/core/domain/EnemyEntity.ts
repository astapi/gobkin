import type { Enemy } from '../../shared/types'

const CAPTURE_THRESHOLD = 0.3

export class EnemyEntity {
  private readonly base: Enemy
  private currentHP: number

  constructor(enemy: Enemy) {
    this.base = { ...enemy }
    this.currentHP = enemy.hp
  }

  public takeDamage(damage: number): void {
    if (damage <= 0) return
    this.currentHP = Math.max(0, this.currentHP - Math.floor(damage))
  }

  public canBeCaptured(): boolean {
    return this.currentHP <= this.base.hp * CAPTURE_THRESHOLD
  }

  public isDefeated(): boolean {
    return this.currentHP <= 0
  }

  public toSnapshot(): Enemy {
    return { ...this.base, hp: this.currentHP }
  }
}
