import type * as SQLite from 'expo-sqlite'
import { getDefaultSkillsForRace } from '../../../shared/data/raceSkills'

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
      'マルク',
      '始祖ゴブリン',
      'founder',
      '/src/assets/goblin/marku.png',
      JSON.stringify(getDefaultSkillsForRace('founder')),
      0,
    ],
  )
}
