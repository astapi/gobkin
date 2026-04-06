import type * as SQLite from 'expo-sqlite'
import { getDefaultSkillsForRace } from '../../../shared/data/raceSkills'

async function addSkillsColumn(database: SQLite.SQLiteDatabase, table: string): Promise<void> {
  try {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN skills_json TEXT NOT NULL DEFAULT '[]'`)
  } catch {
    // 既に列がある場合は何もしない
  }
}

async function backfillSkills(database: SQLite.SQLiteDatabase, table: string): Promise<void> {
  const rows = await database.getAllAsync<{ id: number; race: string; skills_json: string | null }>(
    `SELECT id, race, skills_json FROM ${table}`
  )

  for (const row of rows) {
    if (row.skills_json && row.skills_json !== '[]') continue
    await database.runAsync(
      `UPDATE ${table} SET skills_json = ? WHERE id = ?`,
      [JSON.stringify(getDefaultSkillsForRace(row.race)), row.id]
    )
  }
}

export const migrateV2 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await addSkillsColumn(database, 'goblins')
  await addSkillsColumn(database, 'pending_goblins')
  await backfillSkills(database, 'goblins')
  await backfillSkills(database, 'pending_goblins')
}
