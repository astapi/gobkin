import type { AreaConfig } from '../../types'

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
import margraveSortie1 from './margrave_sortie_1.json'
import fortressDefense1 from './fortress_defense_1.json'
import royalFieldBattle1 from './royal_field_battle_1.json'
import swampDefense1 from './swamp_defense_1.json'
import harpyDefense1 from './harpy_defense_1.json'
import hobbitHillsDefense1 from './hobbit_hills_defense_1.json'
import dwarfMinePurge1 from './dwarf_mine_purge_1.json'

const areaDatabases: Record<string, AreaConfig> = {
  dwarf_mine_1: dwarfMine1 as AreaConfig,
  bandit_hideout: banditHideout as AreaConfig,
  cat_fortress_1: catFortress1 as AreaConfig,
  dragon_volcano_1: dragonVolcano1 as AreaConfig,
  dead_grave_1: deadGrave1 as AreaConfig,
  elf_forest_1: elfForest1 as AreaConfig,
  forest_edge_village: forestEdgeVillage as AreaConfig,
  forest_outskirts: forestOutskirts as AreaConfig,
  goblin_village_1: goblinVillage1 as AreaConfig,
  harpy_cliff_1: harpyCliff1 as AreaConfig,
  human_fortress_1: humanFortress1 as AreaConfig,
  human_village: humanVillage as AreaConfig,
  hobbit_hills_1: hobbitHills1 as AreaConfig,
  lizardman_swamp_1: lizardmanSwamp1 as AreaConfig,
  minotaur_labyrinth_1: minotaurLabyrinth1 as AreaConfig,
  necromancer_crypt_1: necromancerCrypt1 as AreaConfig,
  orc_camp_1: orcCamp1 as AreaConfig,
  orc_fortress_1: orcFortress1 as AreaConfig,
  old_well_waterway: oldWellWaterway as AreaConfig,
  royal_capital_1: royalCapital1 as AreaConfig,
  royal_capital_2: royalCapital2 as AreaConfig,
  royal_capital_3: royalCapital3 as AreaConfig,
  road_1: road1 as AreaConfig,
  slime_cave: slimeCave as AreaConfig,
  spider_forest_1: spiderForest1 as AreaConfig,
  subjugation_force_1: subjugationForce1 as AreaConfig,
  troll_canyon_1: trollCanyon1 as AreaConfig,
  undead_ruins_1: undeadRuins1 as AreaConfig,
  vampire_castle_1: vampireCastle1 as AreaConfig,
  wolf_grassland_1: wolfGrassland1 as AreaConfig,
  margrave_sortie_1: margraveSortie1 as AreaConfig,
  fortress_defense_1: fortressDefense1 as AreaConfig,
  royal_field_battle_1: royalFieldBattle1 as AreaConfig,
  swamp_defense_1: swampDefense1 as AreaConfig,
  harpy_defense_1: harpyDefense1 as AreaConfig,
  hobbit_hills_defense_1: hobbitHillsDefense1 as AreaConfig,
  dwarf_mine_purge_1: dwarfMinePurge1 as AreaConfig,
}

export function getAreaConfig(areaId: string): AreaConfig | null {
  return areaDatabases[areaId] ?? null
}
