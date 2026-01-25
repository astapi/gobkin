# 画面リファレンス

## 目的
- Expo Router 配下の画面と責務、主要なデータ/フック依存を把握するための一覧です。

## ルーティングとレイアウト
- `app/_layout.tsx`
  - ルートスタック。`AuthProvider` と `ExpeditionStateProvider` を全体に適用。
- `app/(tabs)/_layout.tsx`
  - 3タブ構成（List / Formation / Base）。ヘッダ非表示。
- `app/(tabs)/formation/_layout.tsx`
  - Formation 内のスタック遷移（preparation/edit/playback/result/log/battle-log）。

## 画面遷移フロー（簡易）
### タブ間
- `List` ⇄ `Formation` ⇄ `Base`（タブ切替で相互遷移）

### List（ゴブリン一覧）
- 一覧 → ゴブリン詳細モーダル（閉じるで一覧へ）

### Base（拠点管理）
- 拠点管理（単一画面、モーダルなし）

### Formation（編成/遠征）
- `formation/index` → `formation/preparation`（待機パーティを選択）
- `formation/index` → `formation/playback`（遠征中パーティを選択）
- `formation/index` → `formation/result`（履歴の完了分を選択）
- `formation/preparation` → `formation/edit`（メンバー編集）
- `formation/preparation` → `formation`（出撃完了後に戻る）
- `formation/playback` → `formation/battle-log`（戦闘詳細ログ）
- `formation/playback` → `formation`（戻る）
- `formation/result` → `formation`（メニューに戻る）
- `formation/log` → `formation`（戻る）

## 画面遷移の詳細条件（補足）
### Formation 一覧からの分岐
- `formation/index` → `formation/preparation`
  - 条件: パーティが `idle`（待機中）または未設定のとき。
  - 空スロット選択時は新規パーティ作成後に遷移。
- `formation/index` → `formation/playback`
  - 条件: パーティが `expedition`（遠征中）のとき。
  - 直近の履歴があれば `expeditionId` を付与して遷移。
- `formation/index` → `formation/result`
  - 条件: 遠征履歴が完了状態（ongoing ではない）ときの履歴行タップ。

### Preparation 画面の分岐
- `formation/preparation` → `formation/edit`
  - 条件: 「メンバーを変更する」ボタン押下。
- `formation/preparation` → `formation`
  - 条件: 出撃成功時に `router.replace('/formation')` で戻る。
  - 出撃不可条件: ダンジョン未選択 or メンバー0人。

### Playback 画面の分岐
- `formation/playback` → `formation/battle-log`
  - 条件: イベントログの「詳細」タップ時。
- `formation/playback` → `formation`
  - 条件: 戻る操作（再生終了時も結果画面へは自動遷移しない）。

### Result / Log / Battle-log の戻り
- `formation/result` → `formation`（「メニューに戻る」）
- `formation/log` → `formation`（戻る）
- `formation/battle-log` → `formation/playback`（戻る）

### List / Base
- List: 一覧 → 詳細モーダル（閉じるで一覧へ）
- Base: 単一画面（モーダルなし）

## タブ: List
### ゴブリン一覧
- ルート: `/(tabs)/index` → `app/(tabs)/index.tsx`
- 役割: ゴブリン一覧表示と詳細モーダル。
- 主な依存:
  - `useGoblinService`（取得/削除）
  - `ModStatCalculator`、`ExperienceSystem`（詳細表示）
  - `factorImages` / `goblinImages` / `modPoolLoader`
- UI概要:
  - `FlatList` で一覧。
  - タップで詳細モーダル（ステータス・因子・Mod・経験値）。
  - 追放ボタンで削除。
- 補足: 空状態表示あり。

## タブ: Base
### 拠点管理
- ルート: `/(tabs)/base` → `app/(tabs)/base.tsx`
- 役割: 拠点ステータスと保留ゴブリンの受け入れ/追放。
- 主な依存:
  - `useBaseState`（拠点ランク/収容数）
  - `usePendingGoblins`（保留ゴブリン）
  - `useGoblinService`（受け入れ保存）
  - `ModStatCalculator`（Mod反映ステータス）
- UI概要:
  - 拠点ステータスカード。
  - 保留ゴブリンの選択、追加・追放アクション。

## タブ: Formation
### パーティ一覧/遠征履歴
- ルート: `/(tabs)/formation` → `app/(tabs)/formation/index.tsx`
- 役割: パーティ一覧、遠征履歴の入口。
- 主な依存:
  - `usePartyService`（作成/取得/更新）
  - `useGoblinService`（メンバー表示）
  - `useBaseState`（パーティ枠数）
  - `useExpeditionFlow`（履歴/自動完了）
- UI概要:
  - パーティカードにメンバー6枠。
  - 遠征中なら playback へ、待機なら preparation へ遷移。
  - 履歴一覧から結果 or 再生へ遷移。

### 遠征準備
- ルート: `/(tabs)/formation/preparation` → `app/(tabs)/formation/preparation.tsx`
- 役割: ダンジョン選択/帰還条件/出撃。
- 主な依存:
  - `usePartyService`（パーティ/設定保存）
  - `useGoblinService`（メンバー表示）
  - `useDungeonProgress`（解放ダンジョン）
  - `useExpeditionFlow`（開始/推定時間）
- UI概要:
  - パーティ編集への導線。
  - ダンジョン選択モーダル。
  - 帰還条件モーダル。
  - 推定探索時間表示。

### パーティ編集
- ルート: `/(tabs)/formation/edit` → `app/(tabs)/formation/edit.tsx`
- 役割: パーティメンバーの入れ替え。
- 主な依存:
  - `usePartyService`（メンバー更新）
  - `useGoblinService`（候補一覧）
- UI概要:
  - 6スロット。
  - 他パーティ所属は選択不可表示。

### 遠征再生
- ルート: `/(tabs)/formation/playback` → `app/(tabs)/formation/playback.tsx`
- 役割: リプレイの時間進行とログ表示。
- 主な依存:
  - `useExpeditionService`（遠征記録/完了更新）
  - `usePartyService` / `useGoblinService`
  - `usePendingGoblins` / `useBaseState`
  - `CompleteExpeditionUseCase` / `GoblinBirthService`
  - `battleLogStore`（詳細ログ連携）
- UI概要:
  - 進行バー/タイマー。
  - メンバーHPの簡易表示。
  - ログタップで戦闘詳細ログへ遷移。

### 遠征ログ（簡易）
- ルート: `/(tabs)/formation/log` → `app/(tabs)/formation/log.tsx`
- 役割: サンプルの遠征ログ表示。
- 主な依存:
  - `usePartyService` / `useDungeonProgress`
- UI概要:
  - ダンジョン階層に応じた疑似ログを生成表示。
- 補足: 実ログは未接続（ExpeditionRepository連携予定）。

### 戦闘ログ
- ルート: `/(tabs)/formation/battle-log` → `app/(tabs)/formation/battle-log.tsx`
- 役割: battleLogStore に保存した戦闘ログ表示。
- 主な依存:
  - `battleLogStore`（取得/破棄）
- UI概要:
  - ターン開始情報と各アクションログ。
  - 戻る操作でログを破棄。

### 遠征結果
- ルート: `/(tabs)/formation/result` → `app/(tabs)/formation/result.tsx`
- 役割: 遠征結果のサマリ表示。
- 主な依存:
  - `useExpeditionService`（遠征記録）
  - `usePartyService` / `useGoblinService`
  - `useDungeonProgress`（踏破/解放更新）
  - `shared/data`（エリア解放）
- UI概要:
  - メンバーHP/生死。
  - 経験値・ゴールド。
  - 次エリア解放メッセージ。

## メモ
- 現時点の `src/presentation/components/` は空で、画面は `app/` 直下に実装されています。
- 画面側のロジックは `presentation/hooks` に分散しています。

## 主要イベントとデータ更新対応表（概要）
### ゴブリン関連
- 受け入れ: `base.tsx` で `saveGoblin()` 実行後、`removePendingGoblin()`。
- 追放: `index.tsx` の詳細モーダルから `deleteGoblin()`。

### パーティ関連
- 新規作成: `formation/index.tsx` の空スロット選択で `createParty()`。
- メンバー更新: `formation/edit.tsx` で `updateMembers()`。

### 遠征関連（開始/進行/完了）
- 出撃開始: `formation/preparation.tsx` で `startExpedition()`。
- 進行/再生: `formation/playback.tsx` で `replay` を読み込み、イベントログとHPを更新。
- 遠征完了:
  - `CompleteExpeditionUseCase.execute()` でパーティ/ゴブリン更新。
  - `completeExpeditionRecord()` で遠征記録を完了状態に更新。
- クリア報酬（仮の流れ）:
  - `formation/playback.tsx` の `addPendingGoblinOnClear()` が条件一致時に保留ゴブリンを追加。

### ダンジョン進行
- 踏破更新: `formation/result.tsx` で `markDungeonCleared()`。
- 解放メッセージ: `shared/data` の `unlockNext` を参照して表示。

## 遠征の状態遷移（簡易図）
```
idle
  └─(startExpedition)→ expedition
        ├─(playback完了/completeExpedition)→ completed
        └─(緊急帰還/途中帰還)→ completed
```

### 状態の主な更新箇所
- 開始: `formation/preparation.tsx` の `startExpedition()` で `expedition` へ。
- 完了: `formation/playback.tsx` の `completeExpeditionUseCase.execute()` と
  `completeExpeditionRecord()` で `completed` へ。

### 表示上の分岐
- `formation/index.tsx`
  - `status === 'expedition'` のパーティは再生へ遷移。
  - それ以外は準備画面へ遷移。
