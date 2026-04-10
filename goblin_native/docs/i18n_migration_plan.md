# i18n 移行計画と実装状況

## 概要

- 本リポジトリに `i18next` / `react-i18next` / `expo-localization` を導入し、`ja` / `en` / `ko` の 3 ロケール前提の i18n 基盤を追加した。
- 既存の表示名依存を減らすため、ゴブリン種族は `raceId` を正規化して扱うようにし、既存の `race` 日本語文字列は互換用に残した。
- 第 1 段階として、主要 UI と共通マスターデータの表示を resolver 経由に変更した。
- 第 2 段階として予定していた保存形式の完全正規化は未完了で、現状は SQLite 互換を維持した段階移行になっている。

## 今回実装した内容

### i18n 基盤

- `src/shared/i18n/` を追加した。
  - `index.ts`: i18n 初期化
  - `keys.ts`: 対応ロケール定義
  - `resources/ja.ts`
  - `resources/en.ts`
  - `resources/ko.ts`
  - `entityLocalization.ts`: 表示 resolver
- 端末ロケールから言語を判定し、未対応時は `ja` にフォールバックする。
- Jest 実行時は期待値互換のため `ja` を既定ロケールに固定している。

### ID ベースの種族管理

- `src/shared/types/Race.ts` を追加し、`GoblinRaceId` と正規化関数を定義した。
- `Goblin` 型に `raceId` を追加した。
- ゴブリン生成、因子継承、画像選択、基礎ステータス算出、ジョブ判定を `raceId` ベースで扱うよう更新した。
- 既存表示・既存保存との互換のため、`race` には従来の日本語名を保持する。

### SQLite 互換移行

- `goblins` / `pending_goblins` に `race_id` を追加する `v7` マイグレーションを追加した。
- 既存の日本語 `race` 値から `race_id` を backfill する。
- Repository 保存時は `race_id` を書き込み、読み込み時は `race_id` 優先で `raceId` を復元する。
- `equipment.title_name` は新規保存で書き込まず、読み込み時は `title_id` から再構築する。

### 表示 resolver 化

- 以下の resolver を `entityLocalization.ts` に追加した。
  - 種族名
  - ジョブ名 / 短縮ラベル / 説明
  - ステータス名
  - 帰還ポリシー名
  - スキル名
  - 呪文名
  - ダンジョン名 / 説明
  - 因子名 / 説明
  - 装備名
  - 装備称号名
  - 称号付き装備名
- 翻訳キーが未定義のデータは、既存 `name` / `description` をフォールバック表示する。装備は説明文を持たないため、名称のみを対象にする。

### 主要画面の i18n 化

- 以下の主要画面・レイアウトでハードコード文言を i18n に差し替えた。
  - `app/_layout.tsx`
  - `app/(tabs)/_layout.tsx`
  - `app/(tabs)/settings.tsx`
  - `app/goblin/_layout.tsx`
  - `app/goblin/detail.tsx`
  - `app/(tabs)/formation/equipment-list.tsx`
  - `app/(tabs)/formation/result.tsx`
  - `src/presentation/components/GoblinCard.tsx`
- `describeCharacterSkill()` も翻訳辞書ベースで生成するよう変更した。
- 戦闘の通常攻撃名、呪文名、宝箱の称号付き装備名も resolver 経由で表示する。

## 未完了の項目

### UI の全面置換

- `app/` 配下には未対応の日本語文言がまだ残っている。
- 特に以下は今後の対応対象:
  - 拠点画面
  - 訓練画面
  - 編成準備画面
  - 再生画面
  - 戦闘ログ画面
  - 一部の Alert 文言

### マスターデータの完全辞書化

- 現状は `enemy/*.json`, `expeditionArea/*.json`, `modPool.json` の `name` / `description` と、`equipmentPool.json` の `name` をフォールバックとして利用している。
- 将来的にはこれらも翻訳キー参照に寄せ、ロケールごとの辞書管理へ統一する。

### 保存形式の完全正規化

- `skills_json` はまだ表示名付きの旧形式を許容している。
- `expeditions.dungeon_name` は新規保存で残しているが、表示の主ソースにはしていない。
- 将来的には以下を段階的に進める。
  - `skills_json` の mechanic-only 化
  - `dungeon_name` のフォールバック専用化
  - `race` 列の縮退

## 検証

- `npx tsc --noEmit`
- `npm test -- --runInBand`

どちらも通過済み。
