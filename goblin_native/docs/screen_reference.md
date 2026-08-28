# 画面リファレンス

## 目的
- Expo Router 配下の画面と責務、主要なデータ層（Zustand store / hook）依存を把握するための一覧です。
- ゲーム仕様そのものは [game_design_overview.md](./game_design_overview.md)、ディレクトリ全体像は [project_structure.md](./project_structure.md) を参照してください。

## ルーティングとレイアウト
- `app/_layout.tsx`
  - ルートスタック。`AuthProvider` / `ResetProvider` を全体に適用。
  - 起動時に各 Zustand ストアと SQLite を初期化し、完了まではローディング／スプラッシュを表示。
- `app/(tabs)/_layout.tsx`
  - 6タブ構成。定義順（タブ index）は次の通り。
    - 0: `story`（ストーリー、未読バッジあり）
    - 1: `index`（ゴブリン一覧）
    - 2: `formation`（遠征）
    - 3: `base`（拠点、ランクアップ可能時に `!` バッジ）
    - 4: `encyclopedia`（図鑑）
    - 5: `settings`（設定）
  - 画面下部に TipsBar / 現在時刻バッジ / ゴールドバッジ / 金のドングリバッジを重畳表示。
- `app/(tabs)/formation/_layout.tsx`
  - Formation 内のスタック。`index` / `preparation` / `edit` / `equipment-list` / `party-info` / `equipment`（formSheet）/ `playback` / `result` / `log` / `battle-log` / `level-up-log`。
- `app/goblin/_layout.tsx`
  - ゴブリン個別画面のスタック（`detail` / `equipment` / `avatar`）。

## データ層の前提
- 画面の状態取得・更新は **Zustand store** が中心です。
  - `useGoblinStore` / `usePartyStore` / `useBaseStore` / `useDungeonStore` / `useExpeditionStore`
  - `useStoryStore` / `usePurchaseStore` / `useTutorialStore` / `useTutorialOverlayStore` / `useDebugSettingsStore`
- 遠征フローは `useExpeditionFlow`（hook）が中核。装備操作は `useEquipmentService`。
- 戦闘・レベルアップの詳細ログは `battleLogStore` / `levelUpLogStore`（contexts 配下の軽量ストア）で画面間受け渡し。

## 画面遷移フロー（簡易）

### タブ間
- `story` / `goblin一覧` / `formation` / `base` / `encyclopedia` / `settings` をタブで相互遷移。

### ゴブリン一覧（`(tabs)/index`）
- 一覧 → `goblin/detail`（ゴブリン詳細）
- 詳細 → `goblin/equipment`（装備変更）/ `goblin/avatar`（アバター）
- 「産まれたゴブリン」の受け入れ/解雇はこの画面で実行。

### 拠点（`(tabs)/base`）
- 拠点トップ → 各施設（解放ランク条件あり）
  - `base/healing`（治療所, Rank1）
  - `base/upgrade`（拠点拡張, Rank1）
  - `base/training`（訓練所, Rank2）
  - `base/shop`（装備商店, Rank2）
  - `base/warehouse`（倉庫, Rank1）
  - `shop`（特別商店, Rank1）

### 遠征（`(tabs)/formation`）
- `formation/index` → `formation/preparation`（待機パーティ選択時）
- `formation/index` → `formation/playback`（遠征中パーティ選択時）
- `formation/index` → `formation/result`（履歴の完了分を選択時）
- `formation/index` → `formation/party-info`（パーティ詳細）
- `formation/preparation` → `formation/edit`（メンバー編集）
- `formation/preparation` → `formation/equipment-list` → `formation/equipment`（装備変更）
- `formation/preparation` → 出撃後 `formation/index` へ戻る
- `formation/playback` → `formation/battle-log`（戦闘詳細）/ `formation/level-up-log`（レベルアップ詳細）
- `formation/playback` → 自動完了後 `formation/result`
- `formation/result` → `formation/index`（メニューへ戻る）

### ストーリー（`(tabs)/story`）
- `story/index`（一覧）→ `story/reader`（本文）

### 図鑑（`(tabs)/encyclopedia`）
- 図鑑 → `encyclopedia-detail/[dungeonId]`（ダンジョン詳細）→ `encyclopedia-detail/[dungeonId]/[enemyId]`（敵詳細）

## 画面遷移の詳細条件（補足）

### Formation 一覧からの分岐
- → `preparation`: パーティが `idle`（待機中）/未設定のとき。空スロット選択時は新規作成後に遷移。
- → `playback`: パーティが `expedition`（遠征中）のとき。`expeditionId` を付与して遷移。
- → `result`: 遠征履歴が完了状態の行をタップしたとき。

### Preparation 画面の分岐
- → `edit`: メンバー変更ボタン押下。
- → `equipment-list` / `equipment`: 装備変更の導線。
- 出撃成功時に `formation/index` へ戻る。出撃不可条件はダンジョン未選択またはメンバー0人。
- 金のドングリ使用時は `usePurchaseStore` でチケット消費。

### Playback 画面の分岐
- → `battle-log`: イベントログの戦闘詳細タップ時（`battleLogStore` 経由）。
- → `level-up-log`: レベルアップ詳細タップ時（`levelUpLogStore` 経由）。
- 規定時間経過で `useExpeditionFlow` が自動完了し、`result` へ遷移。

## タブ別の画面詳細

### ストーリー（`(tabs)/story/`）
- `index.tsx`: ストーリー一覧。`useStoryStore`（未読数/読了管理）。
- `reader.tsx`: 本文表示。読了で報酬付与（特定ゴブリン等）。

### ゴブリン一覧（`(tabs)/index.tsx`）
- 役割: ゴブリン一覧と産まれたゴブリンの受け入れ/解雇。
- 主な依存: `useGoblinStore` / `usePartyStore` / `useBaseStore` / `useTutorialStore`。
- 詳細表示は `GoblinStatCalculator` / `ExperienceSystem`、画像は `goblinImages` / `factorImages`。

### 遠征（`(tabs)/formation/`）
- `index.tsx`: パーティ一覧・遠征履歴の入口。依存: `usePartyStore` / `useGoblinStore` / `useBaseStore` / `useDungeonStore` / `useExpeditionFlow` / `usePurchaseStore` / `useTutorialStore`。
- `preparation.tsx`: ダンジョン・帰還ポリシー・目標階層の選択と出撃。依存: 上記とほぼ同じ。
- `edit.tsx`: メンバー入れ替え（6スロット、他パーティ所属は選択不可）。
- `equipment-list.tsx` / `equipment.tsx`: 装備一覧と装備変更（`useEquipmentService`）。
- `party-info.tsx`: PTスキル/ステータス比較/因子一覧。
- `playback.tsx`: リプレイ再生（進行バー・HP・イベントログ）。依存: `useExpeditionFlow` / `useExpeditionStore` / `battleLogStore` / `levelUpLogStore`。
- `result.tsx`: 結果サマリ（到達階層・経験値・ゴールド・宝箱・因子獲得・ダンジョン解放）。
- `log.tsx`: 遠征ログ。
- `battle-log.tsx`: 戦闘ログ（`battleLogStore` の内容を表示）。
- `level-up-log.tsx`: レベルアップログ（`levelUpLogStore`）。

### 拠点（`(tabs)/base.tsx` と `app/base/`）
- `base.tsx`: 拠点トップ。ランク/収容数/パーティ数/施設メニュー。依存: `useBaseStore` / `useGoblinStore`。
- `base/healing.tsx`: HP0ゴブリンの治療（Lv依存、亜種1.2倍）。依存: `useBaseStore` / `useGoblinStore`。
- `base/upgrade.tsx`: ダンジョン制圧後にゴールドでランクアップ。依存: `useBaseStore`。
- `base/training.tsx`: 純ゴブリンへのジョブ付与（変更不可）。依存: `useBaseStore` / `useDungeonStore` / `useGoblinStore` / `usePartyStore` / `useStoryStore`。
- `base/shop.tsx`: 装備の購入/売却。依存: `useBaseStore`。
- `base/warehouse.tsx`: 未装備アイテムの一覧・名前/MOD数/カテゴリ/称号による複合絞り込み・詳細確認。依存: `equipmentRepository`。
- `app/shop.tsx`: 特別商店（課金アイテム）。

### ゴブリン個別（`app/goblin/`）
- `detail.tsx`: ステータス・スキル・因子の詳細。依存: `useGoblinStore` / `usePartyStore` / `useBaseStore`。
- `equipment.tsx`: 装備の装着/取り外し（名前/MOD数/カテゴリ/称号フィルタ、重複ペナルティ可視化）。依存: `useEquipmentService` / `useGoblinStore`。
- `avatar.tsx`: アバター設定。

### 図鑑（`(tabs)/encyclopedia.tsx` と `app/encyclopedia-detail/`）
- `encyclopedia.tsx`: ダンジョン/モンスター図鑑。依存: `useDungeonStore`、整形は `presentation/encyclopedia/encyclopediaData.ts`。
- `encyclopedia-detail/[dungeonId].tsx`: ダンジョン詳細。
- `encyclopedia-detail/[dungeonId]/[enemyId].tsx`: 敵詳細（ステータス/因子欄あり）。

### 設定（`(tabs)/settings.tsx`）
- デバッグ設定など。依存: `useDebugSettingsStore`。セーブデータの入出力は `useSaveDataBackup`。

## 主要イベントとデータ更新対応表（概要）

### ゴブリン関連
- 受け入れ: `index.tsx` で `saveGoblin()` 実行後 `removePendingGoblin()`。
- 解雇: `index.tsx` / `goblin/detail.tsx` から削除。

### パーティ関連
- 新規作成: `formation/index.tsx` の空スロット選択で作成。
- メンバー更新: `formation/edit.tsx` で更新。
- 設定変更（ダンジョン/帰還ポリシー/目標階層）: `formation/preparation.tsx`。

### 遠征関連（開始/進行/完了）
- 出撃開始: `formation/preparation.tsx` → `useExpeditionFlow.startExpedition()`（内部で `StartExpeditionUseCase`）。
- 進行/再生: `formation/playback.tsx` が `ExpeditionReplay` を読み込み、イベントログとHPを更新。
- 完了: `useExpeditionFlow` が `returnTime` 到達時に自動完了し、`CompleteExpeditionUseCase.execute()` で経験値・因子・装備・制圧を反映。
- 新ゴブリン誕生: 拠点の「群れを増やす」で継承元を1体設定し、ランダム選出された拠点メンバーとの＋値・因子を使って時間経過後に保留ゴブリンを追加。マルクだけの場合は単独で開始可能。

### ダンジョン進行
- 踏破/制圧更新: 遠征完了処理（`useExpeditionFlow` / `CompleteExpeditionUseCase`）で `useDungeonStore` を更新。
- 解放: `unlockNext` および拠点ランクアップに応じて新ダンジョンを解放。

## 遠征の状態遷移（簡易図）
```
idle
  └─(startExpedition)→ expedition
        ├─(returnTime到達/自動完了)→ completed
        └─(帰還ポリシー/全滅)→ completed
```

### 表示上の分岐（`formation/index.tsx`）
- `status === 'expedition'` のパーティ → 再生（playback）へ。
- それ以外 → 準備（preparation）へ。
- 完了済み履歴 → 結果（result）へ。
