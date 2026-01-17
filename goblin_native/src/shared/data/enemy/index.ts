import type { EnemyDatabase } from '../../types'

import forestOutskirts from './forest_outskirts.json'
import goblinVillage from './goblin_village.json'
import orcCamp from './orc_camp.json'
import slimeCave from './slime_cave.json'

const enemyDatabases: Record<string, EnemyDatabase> = {
  forest_outskirts: forestOutskirts as EnemyDatabase,
  goblin_village: goblinVillage as EnemyDatabase,
  orc_camp: orcCamp as EnemyDatabase,
  slime_cave: slimeCave as EnemyDatabase,
}

export function getEnemyDatabase(areaId: string): EnemyDatabase | null {
  return enemyDatabases[areaId] ?? null
}
