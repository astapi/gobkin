import type { AreaConfig } from '../../types'

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

const areaDatabases: Record<string, AreaConfig> = {
  dwarf_mine: dwarfMine as AreaConfig,
  elf_forest: elfForest as AreaConfig,
  forest_outskirts: forestOutskirts as AreaConfig,
  goblin_village: goblinVillage as AreaConfig,
  human_fortress: humanFortress as AreaConfig,
  human_village: humanVillage as AreaConfig,
  lizardman_swamp: lizardmanSwamp as AreaConfig,
  orc_camp: orcCamp as AreaConfig,
  royal_capital: royalCapital as AreaConfig,
  slime_cave: slimeCave as AreaConfig,
  subjugation_force: subjugationForce as AreaConfig,
  troll_canyon: trollCanyon as AreaConfig,
  undead_ruins: undeadRuins as AreaConfig,
}

export function getAreaConfig(areaId: string): AreaConfig | null {
  return areaDatabases[areaId] ?? null
}
