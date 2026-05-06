import type * as SQLite from 'expo-sqlite'

/**
 * v15: MODシステム廃止に伴い、ゴブリン保存テーブルからmods_jsonを撤去する
 */
export const migrateV15 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await recreateGoblinsTable(database, 'goblins', true)
  await recreateGoblinsTable(database, 'pending_goblins', false)
}

const recreateGoblinsTable = async (
  database: SQLite.SQLiteDatabase,
  tableName: 'goblins' | 'pending_goblins',
  hasUpdatedAt: boolean,
): Promise<void> => {
  const tempTable = `${tableName}_v15`
  const timestampColumns = hasUpdatedAt
    ? ', created_at, updated_at'
    : ', created_at'
  const timestampDefinitions = hasUpdatedAt
    ? `,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
    : `,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))`

  await database.runAsync(`
    CREATE TABLE IF NOT EXISTS ${tempTable} (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      race TEXT NOT NULL,
      race_id TEXT,
      job_id TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      experience INTEGER NOT NULL DEFAULT 0,
      avatar TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      ${hasUpdatedAt ? 'current_hp INTEGER,' : ''}
      effective_stats_json TEXT,
      factors_json TEXT,
      variant_factor_id TEXT,
      individual_value INTEGER DEFAULT 1,
      skills_json TEXT NOT NULL DEFAULT '[]',
      battle_action_policy_json TEXT${timestampDefinitions}
    )
  `)

  const currentHpColumns = hasUpdatedAt ? ', current_hp' : ''

  await database.runAsync(`
    INSERT INTO ${tempTable} (
      id, name, race, race_id, job_id, level, experience, avatar, stats_json${currentHpColumns},
      effective_stats_json, factors_json, variant_factor_id, individual_value,
      skills_json, battle_action_policy_json${timestampColumns}
    )
    SELECT
      id, name, race, race_id, job_id, level, experience, avatar, stats_json${currentHpColumns},
      effective_stats_json, factors_json, variant_factor_id, individual_value,
      skills_json, battle_action_policy_json${timestampColumns}
    FROM ${tableName}
  `)

  await database.runAsync(`DROP TABLE ${tableName}`)
  await database.runAsync(`ALTER TABLE ${tempTable} RENAME TO ${tableName}`)
}
