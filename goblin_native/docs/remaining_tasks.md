# React Native 残タスク一覧

Web版(goblin_web)とReact Native版(goblin_native)の差異を解消するための残タスクです。

---

## 優先度1: 必須（仕様統一）

### 1.1 パーティ最大人数の統一

| 項目 | 内容 |
|-----|------|
| 現状 | Web: 6人、Native: 4人 |
| 対象ファイル | `app/(tabs)/formation/edit.tsx` |
| 作業内容 | `MAX_PARTY_SIZE` を6に変更、UIを6スロット表示に対応 |
| 参照 | `goblin_web/src/presentation/components/PartyEditScreen.tsx` |

### 1.2 ExpeditionEngine の移植

| 項目 | 内容 |
|-----|------|
| 現状 | Native版はランダム生成の仮実装 |
| 対象ファイル | 新規: `src/core/services/ExpeditionEngine.ts` |
| 作業内容 | Web版のExpeditionEngineをReact Native用に移植 |
| 参照 | `goblin_web/src/core/services/ExpeditionEngine.ts` |
| 依存 | BattleSystem.tsも移植が必要 |

### 1.3 遠征プレイバックの完全実装

| 項目 | 内容 |
|-----|------|
| 現状 | 固定イベントのシミュレーション表示 |
| 対象ファイル | `app/(tabs)/formation/playback.tsx` |
| 作業内容 | ExpeditionEngine を使用した本格的なリプレイ再生 |
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
| 現状 | 表示なし |
| 対象ファイル | `app/(tabs)/formation/preparation.tsx` |
| 作業内容 | ダンジョン・パーティ構成から推定時間を計算して表示 |
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
| 現状 | 簡易表示 |
| 対象ファイル | `app/(tabs)/formation/playback.tsx` |
| 作業内容 | 各メンバーのHP/最大HPをリアルタイム更新表示 |

### 3.2 緊急帰還ボタン

| 項目 | 内容 |
|-----|------|
| 現状 | なし |
| 対象ファイル | `app/(tabs)/formation/playback.tsx` |
| 作業内容 | 遠征中に緊急帰還できるボタンを追加 |

### 3.3 ダンジョン選択モーダル化

| 項目 | 内容 |
|-----|------|
| 現状 | ScrollView内に統合 |
| 対象ファイル | `app/(tabs)/formation/preparation.tsx` |
| 作業内容 | Web版と同様にモーダルで選択する形式に変更（任意） |
| 参照 | `goblin_web/src/presentation/components/DungeonSelectionModal.tsx` (83行) |

### 3.4 帰還ポリシー選択モーダル化

| 項目 | 内容 |
|-----|------|
| 現状 | ScrollView内に統合 |
| 対象ファイル | `app/(tabs)/formation/preparation.tsx` |
| 作業内容 | Web版と同様にモーダルで選択する形式に変更（任意） |
| 参照 | `goblin_web/src/presentation/components/ReturnPolicySelectionModal.tsx` (78行) |

---

## コア移植タスク（優先度1の前提）

ExpeditionEngineを動作させるために必要なコアロジックの移植：

| ファイル | 行数 | 説明 |
|---------|------|------|
| `ExpeditionEngine.ts` | 約500行 | 遠征シミュレーションエンジン |
| `BattleSystem.ts` | 約400行 | ターン制戦闘システム |
| `ExperienceSystem.ts` | 約100行 | 経験値計算 |
| `GoblinBirthService.ts` | 約200行 | ゴブリン生成ロジック |

### 移植先ディレクトリ構成

```
src/core/services/
├── ExpeditionEngine.ts      ← 移植
├── BattleSystem.ts          ← 移植
├── ExperienceSystem.ts      ← 移植
└── GoblinBirthService.ts    ← 移植
```

---

## 実装順序推奨

```
Step 1: コアサービス移植
  └── BattleSystem.ts
  └── ExpeditionEngine.ts
  └── ExperienceSystem.ts

Step 2: 遠征プレイバック完全実装
  └── playback.tsx を ExpeditionEngine 連携に書き換え

Step 3: 遠征ログ完全実装
  └── log.tsx を replay データ表示に書き換え

Step 4: パーティ人数統一
  └── edit.tsx の MAX_PARTY_SIZE を 6 に変更

Step 5: その他機能追加
  └── 再生制御
  └── 推定時間表示
  └── 因子獲得表示
```

---

## 完了条件チェックリスト

### 優先度1
- [ ] パーティ最大人数が Web/Native で統一されている
- [ ] ExpeditionEngine が Native で動作する
- [ ] 遠征プレイバックが ExpeditionEngine ベースで動作する

### 優先度2
- [ ] 遠征ログが実際の replay データを表示する
- [ ] 再生制御（一時停止・スキップ・速度変更）が動作する
- [ ] 推定探索時間が表示される
- [ ] 因子獲得が結果画面に表示される
- [ ] 目標階層選択が独立したUIで選択可能

### 優先度3
- [ ] パーティHP がリアルタイム更新表示される
- [ ] 緊急帰還ボタンが動作する
- [ ] ダンジョン選択がモーダル化されている（任意）
- [ ] 帰還ポリシー選択がモーダル化されている（任意）

---

## 参考: Native版で既に優れている点

以下はWeb版への逆移植を検討：

| 機能 | Native実装 | Web版への移植検討 |
|-----|-----------|------------------|
| 容量プログレスバー | `base.tsx` | 推奨 |
| パーティ名変更 | `edit.tsx` | 推奨 |
| 拠点アップグレードUI | `base.tsx` | 推奨 |
| 他パーティ所属判定 | `edit.tsx` | 推奨 |
