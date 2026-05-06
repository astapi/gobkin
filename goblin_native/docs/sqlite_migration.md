# SQLite移行設計書

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| **[implementation_guide.md](./implementation_guide.md)** | 実装順序ガイド（推奨） |
| [migration_tasks.md](./migration_tasks.md) | 移行タスク一覧・UI実装詳細 |
| [project_structure.md](./project_structure.md) | ディレクトリ構成・責務一覧 |
| [screen_reference.md](./screen_reference.md) | 画面リファレンス |

## 概要

React Native版（goblin_native）では、Web版（goblin_web）で使用していたFirestoreをSQLiteに置き換えます。
これにより、オフライン優先のローカルデータ永続化を実現します。

> **注意**: Firestoreは将来的な機能（マルチプレイヤー、クラウド同期など）で使用予定のため、SDKの設定は残しておきます。

## Web版（Firestore）のデータ構造

### コレクション構成

```
users/
├── {userId}/
│   ├── baseState: { capacity, rank }           // ユーザードキュメント内フィールド
│   ├── dungeonProgress: { [id]: {...} }        // ユーザードキュメント内フィールド
│   ├── goblins/                                // サブコレクション
│   │   └── {goblinId}/ → Goblin
│   ├── parties/                                // サブコレクション
│   │   └── {partyId}/ → Party
│   ├── expeditions/                            // サブコレクション
│   │   └── {expeditionId}/ → ExpeditionRecord
│   └── pendingGoblins/                         // サブコレクション
│       └── {goblinId}/ → Goblin
```

### エンティティ定義

#### Goblin
```typescript
type Goblin = {
  id: number
  name: string
  race: string
  level: number
  experience: number
  avatar: string
  stats: GoblinStats      // { hp, atk, def, attackCount, accuracy, evasion }
  effectiveStats?: GoblinStats
  factors?: string[]
  variantFactorId?: string
  individualValue?: number
}
```

#### Party
```typescript
type Party = {
  id: number
  name: string
  memberIds: number[]
  status?: "idle" | "expedition"
  dungeonId?: string
  targetFloor?: number | null
  returnPolicy?: string
}
```

#### ExpeditionRecord
```typescript
type ExpeditionRecord = {
  id: string
  userId: string
  partyId: number
  partyName: string
  dungeonId: string
  dungeonName: string
  startTime: Date
  returnTime: Date
  status: 'ongoing' | 'completed' | 'failed'
  returnPolicy: string
  replay?: ExpeditionReplay  // 大きなJSONオブジェクト
  createdAt: Date
  updatedAt: Date
}
```

#### BaseState
```typescript
type BaseState = {
  capacity: number
  rank: number
}
```

#### DungeonProgress
```typescript
type DungeonProgressState = Record<string, {
  unlocked: boolean
  cleared: boolean
  unlockNotified: boolean  // アンロック通知済みフラグ
}>
```

---

## SQLiteスキーマ設計

### テーブル定義

#### 1. goblins テーブル
```sql
CREATE TABLE goblins (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  race TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  avatar TEXT NOT NULL,
  -- stats（正規化せずJSON格納）
  stats_json TEXT NOT NULL,
  -- オプショナルフィールド
  effective_stats_json TEXT,
  factors_json TEXT,           -- string[] をJSON格納
  variant_factor_id TEXT,
  individual_value INTEGER DEFAULT 1,
  -- メタデータ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_goblins_level ON goblins(level);
CREATE INDEX idx_goblins_race ON goblins(race);
```

#### 2. pending_goblins テーブル
```sql
CREATE TABLE pending_goblins (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  race TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  avatar TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  effective_stats_json TEXT,
  factors_json TEXT,
  variant_factor_id TEXT,
  individual_value INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 3. parties テーブル
```sql
CREATE TABLE parties (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  member_ids_json TEXT NOT NULL,  -- number[] をJSON格納
  status TEXT DEFAULT 'idle',
  dungeon_id TEXT,
  target_floor INTEGER,
  return_policy TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_parties_status ON parties(status);
```

#### 4. expeditions テーブル
```sql
CREATE TABLE expeditions (
  id TEXT PRIMARY KEY,
  party_id INTEGER NOT NULL,
  party_name TEXT NOT NULL,
  dungeon_id TEXT NOT NULL,
  dungeon_name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  return_time TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing',
  return_policy TEXT NOT NULL,
  replay_json TEXT,              -- ExpeditionReplay をJSON格納
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

CREATE INDEX idx_expeditions_party_id ON expeditions(party_id);
CREATE INDEX idx_expeditions_status ON expeditions(status);
CREATE INDEX idx_expeditions_created_at ON expeditions(created_at);
```

#### 5. base_state テーブル
```sql
CREATE TABLE base_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- シングルトン
  capacity INTEGER NOT NULL DEFAULT 8,
  rank INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初期データ挿入
INSERT OR IGNORE INTO base_state (id, capacity, rank) VALUES (1, 8, 1);
```

#### 6. dungeon_progress テーブル
```sql
CREATE TABLE dungeon_progress (
  dungeon_id TEXT PRIMARY KEY,
  unlocked INTEGER NOT NULL DEFAULT 0,        -- BOOLEAN
  cleared INTEGER NOT NULL DEFAULT 0,         -- BOOLEAN
  unlock_notified INTEGER NOT NULL DEFAULT 0, -- BOOLEAN（アンロック通知済みフラグ）
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 7. app_metadata テーブル（マイグレーション管理用）
```sql
CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- スキーマバージョン管理
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '1');
```

---

## リポジトリ実装設計

### ファイル構成

```
src/infrastructure/
├── database/
│   ├── index.ts                    # DB初期化・マイグレーション
│   ├── schema.ts                   # スキーマ定義
│   └── migrations/
│       └── v1.ts                   # 初期スキーマ
└── repositories/
    ├── SQLiteGoblinRepository.ts
    ├── SQLitePartyRepository.ts
    ├── SQLiteExpeditionRepository.ts
    ├── SQLitePendingGoblinRepository.ts
    ├── SQLiteBaseStateRepository.ts
    └── SQLiteDungeonProgressRepository.ts
```

### 依存パッケージ

```bash
npx expo install expo-sqlite
```

### データベース初期化

```typescript
// src/infrastructure/database/index.ts
import * as SQLite from 'expo-sqlite'

const DB_NAME = 'goblin_kingdom.db'
const CURRENT_SCHEMA_VERSION = 2

let db: SQLite.SQLiteDatabase | null = null
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null

/**
 * データベース接続を取得
 * シングルトンパターンで同一インスタンスを返す
 */
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db

  // 初期化中の場合は同じPromiseを返す（重複初期化防止）
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = initializeDatabase()
  return initializationPromise
}

const initializeDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  const database = await SQLite.openDatabaseAsync(DB_NAME)
  await runMigrations(database)
  db = database
  return database
}

const runMigrations = async (database: SQLite.SQLiteDatabase) => {
  // マイグレーション実行ロジック
}
```

### アプリ起動時の初期化

```typescript
// app/_layout.tsx
import { getDatabase } from '@/infrastructure/database'
import { SQLiteGoblinRepository } from '@/infrastructure/repositories/SQLiteGoblinRepository'
import { SQLitePartyRepository } from '@/infrastructure/repositories/SQLitePartyRepository'
// ... 他のリポジトリ

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 第1段階: DBインスタンスの初期化（マイグレーション実行）
        await getDatabase()

        // 第2段階: 全リポジトリの初期化（キャッシュの初期化）
        await Promise.all([
          SQLiteGoblinRepository.getInstance().initialize(),
          SQLitePartyRepository.getInstance().initialize(),
          // ... 他のリポジトリ
        ])

        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize app:', error)
      }
    }
    initializeApp()
  }, [])

  if (!isInitialized) {
    return <LoadingScreen />
  }

  return <MainContent />
}
```

### リポジトリ実装例

全てのリポジトリは以下の設計原則に従います：

1. **シングルトンパターン**: `getInstance()` メソッドでインスタンスを取得
2. **内部キャッシュ**: `initialize()` でDBからデータをロードし、キャッシュに保持
3. **同期的インターフェース**: キャッシュを使用して同期的にデータを取得
4. **非同期保存**: 書き込みは非同期でDBに保存し、即座にキャッシュを更新

```typescript
// src/infrastructure/repositories/SQLiteGoblinRepository.ts
import type { Goblin } from '@/shared/types'
import type { IGoblinRepository } from '@/core/repositories/IGoblinRepository'
import { getDatabase } from '../database'

export class SQLiteGoblinRepository implements IGoblinRepository {
  private static instance: SQLiteGoblinRepository | null = null
  private cache: Map<number, Goblin> = new Map()
  private initialized = false
  private onDataChangeCallback: (() => void) | null = null

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): SQLiteGoblinRepository {
    if (!SQLiteGoblinRepository.instance) {
      SQLiteGoblinRepository.instance = new SQLiteGoblinRepository()
    }
    return SQLiteGoblinRepository.instance
  }

  /**
   * リポジトリを初期化し、DBからデータをロード
   * アプリ起動時に1回だけ実行される
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const db = await getDatabase()
    const rows = await db.getAllAsync<GoblinRow>('SELECT * FROM goblins ORDER BY id')

    this.cache.clear()
    for (const row of rows) {
      const goblin = this.rowToGoblin(row)
      this.cache.set(goblin.id, goblin)
    }

    this.initialized = true
  }

  /**
   * データ変更時のコールバックを設定
   */
  setOnDataChange(callback: () => void): void {
    this.onDataChangeCallback = callback
  }

  /**
   * 全ゴブリンを取得（同期的）
   */
  getGoblins(): Goblin[] {
    return Array.from(this.cache.values())
  }

  /**
   * 指定IDのゴブリンを取得（同期的）
   */
  getGoblin(id: number): Goblin | null {
    return this.cache.get(id) ?? null
  }

  /**
   * ゴブリンを保存
   * キャッシュを即座に更新し、DBへは非同期で保存
   */
  saveGoblin(goblin: Goblin): void {
    this.cache.set(goblin.id, goblin)

    this.saveAsync(goblin).catch(err => {
      console.error('[SQLiteGoblinRepository] Failed to save:', err)
    })

    this.notifyDataChange()
  }

  /**
   * ゴブリンを削除
   */
  deleteGoblin(id: number): void {
    this.cache.delete(id)

    this.deleteAsync(id).catch(err => {
      console.error('[SQLiteGoblinRepository] Failed to delete:', err)
    })

    this.notifyDataChange()
  }

  // --- Private methods ---

  private async saveAsync(goblin: Goblin): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO goblins
       (id, name, race, level, experience, avatar, stats_json,
        effective_stats_json, factors_json, variant_factor_id,
        individual_value, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        goblin.id,
        goblin.name,
        goblin.race,
        goblin.level,
        goblin.experience,
        goblin.avatar,
        JSON.stringify(goblin.stats),
        goblin.effectiveStats ? JSON.stringify(goblin.effectiveStats) : null,
        goblin.factors ? JSON.stringify(goblin.factors) : null,
        goblin.variantFactorId ?? null,
        goblin.individualValue ?? 1,
      ]
    )
  }

  private async deleteAsync(id: number): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM goblins WHERE id = ?', [id])
  }

  private rowToGoblin(row: GoblinRow): Goblin {
    return {
      id: row.id,
      name: row.name,
      race: row.race,
      level: row.level,
      experience: row.experience,
      avatar: row.avatar,
      stats: JSON.parse(row.stats_json),
      effectiveStats: row.effective_stats_json
        ? JSON.parse(row.effective_stats_json)
        : undefined,
      factors: row.factors_json ? JSON.parse(row.factors_json) : undefined,
      variantFactorId: row.variant_factor_id ?? undefined,
      individualValue: row.individual_value ?? undefined,
    }
  }

  private notifyDataChange(): void {
    if (this.onDataChangeCallback) {
      this.onDataChangeCallback()
    }
  }
}

interface GoblinRow {
  id: number
  name: string
  race: string
  level: number
  experience: number
  avatar: string
  stats_json: string
  effective_stats_json: string | null
  factors_json: string | null
  variant_factor_id: string | null
  individual_value: number | null
  created_at: string
  updated_at: string
}
```

---

## Firestore から SQLite への移行パス

### 新規インストール
SQLiteを直接使用。Firestoreからのデータ移行は不要。

### 既存Webユーザーのデータ移行（将来対応）
1. Firebase Auth でログイン
2. Firestore からデータをダウンロード
3. SQLite にインポート
4. ローカルデータとして継続使用

```typescript
// 将来実装予定: データインポート機能
export const importFromFirestore = async (userId: string) => {
  // 1. Firestoreからデータ取得
  // 2. SQLiteに保存
  // 3. インポート完了フラグを立てる
}
```

---

## 設計上の考慮事項

### JSON格納を選択した理由

1. **stats, factors**: ネストしたオブジェクトや配列であり、正規化するとJOINが複雑化
2. **replay_json**: 大きなイベントログであり、そのまま格納が効率的
3. **SQLiteのJSON関数**: SQLite 3.38.0以降でJSON関数がサポートされており、必要に応じてクエリ可能

### トレードオフ

| 項目 | JSON格納 | 正規化 |
|------|----------|--------|
| 実装の容易さ | 高い | 低い |
| クエリの柔軟性 | 低い | 高い |
| スキーマ変更 | 容易 | 困難 |
| データ整合性 | アプリ依存 | DB保証 |

現時点ではJSON格納で実装し、パフォーマンス問題が発生した場合に正規化を検討します。

### 将来のFirestore連携

```
[ローカルSQLite] ←→ [同期レイヤー] ←→ [Firestore]
```

将来的にクラウド同期機能を追加する場合:
1. 同期レイヤーを実装
2. SQLiteを「ローカルキャッシュ」として使用
3. Firestoreを「マスターデータ」として使用
4. オフライン時はSQLiteから読み取り、オンライン復帰時に同期

---

## 実装優先順位

1. **Phase 1**: データベース基盤
   - expo-sqlite インストール
   - スキーマ定義・マイグレーション
   - DB初期化ロジック

2. **Phase 2**: 基本リポジトリ
   - SQLiteGoblinRepository
   - SQLitePartyRepository
   - SQLiteBaseStateRepository
   - SQLiteDungeonProgressRepository

3. **Phase 3**: 遠征関連
   - SQLiteExpeditionRepository
   - SQLitePendingGoblinRepository

4. **Phase 4**: コンテキスト統合
   - 既存のhooks/contextをSQLiteリポジトリに接続
   - AsyncStorage実装の削除

---

## 削除対象ファイル

以下のAsyncStorage関連ファイルは不要となるため削除:

- `src/infrastructure/repositories/AsyncStorageGoblinRepository.ts`
- `src/infrastructure/repositories/AsyncStoragePartyRepository.ts`
- `src/presentation/hooks/useDungeonProgress.ts`（AsyncStorage使用版）

---

## 参考資料

- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [SQLite JSON Functions](https://www.sqlite.org/json1.html)
