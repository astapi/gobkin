# React Native 残タスク一覧

Web版(goblin_web)とReact Native版(goblin_native)の差異を解消するための残タスクです。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [project_structure.md](./project_structure.md) | ディレクトリ構成・責務一覧 |
| [screen_reference.md](./screen_reference.md) | 画面リファレンス |
| [migration_tasks.md](./migration_tasks.md) | 移行タスク一覧・UI実装詳細 |
| [chapter1_release_tasks.md](./chapter1_release_tasks.md) | 第1章リリースに必要なゲーム機能・バランス・ストア準備タスク |

---

## 優先度1: 必須（仕様統一）

### 1.1 パーティ最大人数の統一

| 項目 | 内容 |
|-----|------|
| 現状 | Web: 6人、Native: 6人（統一済み） |
| 対象ファイル | `app/(tabs)/formation/edit.tsx` |
| 作業内容 | 対応済み（`MAX_PARTY_SIZE = 6`、UI 6スロット対応） |
| 参照 | `goblin_web/src/presentation/components/PartyEditScreen.tsx` |

### 1.2 ExpeditionEngine の移植

| 項目 | 内容 |
|-----|------|
| 現状 | 実装済み（`ExpeditionEngine.ts` あり） |
| 対象ファイル | `src/core/services/ExpeditionEngine.ts` |
| 作業内容 | 移植後の挙動調整・テスト強化を継続 |
| 参照 | `goblin_web/src/core/services/ExpeditionEngine.ts` |
| 依存 | BattleSystem.ts は実装済み |

### 1.3 遠征プレイバックの完全実装

| 項目 | 内容 |
|-----|------|
| 現状 | `replay` ベースの再生実装済み（改善余地あり） |
| 対象ファイル | `app/(tabs)/formation/playback.tsx` |
| 作業内容 | 追加改善（再生制御や演出） |
| 参照 | `goblin_web/src/presentation/components/ExpeditionPlaybackScreen.tsx` (417行) |

---

## 優先度2: 推奨（機能追加）

### 2.1 詳細戦闘ログの実装

| 項目 | 内容 |
|-----|------|
| 現状 | サンプルデータ表示のみ |
| 対象ファイル | `app/(tabs)/formation/log.tsx` |
| 作業内容 | ExpeditionRepository から replay データを取得して表示 |
| 参照 | `goblin_web/src/presentation/components/ExpeditionLogScreen.tsx` (434行) |

### 2.2 再生制御機能の追加

| 項目 | 内容 |
|-----|------|
| 現状 | 自動進行のみ |
| 対象ファイル | `app/(tabs)/formation/playback.tsx` |
| 作業内容 | 一時停止、スキップ、速度変更ボタンを追加 |
| 追加UI | 再生コントロールバー |

### 2.3 推定探索時間の表示

| 項目 | 内容 |
|-----|------|
| 現状 | 実装済み（推定探索時間を表示） |
| 対象ファイル | `app/(tabs)/formation/preparation.tsx` |
| 作業内容 | 必要に応じて表示文言/単位を調整 |
| 参照 | `goblin_web/src/presentation/components/ExpeditionPreparationScreen.tsx` |

### 2.4 因子獲得表示

| 項目 | 内容 |
|-----|------|
| 現状 | 表示なし |
| 対象ファイル | `app/(tabs)/formation/result.tsx` |
| 作業内容 | 遠征で獲得した因子を結果画面に表示 |
| 参照 | `goblin_web/src/presentation/components/ExpeditionResultScreen.tsx` |

### 2.5 目標階層選択モーダル

| 項目 | 内容 |
|-----|------|
| 現状 | 帰還ポリシーに含まれる簡易実装 |
| 対象ファイル | `app/(tabs)/formation/preparation.tsx` |
| 作業内容 | 目標階層を独立して選択できるモーダルを追加 |
| 参照 | `goblin_web/src/presentation/components/FloorTargetSelectionModal.tsx` (59行) |

---

## 優先度3: 品質向上

### 3.1 パーティHP詳細表示

| 項目 | 内容 |
|-----|------|
| 現状 | 実装済み（イベント進行に応じて更新） |
| 対象ファイル | `app/(tabs)/formation/playback.tsx` |
| 作業内容 | 表示精度/演出の改善を検討 |

### 3.2 緊急帰還ボタン

| 項目 | 内容 |
|-----|------|
| 現状 | なし |
| 対象ファイル | `app/(tabs)/formation/playback.tsx` |
| 作業内容 | 遠征中に緊急帰還できるボタンを追加 |

### 3.3 ダンジョン選択モーダル化

| 項目 | 内容 |
|-----|------|
| 現状 | モーダル化済み |
| 対象ファイル | `app/(tabs)/formation/preparation.tsx` |
| 作業内容 | 対応済み（任意改善のみ） |
| 参照 | `goblin_web/src/presentation/components/DungeonSelectionModal.tsx` (83行) |

### 3.4 帰還ポリシー選択モーダル化

| 項目 | 内容 |
|-----|------|
| 現状 | モーダル化済み |
| 対象ファイル | `app/(tabs)/formation/preparation.tsx` |
| 作業内容 | 対応済み（任意改善のみ） |
| 参照 | `goblin_web/src/presentation/components/ReturnPolicySelectionModal.tsx` (78行) |

---

## コア移植タスク（優先度1の前提）

ExpeditionEngineを動作させるために必要なコアロジックは移植済みです。

| ファイル | 行数 | 説明 |
|---------|------|------|
| `ExpeditionEngine.ts` | 約500行 | 遠征シミュレーションエンジン |
| `BattleSystem.ts` | 約400行 | ターン制戦闘システム |
| `ExperienceSystem.ts` | 約100行 | 経験値計算 |
| `GoblinBirthService.ts` | 約200行 | ゴブリン生成ロジック |

### 移植先ディレクトリ構成

```
src/core/services/
├── ExpeditionEngine.ts      ← 実装済み
├── BattleSystem.ts          ← 実装済み
├── ExperienceSystem.ts      ← 実装済み
└── GoblinBirthService.ts    ← 実装済み
```

---

## 実装順序推奨

```
Step 1: 遠征ログ完全実装
  └── log.tsx を replay データ表示に書き換え

Step 2: 再生制御機能の追加
  └── 再生制御

Step 3: 目標階層UIの拡張
  └── 目標階層選択モーダル

Step 4: 結果画面の報酬詳細化
  └── 因子獲得表示
```

---

## 完了条件チェックリスト

### 優先度1
- [x] パーティ最大人数が Web/Native で統一されている
- [x] ExpeditionEngine が Native で動作する
- [x] 遠征プレイバックが ExpeditionEngine ベースで動作する

### 優先度2
- [ ] 遠征ログが実際の replay データを表示する
- [ ] 再生制御（一時停止・スキップ・速度変更）が動作する
- [x] 推定探索時間が表示される
- [ ] 因子獲得が結果画面に表示される
- [ ] 目標階層選択が独立したUIで選択可能

### 優先度3
- [x] パーティHP がリアルタイム更新表示される
- [ ] 緊急帰還ボタンが動作する
- [x] ダンジョン選択がモーダル化されている（任意）
- [x] 帰還ポリシー選択がモーダル化されている（任意）

---

## 参考: Native版で既に優れている点

以下はWeb版への逆移植を検討：

| 機能 | Native実装 | Web版への移植検討 |
|-----|-----------|------------------|
| 容量プログレスバー | `base.tsx` | 推奨 |
| パーティ名変更 | `edit.tsx` | 推奨 |
| 拠点アップグレードUI | `base.tsx` | 推奨 |
| 他パーティ所属判定 | `edit.tsx` | 推奨 |
