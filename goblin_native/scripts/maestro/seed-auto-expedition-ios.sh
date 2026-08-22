#!/bin/sh
set -eu

app_id='com.astapi.gobkin'
data_container="$(xcrun simctl get_app_container booted "$app_id" data)"
database_path="$(find "$data_container" -name 'goblin_kingdom.db' -type f -print -quit)"

if [ -z "$database_path" ]; then
  echo 'goblin_kingdom.db が見つかりません。アプリを一度起動してください。' >&2
  exit 1
fi

sqlite3 "$database_path" <<'SQL'
INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('tutorial_step', 'completed');

DELETE FROM expeditions;
DELETE FROM pending_goblins;

UPDATE dungeon_progress
SET unlocked = 1,
    cleared = 1,
    max_cleared_tier = 1,
    cleared_floors_json = '{"0":3}',
    updated_at = datetime('now')
WHERE dungeon_id = 'slime_cave';

INSERT OR REPLACE INTO parties (
  id, name, member_ids_json, status, dungeon_id, dungeon_tier, target_floor,
  return_policy, gold_multiplier, rare_multiplier, title_multiplier,
  auto_expedition_enabled, auto_expedition_date, auto_expedition_used_sec,
  updated_at
) VALUES (
  1, 'PT1', (SELECT '[' || id || ']' FROM goblins ORDER BY id LIMIT 1), 'idle', 'slime_cave', 0, NULL,
  'never', 1.0, 1.0, 1.0,
  0, NULL, 0,
  datetime('now')
);

UPDATE goblins
SET current_hp = 0, updated_at = datetime('now')
WHERE id = (SELECT id FROM goblins ORDER BY id LIMIT 1);
SQL

echo "Maestro用データを投入しました: $database_path"
