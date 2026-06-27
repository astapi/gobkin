import type { EnemyDatabase } from '../../types'

import dwarfMine1 from './dwarf_mine_1.json'
import dragonVolcano1 from './dragon_volcano_1.json'
import elfForest1 from './elf_forest_1.json'
import banditHideout from './bandit_hideout.json'
import forestEdgeVillage from './forest_edge_village.json'
import forestOutskirts from './forest_outskirts.json'
import goblinVillage1 from './goblin_village_1.json'
import harpyCliff1 from './harpy_cliff_1.json'
import humanFortress1 from './human_fortress_1.json'
import humanVillage from './human_village.json'
import hobbitHills1 from './hobbit_hills_1.json'
import lizardmanSwamp1 from './lizardman_swamp_1.json'
import minotaurLabyrinth1 from './minotaur_labyrinth_1.json'
import necromancerCrypt1 from './necromancer_crypt_1.json'
import orcCamp1 from './orc_camp_1.json'
import orcFortress1 from './orc_fortress_1.json'
import oldWellWaterway from './old_well_waterway.json'
import royalCapital1 from './royal_capital_1.json'
import royalCapital2 from './royal_capital_2.json'
import royalCapital3 from './royal_capital_3.json'
import road1 from './road_1.json'
import slimeCave from './slime_cave.json'
import subjugationForce1 from './subjugation_force_1.json'
import trollCanyon1 from './troll_canyon_1.json'
import undeadRuins1 from './undead_ruins_1.json'
import vampireCastle1 from './vampire_castle_1.json'
import wolfGrassland1 from './wolf_grassland_1.json'
import spiderForest1 from './spider_forest_1.json'
import deadGrave1 from './dead_grave_1.json'
import catFortress1 from './cat_fortress_1.json'

const enemyDatabases: Record<string, EnemyDatabase> = {
  dwarf_mine_1: dwarfMine1 as EnemyDatabase,
  bandit_hideout: banditHideout as EnemyDatabase,
  cat_fortress_1: catFortress1 as EnemyDatabase,
  dragon_volcano_1: dragonVolcano1 as EnemyDatabase,
  dead_grave_1: deadGrave1 as EnemyDatabase,
  elf_forest_1: elfForest1 as EnemyDatabase,
  forest_edge_village: forestEdgeVillage as EnemyDatabase,
  forest_outskirts: forestOutskirts as EnemyDatabase,
  goblin_village_1: goblinVillage1 as EnemyDatabase,
  harpy_cliff_1: harpyCliff1 as EnemyDatabase,
  human_fortress_1: humanFortress1 as EnemyDatabase,
  human_village: humanVillage as EnemyDatabase,
  hobbit_hills_1: hobbitHills1 as EnemyDatabase,
  lizardman_swamp_1: lizardmanSwamp1 as EnemyDatabase,
  minotaur_labyrinth_1: minotaurLabyrinth1 as EnemyDatabase,
  necromancer_crypt_1: necromancerCrypt1 as EnemyDatabase,
  orc_camp_1: orcCamp1 as EnemyDatabase,
  orc_fortress_1: orcFortress1 as EnemyDatabase,
  old_well_waterway: oldWellWaterway as EnemyDatabase,
  royal_capital_1: royalCapital1 as EnemyDatabase,
  royal_capital_2: royalCapital2 as EnemyDatabase,
  royal_capital_3: royalCapital3 as EnemyDatabase,
  road_1: road1 as EnemyDatabase,
  slime_cave: slimeCave as EnemyDatabase,
  spider_forest_1: spiderForest1 as EnemyDatabase,
  subjugation_force_1: subjugationForce1 as EnemyDatabase,
  troll_canyon_1: trollCanyon1 as EnemyDatabase,
  undead_ruins_1: undeadRuins1 as EnemyDatabase,
  vampire_castle_1: vampireCastle1 as EnemyDatabase,
  wolf_grassland_1: wolfGrassland1 as EnemyDatabase,
}

export function getEnemyDatabase(areaId: string): EnemyDatabase | null {
  const database = enemyDatabases[areaId]
  return database ?? null
}
