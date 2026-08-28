/**
 * SQLiteスキーマ定義
 * 各テーブルのCREATE文を定義
 */
import { founderGoblinSeed } from '../../shared/data/founderGoblin'

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`

export const SCHEMA = {
  goblins: `
    CREATE TABLE IF NOT EXISTS goblins (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      race TEXT NOT NULL,
      race_id TEXT,
      job_id TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      experience INTEGER NOT NULL DEFAULT 0,
      avatar TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      current_hp INTEGER,
      effective_stats_json TEXT,
      factors_json TEXT,
      variant_factor_id TEXT,
      individual_value INTEGER DEFAULT 1,
      plus_value INTEGER NOT NULL DEFAULT 0,
      skills_json TEXT NOT NULL DEFAULT '[]',
      battle_action_policy_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,

  goblinsIndexes: `
    CREATE INDEX IF NOT EXISTS idx_goblins_level ON goblins(level);
    CREATE INDEX IF NOT EXISTS idx_goblins_race ON goblins(race)
  `,

  pendingGoblins: `
    CREATE TABLE IF NOT EXISTS pending_goblins (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      race TEXT NOT NULL,
      race_id TEXT,
      job_id TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      experience INTEGER NOT NULL DEFAULT 0,
      avatar TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      current_hp INTEGER,
      effective_stats_json TEXT,
      factors_json TEXT,
      variant_factor_id TEXT,
      individual_value INTEGER DEFAULT 1,
      plus_value INTEGER NOT NULL DEFAULT 0,
      skills_json TEXT NOT NULL DEFAULT '[]',
      battle_action_policy_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,

  goblinBirthSlots: `
    CREATE TABLE IF NOT EXISTS goblin_birth_slots (
      slot_index INTEGER PRIMARY KEY CHECK (slot_index >= 1),
      source_goblin_id INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      cycle_started_at TEXT,
      next_birth_at TEXT,
      capacity_paused_at TEXT,
      source_snapshots_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,

  parties: `
    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      member_ids_json TEXT NOT NULL,
      status TEXT DEFAULT 'idle',
      dungeon_id TEXT,
      dungeon_tier INTEGER NOT NULL DEFAULT 0,
      target_floor INTEGER,
      return_policy TEXT,
      gold_multiplier REAL NOT NULL DEFAULT 1.0,
      rare_multiplier REAL NOT NULL DEFAULT 1.0,
      title_multiplier REAL NOT NULL DEFAULT 1.0,
      auto_expedition_enabled INTEGER NOT NULL DEFAULT 0,
      auto_expedition_session_id TEXT,
      auto_expedition_summary_json TEXT,
      auto_expedition_date TEXT,
      auto_expedition_used_sec INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,

  partiesIndex: `
    CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status)
  `,

  expeditions: `
    CREATE TABLE IF NOT EXISTS expeditions (
      id TEXT PRIMARY KEY,
      party_id INTEGER NOT NULL,
      party_name TEXT NOT NULL,
      dungeon_id TEXT NOT NULL,
      dungeon_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      return_time TEXT,
      status TEXT NOT NULL DEFAULT 'ongoing',
      return_policy TEXT NOT NULL,
      replay_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (party_id) REFERENCES parties(id)
    )
  `,

  expeditionsIndexes: `
    CREATE INDEX IF NOT EXISTS idx_expeditions_party_id ON expeditions(party_id);
    CREATE INDEX IF NOT EXISTS idx_expeditions_status ON expeditions(status);
    CREATE INDEX IF NOT EXISTS idx_expeditions_created_at ON expeditions(created_at)
  `,

  baseState: `
    CREATE TABLE IF NOT EXISTS base_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      capacity INTEGER NOT NULL DEFAULT 10,
      rank INTEGER NOT NULL DEFAULT 1,
      captured_dungeons_json TEXT NOT NULL DEFAULT '[]',
      current_max_parties INTEGER NOT NULL DEFAULT 1,
      current_max_goblins INTEGER NOT NULL DEFAULT 10,
      current_iv_bonus INTEGER NOT NULL DEFAULT 0,
      gold INTEGER NOT NULL DEFAULT 0,
      next_goblin_id INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,

  baseStateInit: `
    INSERT OR IGNORE INTO base_state (
      id, capacity, rank, captured_dungeons_json,
      current_max_parties, current_max_goblins, current_iv_bonus, gold
    ) VALUES (1, 10, 1, '[]', 1, 10, 0, 500)
  `,

  dungeonProgress: `
    CREATE TABLE IF NOT EXISTS dungeon_progress (
      dungeon_id TEXT PRIMARY KEY,
      unlocked INTEGER NOT NULL DEFAULT 0,
      cleared INTEGER NOT NULL DEFAULT 0,
      unlock_notified INTEGER NOT NULL DEFAULT 0,
      max_cleared_tier INTEGER NOT NULL DEFAULT 0,
      cleared_floors_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,

  appMetadata: `
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `,

  equipment: `
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL DEFAULT -1,
      goblin_id INTEGER,
      title_id TEXT,
      title_name TEXT,
      prefix_mod_json TEXT,
      suffix_mod_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (goblin_id) REFERENCES goblins(id) ON DELETE SET NULL
    )
  `,

  equipmentIndex: `
    CREATE INDEX IF NOT EXISTS idx_equipment_goblin_id ON equipment(goblin_id)
  `,

  appMetadataInit: `
    INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '1')
  `,

  goblinsInit: `
    INSERT OR IGNORE INTO goblins (id, name, race, race_id, level, experience, avatar, stats_json, skills_json)
    VALUES
      (${founderGoblinSeed.id}, ${sqlString(founderGoblinSeed.name)}, ${sqlString(founderGoblinSeed.race)}, ${sqlString(founderGoblinSeed.raceId)}, ${founderGoblinSeed.level}, ${founderGoblinSeed.experience}, ${sqlString(founderGoblinSeed.avatar)}, ${sqlString(JSON.stringify(founderGoblinSeed.stats))}, '[]')
  `,
}
