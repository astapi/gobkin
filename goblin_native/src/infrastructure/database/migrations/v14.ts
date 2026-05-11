import type * as SQLite from 'expo-sqlite'
import { getDefaultSkillsForRace } from '../../../shared/data/raceSkills'
import { founderGoblinSeed } from '../../../shared/data/founderGoblin'

/**
 * v14: 最初のゴブリンを始祖ゴブリン「マルク」として固定する
 */
export const migrateV14 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.runAsync(
    `UPDATE goblins
     SET name = ?,
         race = ?,
         race_id = ?,
         avatar = ?,
         skills_json = ?,
         effective_stats_json = NULL,
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      founderGoblinSeed.name,
      founderGoblinSeed.race,
      founderGoblinSeed.raceId,
      founderGoblinSeed.avatar,
      JSON.stringify(getDefaultSkillsForRace(founderGoblinSeed.raceId)),
      founderGoblinSeed.id,
    ],
  )
}
