import type { Goblin, Enemy } from '../shared/types';
import type { Combatant } from './damage';

/**
 * Goblin型をCombatant型に変換
 */
export function goblinToCombatant(goblin: Goblin): Combatant {
  return {
    id: goblin.id.toString(),
    name: goblin.name,
    atk: goblin.stats.atk,
    def: goblin.stats.def,
    raceTags: ['goblin'],
    items: [],
    buffs: [],
  };
}

/**
 * Enemy型をCombatant型に変換
 */
export function enemyToCombatant(enemy: Enemy): Combatant {
  return {
    id: enemy.id,
    name: enemy.name,
    atk: enemy.atk,
    def: enemy.def,
    raceTags: enemy.raceTags,
    items: [],
    buffs: [],
  };
}
