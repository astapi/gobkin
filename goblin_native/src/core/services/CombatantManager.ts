import type { Enemy, Goblin } from '../../shared/types'
import type { Combatant } from './DamageCalculator'
import { ModStatCalculator } from './ModStatCalculator'

export class CombatantManager {
  public fromGoblin(goblin: Goblin): Combatant {
    // Mod適用後のステータスを使用
    const effectiveStats = ModStatCalculator.calculate(goblin)
    return {
      id: goblin.id.toString(),
      name: goblin.name,
      atk: effectiveStats.atk,
      def: effectiveStats.def,
      raceTags: ['goblin'],
      items: [],
      buffs: [],
    }
  }

  public fromEnemy(enemy: Enemy): Combatant {
    return {
      id: enemy.id,
      name: enemy.name,
      atk: enemy.atk,
      def: enemy.def,
      raceTags: enemy.raceTags,
      items: [],
      buffs: [],
    }
  }
}
