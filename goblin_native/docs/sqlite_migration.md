# SQLite データ永続化設計書

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [project_structure.md](./project_structure.md) | ディレクトリ構成・責務一覧 |
| [screen_reference.md](./screen_reference.md) | 画面リファレンス |
| [game_design_overview.md](./game_design_overview.md) | ゲーム仕様総合ドキュメント |

## 概要

goblin_native はローカルデータ永続化に **SQLite（expo-sqlite）** を採用しています。オフライン優先で動作し、Firebase は認証（Firebase Auth）と将来のクラウド同期向けに設定のみ残しています。

- スキーマ定義: [`src/infrastructure/database/schema.ts`](/Users/astapi/projects/goblinKingdom/goblin_native/src/infrastructure/database/schema.ts)
- 初期化・マイグレーション: [`src/infrastructure/database/index.ts`](/Users/astapi/projects/goblinKingdom/goblin_native/src/infrastructure/database/index.ts)
- マイグレーション: `src/infrastructure/database/migrations/v1.ts` 〜 `v16.ts`
- リポジトリ実装: `src/infrastructure/repositories/SQLite*.ts`

> **現行スキーマバージョン: 16**（`CURRENT_SCHEMA_VERSION = 16`）。新規インストールは `schema.ts` で最新形を作成し、既存DBは差分マイグレーションで追従します。

---

## テーブル一覧

| テーブル | 主キー | 役割 | 定義元 |
|---------|--------|------|--------|
| `goblins` | `id` | 拠点所属ゴブリン | schema.ts |
| `pending_goblins` | `id` | 産まれた（受け入れ待ち）ゴブリン | schema.ts |
| `parties` | `id` | パーティ編成・遠征設定 | schema.ts |
| `expeditions` | `id`(TEXT) | 遠征記録（メタ/リプレイ） | schema.ts + v9 |
| `base_state` | `id`(=1) | 拠点状態（シングルトン行） | schema.ts |
| `dungeon_progress` | `dungeon_id` | ダンジョン解放/踏破/Tier進捗 | schema.ts |
| `equipment` | `id`(TEXT) | 装備インスタンス | schema.ts |
| `tickets` | `ticket_type` | 課金/特殊チケット在庫 | v11 |
| `story_progress` | `story_id` | ストーリー解放/既読 | v12 |
| `app_metadata` | `key` | スキーマVer・チュートリアル進捗など | schema.ts |

> チュートリアル進捗は専用テーブルではなく `app_metadata`（`key = 'tutorial_step'`）に保存されます（`SQLiteTutorialStateRepository`）。

---

## スキーマ詳細

`CREATE TABLE IF NOT EXISTS` を前提に、現行カラムを記載します（実体は `schema.ts` 参照）。

### 1. goblins / pending_goblins

両テーブルはほぼ同形（`pending_goblins` は `updated_at` を持たない）。

```sql
CREATE TABLE IF NOT EXISTS goblins (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  race TEXT NOT NULL,
  race_id TEXT,                                   -- 種族ID（goblin / slime / wolf ... 亜種判定）
  job_id TEXT,                                    -- ジョブ（guard / mage ...）
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  avatar TEXT NOT NULL,
  stats_json TEXT NOT NULL,                       -- 基礎ステータス
  current_hp INTEGER,                             -- 負傷管理（現在HP）
  effective_stats_json TEXT,                      -- 因子/装備/スキル適用後の実効ステータス
  factors_json TEXT,                              -- string[]（獲得因子）
  variant_factor_id TEXT,                         -- 亜種化の元因子
  individual_value INTEGER DEFAULT 1,             -- 個体値（1〜64）
  skills_json TEXT NOT NULL DEFAULT '[]',         -- CharacterSkill[]
  battle_action_policy_json TEXT,                 -- 戦闘行動方針
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_goblins_level ON goblins(level);
CREATE INDEX IF NOT EXISTS idx_goblins_race  ON goblins(race);
```

初期データとして founder（始祖）ゴブリンを `INSERT OR IGNORE` で投入します。

### 2. parties

```sql
CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  member_ids_json TEXT NOT NULL,                  -- number[]
  status TEXT DEFAULT 'idle',                     -- 'idle' | 'expedition'
  dungeon_id TEXT,
  dungeon_tier INTEGER NOT NULL DEFAULT 0,        -- 選択中Tier（0〜5）
  target_floor INTEGER,
  return_policy TEXT,                             -- never / if_any_ko / if_two_ko / last_one
  gold_multiplier  REAL NOT NULL DEFAULT 1.0,     -- パーティ報酬倍率
  rare_multiplier  REAL NOT NULL DEFAULT 1.0,
  title_multiplier REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status);
```

### 3. expeditions

```sql
CREATE TABLE IF NOT EXISTS expeditions (
  id TEXT PRIMARY KEY,
  party_id INTEGER NOT NULL,
  party_name TEXT NOT NULL,
  dungeon_id TEXT NOT NULL,
  dungeon_name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  return_time TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing',         -- ongoing / completed / failed
  return_policy TEXT NOT NULL,
  replay_json TEXT,                               -- ExpeditionReplay（再計算結果）
  expedition_meta_json TEXT,                      -- ExpeditionMeta（遅延計算用 seed 等, v9 で追加）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

CREATE INDEX IF NOT EXISTS idx_expeditions_party_id   ON expeditions(party_id);
CREATE INDEX IF NOT EXISTS idx_expeditions_status     ON expeditions(status);
CREATE INDEX IF NOT EXISTS idx_expeditions_created_at ON expeditions(created_at);
```

> `expedition_meta_json` に seed と遠征リクエストを保持し、`LazyExpeditionComputer` が後から `replay` を確定計算します（決定論シミュレーション）。

### 4. base_state（シングルトン）

```sql
CREATE TABLE IF NOT EXISTS base_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  capacity INTEGER NOT NULL DEFAULT 10,
  rank INTEGER NOT NULL DEFAULT 1,
  captured_dungeons_json TEXT NOT NULL DEFAULT '[]',  -- 制圧済みダンジョンID[]
  current_max_parties INTEGER NOT NULL DEFAULT 1,
  current_max_goblins INTEGER NOT NULL DEFAULT 10,
  current_iv_bonus INTEGER NOT NULL DEFAULT 0,        -- 個体値ボーナス
  gold INTEGER NOT NULL DEFAULT 0,
  next_goblin_id INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初期行（gold は 500 で開始）
INSERT OR IGNORE INTO base_state (
  id, capacity, rank, captured_dungeons_json,
  current_max_parties, current_max_goblins, current_iv_bonus, gold
) VALUES (1, 10, 1, '[]', 1, 10, 0, 500);
```

### 5. dungeon_progress

```sql
CREATE TABLE IF NOT EXISTS dungeon_progress (
  dungeon_id TEXT PRIMARY KEY,
  unlocked INTEGER NOT NULL DEFAULT 0,            -- BOOLEAN
  cleared INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN
  unlock_notified INTEGER NOT NULL DEFAULT 0,     -- 解放通知済み
  max_cleared_tier INTEGER NOT NULL DEFAULT 0,    -- 制圧済み最高Tier（v8 で追加）
  cleared_floors_json TEXT NOT NULL DEFAULT '{}', -- Tier別の到達フロア（v10 で追加）
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 6. equipment

```sql
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,                      -- equipmentPool.json のテンプレID
  slot_index INTEGER NOT NULL DEFAULT -1,         -- 装着スロット（-1 = 在庫）
  goblin_id INTEGER,                              -- 装着先（NULL = 在庫）
  title_id TEXT,                                  -- 称号ID
  title_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (goblin_id) REFERENCES goblins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_equipment_goblin_id ON equipment(goblin_id);
```

### 7. tickets（v11）

```sql
CREATE TABLE IF NOT EXISTS tickets (
  ticket_type TEXT PRIMARY KEY,                   -- 例: golden_acorn
  quantity INTEGER NOT NULL DEFAULT 0
);
```

### 8. story_progress（v12）

```sql
CREATE TABLE IF NOT EXISTS story_progress (
  story_id TEXT PRIMARY KEY,
  unlocked INTEGER NOT NULL DEFAULT 0,
  read INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 9. app_metadata

```sql
CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '1');
```

用途: `schema_version`（マイグレーション管理）、`tutorial_step`（チュートリアル進捗）など。

---

## マイグレーション

`src/infrastructure/database/index.ts` がスキーマバージョンを比較し、`migrations/v{n}.ts` を順次適用します。各マイグレーションは「既に列がある場合は何もしない」など冪等性に配慮しています。

主な変更履歴（抜粋）:

| バージョン | 主な内容 |
|-----------|---------|
| v1 | 初期スキーマ |
| v8 | `dungeon_progress.max_cleared_tier` 追加 |
| v9 | `expeditions.expedition_meta_json` 追加（遅延計算メタ） |
| v10 | `dungeon_progress.cleared_floors_json` 追加 |
| v11 | `tickets` テーブル追加 |
| v12 | `story_progress` テーブル追加 |
| v13 | goblins/pending_goblins に `job_id` / `skills_json` 追加 |
| v14 | `battle_action_policy_json` 追加 |
| v15 | テーブル再構築（temp テーブル経由のスキーマ変更） |
| v16 | goblins/pending_goblins に `current_hp` / `race_id` 追加 |

> 正確な内容は各 `migrations/v{n}.ts` を参照してください。`parties` の報酬倍率カラムや `dungeon_tier` なども段階的に追加されています。

---

## リポジトリ実装パターン

全 SQLite リポジトリは共通の設計原則に従います。

1. **シングルトン**: `getInstance()` で単一インスタンスを取得。
2. **内部キャッシュ**: 起動時 `initialize()` で DB から全件ロードし `Map` に保持。
3. **同期的読み取り**: 画面からはキャッシュを同期 API で参照（`getGoblins()` 等）。
4. **非同期書き込み**: 書き込みはキャッシュを即時更新し、DB へは非同期反映。
5. **変更通知**: `setOnDataChange()` のコールバックで store / 画面へ再描画を通知。

### データベース初期化（`database/index.ts`）

```typescript
const DB_NAME = 'goblin_kingdom.db'
export const CURRENT_SCHEMA_VERSION = 16

let db: SQLite.SQLiteDatabase | null = null
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db
  if (initializationPromise) return initializationPromise   // 重複初期化防止
  initializationPromise = initializeDatabase()
  return initializationPromise
}
// initializeDatabase 内で openDatabaseAsync → スキーマ作成 → runMigrations を実行
```

### アプリ起動時の初期化（`app/_layout.tsx`）

1. `getDatabase()` で DB を開きスキーマ生成＋マイグレーション。
2. 各 SQLite リポジトリの `initialize()` を並列実行しキャッシュを温める。
3. 各 Zustand ストアがリポジトリからメモリ状態を構築。
4. 完了までローディング／スプラッシュ表示。

### 主なリポジトリ

`SQLiteGoblinRepository` / `SQLitePartyRepository` / `SQLiteBaseStateRepository` /
`SQLiteExpeditionRepository` / `SQLitePendingGoblinRepository` / `SQLiteDungeonProgressRepository` /
`SQLiteEquipmentRepository` / `SQLiteStoryProgressRepository` / `SQLiteTutorialStateRepository` / `SQLiteTicketRepository`

---

## セーブデータの入出力

`src/infrastructure/backup/` がセーブデータのエクスポート／インポートを担います。

- `SaveDataExporter.ts` / `SaveDataImporter.ts`: 各テーブルを集約した JSON の生成と取り込み。
- `BackupFileService.ts`: ファイル入出力。
- `BackupSignature.ts`: 改ざん検出用の署名。
- 画面側は `useSaveDataBackup`（hook）から利用（設定画面）。

---

## 設計上の考慮事項

### JSON 格納を選択した理由
- `stats` / `factors` / `skills` / `replay` などネストした構造や配列は正規化すると JOIN が複雑化するため、JSON 文字列で格納。
- SQLite 3.38+ の JSON 関数で必要に応じてクエリ可能。

### トレードオフ

| 項目 | JSON格納 | 正規化 |
|------|----------|--------|
| 実装の容易さ | 高い | 低い |
| クエリの柔軟性 | 低い | 高い |
| スキーマ変更 | 容易 | 困難 |
| データ整合性 | アプリ依存 | DB保証 |

現状は JSON 格納で運用し、パフォーマンス問題が出た場合に部分的な正規化を検討します。

### 将来のクラウド同期
Firebase は認証用途に加え、将来のクラウド同期を見据えて設定を残しています。同期を導入する場合は「ローカル SQLite ＝ キャッシュ」「クラウド ＝ マスター」「オフライン時はローカル読み取り、復帰時に同期」という構成を想定します。

---

## 参考資料
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [SQLite JSON Functions](https://www.sqlite.org/json1.html)
