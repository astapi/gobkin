import type { EnemyDatabase } from '../../types'

import dwarfMine from './dwarf_mine.json'
import elfForest from './elf_forest.json'
import forestOutskirts from './forest_outskirts.json'
import goblinVillage from './goblin_village.json'
import humanFortress from './human_fortress.json'
import humanVillage from './human_village.json'
import lizardmanSwamp from './lizardman_swamp.json'
import orcCamp from './orc_camp.json'
import royalCapital from './royal_capital.json'
import slimeCave from './slime_cave.json'
import subjugationForce from './subjugation_force.json'
import trollCanyon from './troll_canyon.json'
import undeadRuins from './undead_ruins.json'

const enemyDatabases: Record<string, EnemyDatabase> = {
  dwarf_mine: dwarfMine as EnemyDatabase,
  elf_forest: elfForest as EnemyDatabase,
  forest_outskirts: forestOutskirts as EnemyDatabase,
  goblin_village: goblinVillage as EnemyDatabase,
  human_fortress: humanFortress as EnemyDatabase,
  human_village: humanVillage as EnemyDatabase,
  lizardman_swamp: lizardmanSwamp as EnemyDatabase,
  orc_camp: orcCamp as EnemyDatabase,
  royal_capital: royalCapital as EnemyDatabase,
  slime_cave: slimeCave as EnemyDatabase,
  subjugation_force: subjugationForce as EnemyDatabase,
  troll_canyon: trollCanyon as EnemyDatabase,
  undead_ruins: undeadRuins as EnemyDatabase,
}

export function getEnemyDatabase(areaId: string): EnemyDatabase | null {
  return enemyDatabases[areaId] ?? null
}
