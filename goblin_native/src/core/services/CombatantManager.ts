import type { Enemy, Goblin } from '../../shared/types'
import type { Combatant } from './DamageCalculator'
import { getEffectiveStats } from '../../shared/utils/goblinStats'

export class CombatantManager {
  public fromGoblin(goblin: Goblin): Combatant {
    const effectiveStats = getEffectiveStats(goblin)
    return {
      id: goblin.id.toString(),
      name: goblin.name,
      atk: effectiveStats.atk,
      magicAtk: effectiveStats.magicAtk,
      def: effectiveStats.def,
      magicDef: effectiveStats.magicDef,
      attackCount: effectiveStats.attackCount,
      accuracy: effectiveStats.accuracy,
      evasion: effectiveStats.evasion,
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
      magicAtk: enemy.magicAtk,
      def: enemy.def,
      magicDef: enemy.magicDef,
      attackCount: enemy.attackCount,
      accuracy: enemy.accuracy,
      evasion: enemy.evasion,
      raceTags: enemy.raceTags,
      items: [],
      buffs: [],
    }
  }
}
