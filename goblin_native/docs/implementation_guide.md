# React Native 移行 実装ガイド

このドキュメントは、goblin_native の実装を進める際の推奨順序と手順を記載しています。

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [migration_tasks.md](./migration_tasks.md) | 移行タスク一覧・差分・UI実装詳細 |
| [sqlite_migration.md](./sqlite_migration.md) | SQLiteスキーマ設計・Repository実装パターン |

---

## 実装フェーズ概要

```
Phase 1: SQLiteデータベース基盤        ← 最優先
Phase 2: 基本Repository実装
Phase 3: Hooks連携
Phase 4: 基本UI実装
Phase 5: 遠征機能
Phase 6: 拠点・モーダル
Phase 7: 将来対応（オプション）
```

---

## Phase 1: SQLiteデータベース基盤

**目的**: アプリのデータ永続化基盤を構築

**参照**: [sqlite_migration.md](./sqlite_migration.md)

### 1.1 expo-sqlite インストール

```bash
npx expo install expo-sqlite
```

### 1.2 データベース初期化モジュール

```
src/infrastructure/database/
├── index.ts          # DB接続・初期化
├── schema.ts         # テーブル定義
└── migrations/
    └── v1.ts         # 初期スキーマ
```

**実装ファイル**: `src/infrastructure/database/index.ts`

```typescript
import * as SQLite from 'expo-sqlite'

const DB_NAME = 'goblin_kingdom.db'
let db: SQLite.SQLiteDatabase | null = null

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db
  db = await SQLite.openDatabaseAsync(DB_NAME)
  await runMigrations(db)
  return db
}
```

### 1.3 スキーマ定義

**実装ファイル**: `src/infrastructure/database/schema.ts`

7テーブルを定義:
- `goblins`
- `pending_goblins`
- `parties`
- `expeditions`
- `base_state`
- `dungeon_progress`
- `app_metadata`

詳細なCREATE文は [sqlite_migration.md](./sqlite_migration.md) を参照。

### 1.4 マイグレーション実行

**実装ファイル**: `src/infrastructure/database/migrations/v1.ts`

```typescript
export const migrateV1 = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS goblins (...);
    CREATE TABLE IF NOT EXISTS parties (...);
    -- 他のテーブル
  `)
}
```

### 完了条件
- [ ] `expo-sqlite` インストール完了
- [ ] `getDatabase()` でDB接続可能
- [ ] 全7テーブル作成完了
- [ ] アプリ起動時にマイグレーション実行

---

## Phase 2: 基本Repository実装

**目的**: ゲームの基本データ（ゴブリン、パーティ、ダンジョン進行）を管理

**参照**: [sqlite_migration.md](./sqlite_migration.md) のリポジトリ実装例

### 2.1 SQLiteGoblinRepository

```
src/infrastructure/repositories/SQLiteGoblinRepository.ts
```

**インターフェース**: `IGoblinRepository`

| メソッド | 説明 |
|---------|------|
| `getAll()` | 全ゴブリン取得 |
| `getById(id)` | ID指定で取得 |
| `save(goblin)` | 保存（INSERT OR REPLACE） |
| `delete(id)` | 削除 |

### 2.2 SQLitePartyRepository

```
src/infrastructure/repositories/SQLitePartyRepository.ts
```

**インターフェース**: `IPartyRepository`

| メソッド | 説明 |
|---------|------|
| `getAll()` | 全パーティ取得 |
| `getById(id)` | ID指定で取得 |
| `save(party)` | 保存 |
| `delete(id)` | 削除 |

### 2.3 SQLiteDungeonProgressRepository

```
src/infrastructure/repositories/SQLiteDungeonProgressRepository.ts
```

| メソッド | 説明 |
|---------|------|
| `getAll()` | 全ダンジョン進行状況取得 |
| `getByDungeonId(id)` | 特定ダンジョンの状況取得 |
| `save(dungeonId, progress)` | 進行状況保存 |

### 完了条件
- [ ] SQLiteGoblinRepository 実装完了
- [ ] SQLitePartyRepository 実装完了
- [ ] SQLiteDungeonProgressRepository 実装完了
- [ ] 各Repositoryの単体テスト通過

---

## Phase 3: Hooks連携

**目的**: UI層からSQLite Repositoryを利用可能にする

**参照**: [migration_tasks.md](./migration_tasks.md) のContext/Hooks移行タスク

### 3.1 useGoblinService 修正

```typescript
// src/presentation/hooks/useGoblinService.ts
import { SQLiteGoblinRepository } from '@/infrastructure/repositories/SQLiteGoblinRepository'

const repository = new SQLiteGoblinRepository()

export const useGoblinService = () => {
  // AsyncStorage → SQLite に切り替え
}
```

### 3.2 usePartyService 修正

```typescript
// src/presentation/hooks/usePartyService.ts
import { SQLitePartyRepository } from '@/infrastructure/repositories/SQLitePartyRepository'
```

### 3.3 useDungeonProgress 修正

```typescript
// src/presentation/hooks/useDungeonProgress.ts
// AsyncStorage → SQLiteDungeonProgressRepository に切り替え
```

### 完了条件
- [ ] useGoblinService がSQLiteからデータ取得
- [ ] usePartyService がSQLiteからデータ取得
- [ ] useDungeonProgress がSQLiteからデータ取得
- [ ] サンプルデータを削除し、実データで動作確認

---

## Phase 4: 基本UI実装

**目的**: ゴブリン管理とパーティ編成のUI完成

**参照**: [migration_tasks.md](./migration_tasks.md) のUIコンポーネント移行タスク

### 4.1 GoblinDetailModal

**対応元**: `goblin_web/src/presentation/components/GoblinDetailModal.tsx` (290行)

機能:
- ゴブリン詳細表示
- ステータス表示
- 因子・Mod表示
- 装備管理

### 4.2 FormationScreen（完全版）

**対応元**: `goblin_web/src/presentation/components/FormationScreen.tsx` (279行)

機能:
- パーティ一覧表示
- 遠征履歴表示
- パーティ作成

### 4.3 PartyEditScreen（完全版）

**対応元**: `goblin_web/src/presentation/components/PartyEditScreen.tsx` (196行)

機能:
- パーティメンバー編集
- メンバー追加/削除

### 4.4 ExpeditionPreparationScreen（完全版）

**対応元**: `goblin_web/src/presentation/components/ExpeditionPreparationScreen.tsx` (331行)

機能:
- 遠征準備画面
- ダンジョン選択
- 帰還ポリシー設定
- 遠征開始

### 完了条件
- [ ] GoblinDetailModal 実装完了
- [ ] FormationScreen 完全実装
- [ ] PartyEditScreen 完全実装
- [ ] ExpeditionPreparationScreen 完全実装
- [ ] 画面遷移が正常に動作

---

## Phase 5: 遠征機能

**目的**: 遠征の実行・記録・表示機能を完成

### 5.1 追加Repository実装

```
src/infrastructure/repositories/
├── SQLiteExpeditionRepository.ts
├── SQLitePendingGoblinRepository.ts
└── SQLiteBaseStateRepository.ts
```

### 5.2 遠征関連Hooks

- `useExpeditionFlow` をSQLiteExpeditionRepositoryに接続
- `ExpeditionStateContext` を完全実装

### 5.3 遠征UI実装

| 画面 | 対応元行数 | 機能 |
|------|-----------|------|
| ExpeditionPlaybackScreen | 417行 | 遠征リアルタイム再生 |
| ExpeditionResultScreen | 162行 | 遠征結果表示 |
| ExpeditionLogScreen | 434行 | 遠征ログ詳細 |

### 完了条件
- [ ] SQLiteExpeditionRepository 実装完了
- [ ] SQLitePendingGoblinRepository 実装完了
- [ ] SQLiteBaseStateRepository 実装完了
- [ ] ExpeditionPlaybackScreen 実装完了（アニメーション含む）
- [ ] ExpeditionResultScreen 実装完了
- [ ] ExpeditionLogScreen 実装完了
- [ ] 遠征フロー全体が正常動作

---

## Phase 6: 拠点・モーダル

**目的**: 拠点管理と各種モーダルの実装

### 6.1 BaseManagementScreen

**対応元**: `goblin_web/src/presentation/components/BaseManagementScreen.tsx` (301行)

機能:
- 拠点状態表示
- ゴブリン受け入れ
- 拠点アップグレード

### 6.2 モーダル群

| モーダル | 行数 | 機能 |
|---------|------|------|
| DungeonSelectionModal | 83行 | ダンジョン選択 |
| DungeonConfirmModal | 63行 | ダンジョン確認 |
| ReturnPolicySelectionModal | 78行 | 帰還ポリシー選択 |
| FloorTargetSelectionModal | 59行 | 目標階層選択 |
| ExpeditionConfirmModal | 102行 | 遠征開始確認 |

### 6.3 共通コンポーネント

| コンポーネント | 行数 | 機能 |
|---------------|------|------|
| FactorBadge | 77行 | 因子バッジ表示 |
| GoblinCard | 27行 | ゴブリンカード |

### 完了条件
- [ ] BaseManagementScreen 実装完了
- [ ] 全モーダル実装完了
- [ ] 共通コンポーネント実装完了
- [ ] アプリ全体の機能テスト通過

---

## Phase 7: 将来対応（オプション）

### 7.1 Firestore同期レイヤー

```
[ローカルSQLite] ←→ [同期レイヤー] ←→ [Firestore]
```

- オフライン時はSQLiteから読み取り
- オンライン復帰時にFirestoreと同期
- クラウドバックアップ機能

### 7.2 プッシュ通知

- 遠征完了通知
- ゴブリン受け入れ待ち通知

---

## チェックリスト（全体）

### Phase 1: SQLiteデータベース基盤
- [ ] expo-sqlite インストール
- [ ] DB初期化モジュール
- [ ] スキーマ定義
- [ ] マイグレーション

### Phase 2: 基本Repository
- [ ] SQLiteGoblinRepository
- [ ] SQLitePartyRepository
- [ ] SQLiteDungeonProgressRepository

### Phase 3: Hooks連携
- [ ] useGoblinService
- [ ] usePartyService
- [ ] useDungeonProgress

### Phase 4: 基本UI
- [ ] GoblinDetailModal
- [ ] FormationScreen
- [ ] PartyEditScreen
- [ ] ExpeditionPreparationScreen

### Phase 5: 遠征機能
- [ ] SQLiteExpeditionRepository
- [ ] SQLitePendingGoblinRepository
- [ ] SQLiteBaseStateRepository
- [ ] ExpeditionPlaybackScreen
- [ ] ExpeditionResultScreen
- [ ] ExpeditionLogScreen

### Phase 6: 拠点・モーダル
- [ ] BaseManagementScreen
- [ ] 各種モーダル（5種）
- [ ] 共通コンポーネント（2種）

---

## 見積もり目安

| フェーズ | 主な作業 | 規模感 |
|---------|---------|--------|
| Phase 1 | DB基盤 | 小 |
| Phase 2 | Repository 3つ | 中 |
| Phase 3 | Hooks修正 3つ | 小 |
| Phase 4 | UI 4画面 | 大 |
| Phase 5 | Repository 3つ + UI 3画面 | 大 |
| Phase 6 | UI 1画面 + モーダル 5つ + 共通 2つ | 中 |

**推奨**: Phase 1〜3を先に完了させ、データ層を安定させてからUI実装に移る
