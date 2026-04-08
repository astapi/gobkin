/**
 * SQLiteスキーマ定義
 * 各テーブルのCREATE文を定義
 */

export const SCHEMA = {
  goblins: `
    CREATE TABLE IF NOT EXISTS goblins (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      race TEXT NOT NULL,
      job_id TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      experience INTEGER NOT NULL DEFAULT 0,
      avatar TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      effective_stats_json TEXT,
      factors_json TEXT,
      variant_factor_id TEXT,
      individual_value INTEGER DEFAULT 1,
      mods_json TEXT,
      skills_json TEXT NOT NULL DEFAULT '[]',
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
      job_id TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      experience INTEGER NOT NULL DEFAULT 0,
      avatar TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      effective_stats_json TEXT,
      factors_json TEXT,
      variant_factor_id TEXT,
      individual_value INTEGER DEFAULT 1,
      mods_json TEXT,
      skills_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,

  parties: `
    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      member_ids_json TEXT NOT NULL,
      status TEXT DEFAULT 'idle',
      dungeon_id TEXT,
      target_floor INTEGER,
      return_policy TEXT,
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
    INSERT OR IGNORE INTO goblins (id, name, race, level, experience, avatar, stats_json, skills_json)
    VALUES
      (0, 'グラッシュ', 'ゴブリン', 1, 0, '/src/assets/goblin/goblin.png', '{"hp":68,"atk":13,"sp":10,"spd":11,"def":11,"attackCount":2,"accuracy":160,"evasion":15}', '[]')
  `,
}
