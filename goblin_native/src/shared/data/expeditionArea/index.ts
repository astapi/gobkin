import type { AreaConfig } from '../../types'

import dwarfMine1 from './dwarf_mine_1.json'
import dwarfMine2 from './dwarf_mine_2.json'
import dwarfMine3 from './dwarf_mine_3.json'
import elfForest1 from './elf_forest_1.json'
import elfForest2 from './elf_forest_2.json'
import elfForest3 from './elf_forest_3.json'
import forestOutskirts from './forest_outskirts.json'
import goblinVillage1 from './goblin_village_1.json'
import goblinVillage2 from './goblin_village_2.json'
import goblinVillage3 from './goblin_village_3.json'
import humanFortress1 from './human_fortress_1.json'
import humanFortress2 from './human_fortress_2.json'
import humanFortress3 from './human_fortress_3.json'
import humanVillage1 from './human_village_1.json'
import humanVillage2 from './human_village_2.json'
import humanVillage3 from './human_village_3.json'
import lizardmanSwamp1 from './lizardman_swamp_1.json'
import lizardmanSwamp2 from './lizardman_swamp_2.json'
import lizardmanSwamp3 from './lizardman_swamp_3.json'
import orcCamp1 from './orc_camp_1.json'
import orcCamp2 from './orc_camp_2.json'
import orcCamp3 from './orc_camp_3.json'
import royalCapital1 from './royal_capital_1.json'
import royalCapital2 from './royal_capital_2.json'
import royalCapital3 from './royal_capital_3.json'
import road1 from './road_1.json'
import slimeCave from './slime_cave.json'
import subjugationForce1 from './subjugation_force_1.json'
import subjugationForce2 from './subjugation_force_2.json'
import subjugationForce3 from './subjugation_force_3.json'
import trollCanyon1 from './troll_canyon_1.json'
import trollCanyon2 from './troll_canyon_2.json'
import trollCanyon3 from './troll_canyon_3.json'
import undeadRuins1 from './undead_ruins_1.json'
import undeadRuins2 from './undead_ruins_2.json'
import undeadRuins3 from './undead_ruins_3.json'

const areaDatabases: Record<string, AreaConfig> = {
  dwarf_mine_1: dwarfMine1 as AreaConfig,
  dwarf_mine_2: dwarfMine2 as AreaConfig,
  dwarf_mine_3: dwarfMine3 as AreaConfig,
  elf_forest_1: elfForest1 as AreaConfig,
  elf_forest_2: elfForest2 as AreaConfig,
  elf_forest_3: elfForest3 as AreaConfig,
  forest_outskirts: forestOutskirts as AreaConfig,
  goblin_village_1: goblinVillage1 as AreaConfig,
  goblin_village_2: goblinVillage2 as AreaConfig,
  goblin_village_3: goblinVillage3 as AreaConfig,
  human_fortress_1: humanFortress1 as AreaConfig,
  human_fortress_2: humanFortress2 as AreaConfig,
  human_fortress_3: humanFortress3 as AreaConfig,
  human_village_1: humanVillage1 as AreaConfig,
  human_village_2: humanVillage2 as AreaConfig,
  human_village_3: humanVillage3 as AreaConfig,
  lizardman_swamp_1: lizardmanSwamp1 as AreaConfig,
  lizardman_swamp_2: lizardmanSwamp2 as AreaConfig,
  lizardman_swamp_3: lizardmanSwamp3 as AreaConfig,
  orc_camp_1: orcCamp1 as AreaConfig,
  orc_camp_2: orcCamp2 as AreaConfig,
  orc_camp_3: orcCamp3 as AreaConfig,
  royal_capital_1: royalCapital1 as AreaConfig,
  royal_capital_2: royalCapital2 as AreaConfig,
  royal_capital_3: royalCapital3 as AreaConfig,
  road_1: road1 as AreaConfig,
  slime_cave: slimeCave as AreaConfig,
  subjugation_force_1: subjugationForce1 as AreaConfig,
  subjugation_force_2: subjugationForce2 as AreaConfig,
  subjugation_force_3: subjugationForce3 as AreaConfig,
  troll_canyon_1: trollCanyon1 as AreaConfig,
  troll_canyon_2: trollCanyon2 as AreaConfig,
  troll_canyon_3: trollCanyon3 as AreaConfig,
  undead_ruins_1: undeadRuins1 as AreaConfig,
  undead_ruins_2: undeadRuins2 as AreaConfig,
  undead_ruins_3: undeadRuins3 as AreaConfig,
}

export function getAreaConfig(areaId: string): AreaConfig | null {
  return areaDatabases[areaId] ?? null
}
