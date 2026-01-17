# React Native 移行タスクリスト

このドキュメントは、goblin_web から goblin_native への移行における差分と残タスクを詳細に記載したものです。

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| **[implementation_guide.md](./implementation_guide.md)** | 実装順序ガイド（推奨） |
| [sqlite_migration.md](./sqlite_migration.md) | SQLiteスキーマ設計・Repository実装 |

> **データ永続化方針**: Web版ではFirestoreを使用していましたが、React Native版ではSQLiteをメインのローカルストレージとして使用します。

## 移行状況サマリ

| カテゴリ | goblin_web | goblin_native | 移行率 |
|---------|------------|---------------|--------|
| コアロジック (core/) | 完全 | 完全移植 | 100% |
| 型定義 (shared/types/) | 完全 | 完全移植 | 100% |
| データ (shared/data/) | 完全 | 完全移植 | 100% |
| Repository | Firestore + Json | SQLite (設計完了/実装待ち) | 10% |
| Services (infrastructure) | 1ファイル | 0ファイル | 0% |
| Context | 2ファイル | 2ファイル (簡略化) | 70% |
| Hooks | 5ファイル | 5ファイル (簡略化) | 70% |
| UIコンポーネント | 22ファイル (3,768行) | 11ファイル (1,790行/サンプル) | 10% |

---

## 1. UIコンポーネント移行タスク

### 1.1 完全に未実装のコンポーネント

| 優先度 | コンポーネント | 行数 | 機能 | 難易度 |
|--------|---------------|------|------|--------|
| 高 | GoblinDetailModal.tsx | 290 | ゴブリン詳細・装備管理・ステータス表示 | 中 |
| 高 | FormationTabScreen.tsx | 382 | ビューモード管理・画面遷移制御 | 高 |
| 高 | FormationScreen.tsx | 279 | パーティ一覧・遠征履歴表示 | 中 |
| 高 | ExpeditionPlaybackScreen.tsx | 417 | 遠征リアルタイム再生・アニメーション | 高 |
| 高 | ExpeditionPreparationScreen.tsx | 331 | 遠征準備・設定画面 | 中 |
| 中 | ExpeditionLogScreen.tsx | 434 | 遠征ログ詳細表示 | 中 |
| 中 | PartyEditScreen.tsx | 196 | パーティメンバー編集 | 低 |
| 中 | ExpeditionResultScreen.tsx | 162 | 遠征結果・報酬表示 | 低 |
| 中 | BaseManagementScreen.tsx | 301 | 拠点管理・ゴブリン受け入れ | 中 |
| 中 | ExpeditionSetupScreen.tsx | 248 | 遠征設定（未使用の可能性あり） | 中 |
| 低 | DungeonSelectionModal.tsx | 83 | ダンジョン選択モーダル | 低 |
| 低 | DungeonConfirmModal.tsx | 63 | ダンジョン確認モーダル | 低 |
| 低 | ReturnPolicySelectionModal.tsx | 78 | 帰還ポリシー選択モーダル | 低 |
| 低 | FloorTargetSelectionModal.tsx | 59 | 目標階層選択モーダル | 低 |
| 低 | ExpeditionConfirmModal.tsx | 102 | 遠征開始確認モーダル | 低 |
| 低 | FactorBadge.tsx | 77 | 因子バッジ表示 | 低 |
| 低 | GoblinCard.tsx | 27 | ゴブリンカード（リスト用） | 低 |
| 低 | DungeonScreen.tsx | 70 | ダンジョン画面 | 低 |
| 低 | PartySelectScreen.tsx | 68 | パーティ選択画面 | 低 |
| 低 | GoblinListScreen.tsx | 56 | ゴブリン一覧画面 | 低 |
| 低 | TabMenu.tsx | 45 | タブメニュー（Expo Router で代替済み） | - |

### 1.2 サンプル実装から本実装への置き換え

現在の goblin_native にはサンプルデータを使った簡易画面が存在します。
これらを goblin_web の完全な実装に置き換える必要があります。

| ファイル | 現在の行数 | 対応する goblin_web | 状態 |
|----------|-----------|---------------------|------|
| app/(tabs)/index.tsx | 252 | GoblinListScreen + GoblinDetailModal | サンプル実装 |
| app/(tabs)/formation/index.tsx | 161 | FormationScreen | サンプル実装 |
| app/(tabs)/formation/preparation.tsx | 183 | ExpeditionPreparationScreen | サンプル実装 |
| app/(tabs)/formation/edit.tsx | 151 | PartyEditScreen | サンプル実装 |
| app/(tabs)/formation/playback.tsx | 228 | ExpeditionPlaybackScreen | サンプル実装 |
| app/(tabs)/formation/result.tsx | 190 | ExpeditionResultScreen | サンプル実装 |
| app/(tabs)/formation/log.tsx | 122 | ExpeditionLogScreen | サンプル実装 |
| app/(tabs)/base.tsx | 351 | BaseManagementScreen | サンプル実装 |

---

## 2. Repository 移行タスク

> **重要**: Web版ではFirestoreを使用していましたが、React Native版ではSQLiteに移行します。
> AsyncStorage版の実装は削除済みです。SQLiteスキーマ設計は [sqlite_migration.md](./sqlite_migration.md) を参照。

### 2.1 SQLite Repository 実装状況

| Repository | SQLiteスキーマ | 実装 | 状態 |
|------------|---------------|------|------|
| GoblinRepository | ✅ 設計完了 | ⬜ 未実装 | 実装待ち |
| PartyRepository | ✅ 設計完了 | ⬜ 未実装 | 実装待ち |
| PendingGoblinRepository | ✅ 設計完了 | ⬜ 未実装 | 実装待ち |
| BaseStateRepository | ✅ 設計完了 | ⬜ 未実装 | 実装待ち |
| ExpeditionRepository | ✅ 設計完了 | ⬜ 未実装 | 実装待ち |
| DungeonProgressRepository | ✅ 設計完了 | ⬜ 未実装 | 実装待ち |

### 2.2 Repository 実装タスク

```
□ expo-sqlite パッケージのインストール
  - npx expo install expo-sqlite

□ データベース基盤の実装
  - src/infrastructure/database/index.ts (DB初期化・接続)
  - src/infrastructure/database/schema.ts (スキーマ定義)
  - src/infrastructure/database/migrations/v1.ts (初期マイグレーション)

□ SQLite Repository の実装
  - SQLiteGoblinRepository.ts
  - SQLitePartyRepository.ts
  - SQLitePendingGoblinRepository.ts
  - SQLiteBaseStateRepository.ts
  - SQLiteExpeditionRepository.ts
  - SQLiteDungeonProgressRepository.ts

□ (将来対応) Firestore同期レイヤー
  - オフライン時はSQLite、オンライン時にFirestoreと同期
  - クラウドバックアップ機能
```

---

## 3. Infrastructure Services 移行タスク

### 3.1 Services の状況

| Service | goblin_web | goblin_native | 状態 |
|---------|------------|---------------|------|
| FirestoreDungeonProgressService.ts | Firestore同期 | 不要 | SQLiteで代替 |

### 3.2 タスク

```
□ DungeonProgressはSQLiteDungeonProgressRepositoryで管理
  - useDungeonProgress.tsをSQLiteリポジトリに接続
  - 現在は暫定的にAsyncStorageを使用中（TODO: 移行）
```

---

## 4. Context/Hooks 移行タスク

### 4.1 Context の差分

| Context | goblin_web | goblin_native | 差分 |
|---------|------------|---------------|------|
| AuthContext | Firebase Auth 完全対応 | Firebase Auth 対応 | ほぼ同等 |
| ExpeditionStateContext | Firestore Repository 連携 | 簡略化（Repository 未連携） | 要修正 |

### 4.2 Hooks の差分

| Hook | goblin_web | goblin_native | 差分 |
|------|------------|---------------|------|
| useGoblinService | Json/Firestore 切替 | SQLite接続待ち | SQLite Repository 未実装 |
| usePartyService | Json/Firestore 切替 | SQLite接続待ち | SQLite Repository 未実装 |
| useExpeditionFlow | Firestore Repository 連携 | 簡略化 | SQLite Repository 未連携 |
| useDungeonProgress | localStorage + Firestore | AsyncStorage (暫定) | SQLite移行待ち |
| useCurrentTime | 完全 | 完全移植 | 同等 |

### 4.3 タスク

```
□ ExpeditionStateContext を完全実装
  - SQLiteExpeditionRepository との連携
  - リアルタイム更新対応

□ useGoblinService をSQLiteに接続
  - SQLiteGoblinRepository との連携

□ usePartyService をSQLiteに接続
  - SQLitePartyRepository との連携

□ useDungeonProgress をSQLiteに移行
  - 現在はAsyncStorage使用（暫定）
  - SQLiteDungeonProgressRepository に切替

□ useExpeditionFlow を完全実装
  - 遠征開始・完了フロー
  - SQLiteExpeditionRepository 連携
```

---

## 5. スタイリング移行タスク

### 5.1 Tailwind → StyleSheet 変換

goblin_web では Tailwind CSS を使用していますが、goblin_native では React Native の StyleSheet を使用する必要があります。

```
□ 各コンポーネントのスタイルを StyleSheet に変換
  - className → style プロパティ
  - Tailwind クラス → StyleSheet オブジェクト
  - react-native-size-matters を使用したレスポンシブ対応

□ 共通スタイル定義の作成
  - src/shared/styles/common.ts
  - カラーテーマ
  - タイポグラフィ
  - スペーシング
```

### 5.2 変換ガイド

| Tailwind | React Native StyleSheet |
|----------|------------------------|
| `flex-1` | `{ flex: 1 }` |
| `flex-row` | `{ flexDirection: 'row' }` |
| `items-center` | `{ alignItems: 'center' }` |
| `justify-between` | `{ justifyContent: 'space-between' }` |
| `p-4` | `{ padding: 16 }` |
| `rounded-lg` | `{ borderRadius: 8 }` |
| `text-gray-800` | `{ color: '#1F2937' }` |
| `bg-white` | `{ backgroundColor: '#FFFFFF' }` |

---

## 6. アニメーション移行タスク

### 6.1 ExpeditionPlaybackScreen のアニメーション

goblin_web では `requestAnimationFrame` を使用したカスタムアニメーションを実装しています。
React Native では以下の選択肢があります：

```
□ React Native Animated API を使用
  - 基本的なアニメーション
  - useNativeDriver: true で高パフォーマンス

□ React Native Reanimated を使用（推奨）
  - より高度なアニメーション
  - 既にインストール済み
  - useSharedValue, withTiming 等
```

### 6.2 タスク

```
□ ExpeditionPlaybackScreen のアニメーション実装
  - プログレスバーアニメーション
  - イベント表示のタイミング制御
  - スクロールアニメーション

□ モーダルのアニメーション
  - スライドイン/アウト
  - フェードイン/アウト
```

---

## 7. 画面遷移の差分

### 7.1 goblin_web の画面遷移構造

```
FormationTabScreen (ViewMode 管理)
├── list → FormationScreen (パーティ一覧)
│   ├── onPartySelect → preparation
│   ├── onHistoryClick → result
│   └── onLogClick → log
├── preparation → ExpeditionPreparationScreen (遠征準備)
│   ├── onEditParty → edit
│   ├── onStartExpedition → (遠征開始 → list)
│   └── onBack → list
├── edit → PartyEditScreen (パーティ編集)
│   └── onBack → preparation
├── result → ExpeditionResultScreen (結果表示)
│   └── onBack → list
└── log → ExpeditionLogScreen (ログ詳細)
    └── onBack → list
```

### 7.2 goblin_native の画面遷移構造（現状）

```
Expo Router (Stack Navigation)
├── /formation → FormationScreen (パーティ一覧)
├── /formation/preparation → ExpeditionPreparationScreen
├── /formation/edit → PartyEditScreen
├── /formation/playback → ExpeditionPlaybackScreen
├── /formation/result → ExpeditionResultScreen
└── /formation/log → ExpeditionLogScreen
```

### 7.3 差分と対応

```
□ FormationTabScreen の ViewMode 管理を Expo Router で再現
  - 現状: Stack Navigation で分離
  - 必要: 状態管理と画面遷移の連携

□ 遠征中の画面遷移制御
  - 遠征中は他の画面に遷移できないようにする
  - ExpeditionPlaybackScreen を fullScreenModal として表示

□ パラメータ渡し
  - partyId, expeditionId 等のパラメータ受け渡し
  - useLocalSearchParams で取得
```

---

## 8. データ連携タスク

### 8.1 現状のサンプルデータ

現在の goblin_native ではハードコードされたサンプルデータを使用しています：

```typescript
// app/(tabs)/index.tsx
const sampleGoblins: Goblin[] = [
  { id: 1, name: 'Goburo', ... },
  ...
]
```

### 8.2 タスク

```
□ useGoblinService との連携
  - サンプルデータを削除
  - Repository からデータ取得
  - ローディング状態の表示

□ usePartyService との連携
  - パーティデータの取得
  - パーティの作成・更新・削除

□ 遠征データとの連携
  - ExpeditionRepository との連携
  - 遠征結果の保存・取得

□ 拠点データとの連携
  - BaseStateRepository との連携
  - PendingGoblinRepository との連携
```

---

## 9. 実装優先順位

### Phase 1: データベース基盤（最優先）

```
1. □ expo-sqlite インストール
2. □ データベース初期化・マイグレーション基盤
3. □ SQLiteGoblinRepository 実装
4. □ SQLitePartyRepository 実装
5. □ SQLiteDungeonProgressRepository 実装
```

### Phase 2: 基本UI機能

```
6. □ GoblinDetailModal.tsx の実装
7. □ FormationScreen.tsx の完全実装
8. □ PartyEditScreen.tsx の完全実装
9. □ ExpeditionPreparationScreen.tsx の完全実装
10. □ HooksとSQLite Repositoryの連携
```

### Phase 3: 遠征機能

```
11. □ SQLiteExpeditionRepository 実装
12. □ ExpeditionPlaybackScreen.tsx の完全実装
13. □ ExpeditionResultScreen.tsx の完全実装
14. □ ExpeditionLogScreen.tsx の完全実装
```

### Phase 4: 拠点機能

```
15. □ SQLitePendingGoblinRepository 実装
16. □ SQLiteBaseStateRepository 実装
17. □ BaseManagementScreen.tsx の完全実装
```

### Phase 5: モーダル・補助機能

```
18. □ DungeonSelectionModal.tsx
19. □ DungeonConfirmModal.tsx
20. □ ReturnPolicySelectionModal.tsx
21. □ FloorTargetSelectionModal.tsx
22. □ ExpeditionConfirmModal.tsx
23. □ FactorBadge.tsx
24. □ GoblinCard.tsx
```

### Phase 6: 将来対応（オプション）

```
25. □ Firestore同期レイヤー（クラウドバックアップ）
26. □ プッシュ通知対応
```

---

## 10. 技術的な注意点

### 10.1 Web と React Native の API 差分

| Web API | React Native 代替 |
|---------|------------------|
| `Firestore` | `expo-sqlite` |
| `localStorage` | `expo-sqlite` (メイン) / `AsyncStorage` (Firebase Auth永続化のみ) |
| `requestAnimationFrame` | `Animated` / `Reanimated` |
| `window.location` | `expo-router` |
| `<div>` | `<View>` |
| `<span>` | `<Text>` |
| `<img>` | `<Image>` |
| `onClick` | `onPress` |
| `className` | `style` |
| `overflow: auto` | `<ScrollView>` / `<FlatList>` |

### 10.2 パフォーマンス考慮

```
□ FlatList の使用
  - 大量のリスト表示には FlatList を使用
  - keyExtractor の適切な設定
  - renderItem のメモ化

□ メモ化
  - useMemo, useCallback の適切な使用
  - 不要な再レンダリングの防止

□ 画像の最適化
  - 適切なサイズの画像を使用
  - キャッシュの活用
```

---

## 11. テストタスク

```
□ 単体テスト
  - Jest の設定
  - Repository のテスト
  - UseCase のテスト

□ コンポーネントテスト
  - React Native Testing Library
  - 画面のスナップショットテスト

□ E2E テスト
  - Detox または Maestro
  - 主要フローのテスト
```

---

## 付録: ファイル対応表

| goblin_web | goblin_native | 状態 |
|------------|---------------|------|
| src/core/** | src/core/** | ✅ 完全移植 |
| src/shared/types/** | src/shared/types/** | ✅ 完全移植 |
| src/shared/data/** | src/shared/data/** | ✅ 完全移植 |
| src/shared/constants/** | src/shared/constants/** | ✅ 完全移植 |
| src/config/firebase.ts | src/config/firebase.ts | ✅ 移植済み（RN対応） |
| src/infrastructure/repositories/Firestore*.ts | SQLite版を新規作成 | ⚠️ SQLite版設計完了/実装待ち |
| src/infrastructure/repositories/Json*.ts | SQLite版で代替 | ❌ 不要 |
| src/infrastructure/services/FirestoreDungeonProgressService.ts | SQLite版で代替 | ❌ 不要 |
| - | src/infrastructure/database/ | ⚠️ 新規作成待ち |
| - | src/infrastructure/repositories/SQLite*.ts | ⚠️ 新規作成待ち |
| src/presentation/contexts/AuthContext.tsx | src/presentation/contexts/AuthContext.tsx | ✅ 移植済み |
| src/presentation/contexts/ExpeditionStateContext.tsx | src/presentation/contexts/ExpeditionStateContext.tsx | ⚠️ 簡略化 |
| src/presentation/hooks/useGoblinService.ts | src/presentation/hooks/useGoblinService.ts | ⚠️ SQLite接続待ち |
| src/presentation/hooks/usePartyService.ts | src/presentation/hooks/usePartyService.ts | ⚠️ SQLite接続待ち |
| src/presentation/hooks/useExpeditionFlow.ts | src/presentation/hooks/useExpeditionFlow.ts | ⚠️ 簡略化 |
| src/presentation/hooks/useDungeonProgress.ts | src/presentation/hooks/useDungeonProgress.ts | ⚠️ AsyncStorage暫定/SQLite移行待ち |
| src/presentation/hooks/useCurrentTime.ts | src/presentation/hooks/useCurrentTime.ts | ✅ 完全移植 |
| src/presentation/components/*.tsx (22ファイル) | app/(tabs)/*.tsx (11ファイル) | ❌ サンプル実装のみ |

---

## 付録: SQLite移行設計

SQLiteスキーマ設計、リポジトリ実装パターン、移行パスの詳細は以下を参照してください：

**[docs/sqlite_migration.md](./sqlite_migration.md)**
