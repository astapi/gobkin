import type { BattleResult } from '../services'
import { BattleSystem } from '../services'
import type { Enemy, Goblin } from '../../shared/types'

export class ExecuteBattleUseCase {
  private readonly battleSystem: BattleSystem

  constructor(battleSystem: BattleSystem = new BattleSystem()) {
    this.battleSystem = battleSystem
  }

  public execute(
    allies: Goblin[],
    initialAllyHP: number[],
    enemies: Enemy[],
    rng: () => number = Math.random,
  ): BattleResult {
    return this.battleSystem.executeBattle(allies, initialAllyHP, enemies, rng)
  }
}
