import type { Enemy, Goblin } from '../../shared/types'
import type { Combatant } from './DamageCalculator'

export class CombatantManager {
  public fromGoblin(goblin: Goblin): Combatant {
    return {
      id: goblin.id.toString(),
      name: goblin.name,
      atk: goblin.stats.atk,
      def: goblin.stats.def,
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
