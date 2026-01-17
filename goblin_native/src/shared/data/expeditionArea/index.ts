import type { AreaConfig } from '../../types'

import forestOutskirts from './forest_outskirts.json'
import goblinVillage from './goblin_village.json'
import orcCamp from './orc_camp.json'
import slimeCave from './slime_cave.json'

const areaDatabases: Record<string, AreaConfig> = {
  forest_outskirts: forestOutskirts as AreaConfig,
  goblin_village: goblinVillage as AreaConfig,
  orc_camp: orcCamp as AreaConfig,
  slime_cave: slimeCave as AreaConfig,
}

export function getAreaConfig(areaId: string): AreaConfig | null {
  return areaDatabases[areaId] ?? null
}
