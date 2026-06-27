# goblin_native ディレクトリ構成・コンポーネント概要

## 関連ドキュメント
- [screen_reference.md](./screen_reference.md) 画面リファレンス
- [game_design_overview.md](./game_design_overview.md) ゲーム仕様総合ドキュメント
- [sqlite_migration.md](./sqlite_migration.md) SQLiteデータ永続化設計

## 目的
- アプリの全体構成（画面/ドメイン/データ/インフラ）を俯瞰し、改修時の参照点を整理します。

## アーキテクチャ概要
- ベースは Clean Architecture。依存方向は `presentation -> core/usecases -> core/domain|services -> repositories interface -> infrastructure`。
- `src/core` には React Native / Expo 依存を持ち込みません。
- 状態管理は **Zustand store**（`src/presentation/stores/`）が中心で、Context（`src/presentation/contexts/`）と併用します。
- 永続化は SQLite。リポジトリはシングルトンパターンで `getInstance()` 取得し、内部キャッシュで同期的に読み出します。

## 主要ディレクトリ

```
app/                       Expo Router 画面（タブ/スタック/モーダル）
assets/                    画像などの静的アセット（タブアイコン/ゴブリン/敵/因子など）
docs/                      プロジェクト内ドキュメント
src/                       アプリ本体
  config/                  外部サービス設定（firebase.ts）
  core/                    ドメイン・ユースケース・サービス（RN/Expo 非依存）
    domain/                エンティティ（GoblinEntity / PartyEntity / EnemyEntity）
    repositories/          リポジトリIF（I*Repository.ts）
    services/              ゲームロジック/計算系（戦闘・遠征・誕生・因子など）
    usecases/              アプリケーションユースケース
  infrastructure/          DB・リポジトリ実装・セーブデータ入出力
    database/              SQLiteスキーマ/初期化/マイグレーション
    repositories/          SQLiteリポジトリ
    backup/                セーブデータのエクスポート/インポート/署名
  presentation/            UI状態管理レイヤ
    stores/                Zustand ストア
    contexts/              Context / 軽量ストア
    hooks/                 画面ロジック用カスタムフック
    components/            共有UIコンポーネント
    encyclopedia/          図鑑用データ整形
  shared/                  共通定義/データ/ユーティリティ/i18n（RN/Expo 非依存寄り）
    constants/             定数（colors / purchases / layout）
    data/                  マスターデータ（敵/遠征エリア/装備/スキル/因子/種族/ストーリーなど）
    i18n/                  多言語リソースとローカライズ
    types/                 型定義
    utils/                 画像マッピング/ステータス計算/スケーリングなど
  types/                   型拡張（svg.d.ts）
```

## 画面（`app/`）

Expo Router のファイルベースルーティング。詳細な責務・遷移は [screen_reference.md](./screen_reference.md) を参照。

- `app/_layout.tsx`
  - ルートレイアウト。`AuthProvider` / `ResetProvider` を適用。
  - 起動時に各 Zustand ストア（Goblin/Party/Base/Dungeon/Expedition/Purchase/Story/Tutorial/DebugSettings）と DB を初期化。
  - 初期化中はローディング／スプラッシュ表示。
- `app/(tabs)/_layout.tsx`
  - 6タブ構成。定義順は `story` / `index`（ゴブリン一覧）/ `formation`（遠征）/ `base`（拠点）/ `encyclopedia`（図鑑）/ `settings`（設定）。
  - 画面下部に TipsBar / 現在時刻バッジ / ゴールドバッジ / 金のドングリバッジを重ねて表示。
- `app/(tabs)/index.tsx` … ゴブリン一覧、産まれたゴブリンの受け入れ/解雇。
- `app/(tabs)/base.tsx` … 拠点トップ。施設メニューの起点。
- `app/(tabs)/formation/` … 遠征フロー（編成〜準備〜再生〜結果）。
  - `index.tsx` パーティ一覧 / `preparation.tsx` 遠征準備 / `edit.tsx` メンバー編集
  - `equipment-list.tsx` 装備一覧 / `equipment.tsx` 装備変更（formSheet）/ `party-info.tsx` パーティ詳細
  - `playback.tsx` 遠征再生 / `result.tsx` 結果 / `log.tsx` 遠征ログ
  - `battle-log.tsx` 戦闘ログ / `level-up-log.tsx` レベルアップログ
- `app/(tabs)/story/` … ストーリー（`index.tsx` 一覧 / `reader.tsx` 本文）。
- `app/(tabs)/encyclopedia.tsx` … 図鑑（ダンジョン/モンスター）。
- `app/(tabs)/settings.tsx` … 設定（デバッグ設定など）。
- `app/base/` … 拠点配下の施設画面。
  - `healing.tsx` 治療所 / `upgrade.tsx` 拠点拡張 / `training.tsx` 訓練所 / `shop.tsx` 装備商店
- `app/goblin/` … ゴブリン個別画面。
  - `_layout.tsx` / `detail.tsx` 詳細 / `equipment.tsx` 装備変更 / `avatar.tsx` アバター
- `app/encyclopedia-detail/` … 図鑑詳細。
  - `[dungeonId].tsx` ダンジョン詳細 / `[dungeonId]/[enemyId].tsx` 敵詳細
- `app/shop.tsx` … 特別商店（課金アイテム）。

## プレゼンテーション層（`src/presentation/`）
- `stores/`（Zustand）
  - `useGoblinStore.ts` / `usePartyStore.ts` / `useBaseStore.ts` / `useDungeonStore.ts` / `useExpeditionStore.ts`
  - `useStoryStore.ts` / `usePurchaseStore.ts` / `useTutorialStore.ts` / `useTutorialOverlayStore.ts` / `useDebugSettingsStore.ts`
- `contexts/`
  - `AuthContext.tsx` / `AuthContextValue.ts`（認証）
  - `ResetContext.tsx`（データリセット）
  - `battleLogStore.ts` / `levelUpLogStore.ts`（戦闘・レベルアップログの一時受け渡し）
- `hooks/`
  - `useExpeditionFlow.ts`（遠征ライフサイクルの中核）/ `useExpeditionNotification.ts`
  - `useEquipmentService.ts` / `useDatabaseInit.ts` / `useSaveDataBackup.ts`
  - `useCurrentTime.ts` / `useTutorialTarget.ts`
- `components/`
  - `GoblinCard.tsx`（ゴブリン表示の主要コンポーネント）
  - `StartScreen.tsx` / `TipsBar.tsx` / `CurrentTimeBadge.tsx` / `GoldBadge.tsx` / `GoldenAcornBadge.tsx`
  - `ExpeditionDropToastHost.tsx` / `TutorialSpotlight.tsx` / `TutorialFinale.tsx`
- `encyclopedia/`
  - `encyclopediaData.ts`（図鑑表示用データ整形）

## コア層（`src/core/`）
- `domain/`
  - `GoblinEntity.ts` / `PartyEntity.ts` / `EnemyEntity.ts`
- `repositories/`（IF）
  - `IGoblinRepository.ts` / `IPartyRepository.ts` / `IBaseStateRepository.ts` / `IPendingGoblinRepository.ts` / `IEquipmentRepository.ts` / `ITicketRepository.ts`
- `services/`（主要なゲームロジック・計算系）
  - 戦闘: `BattleSystem.ts` / `DamageCalculator.ts` / `CombatantManager.ts`
  - 遠征: `ExpeditionEngine.ts` / `LazyExpeditionComputer.ts`
  - 成長/ステータス: `ExperienceSystem.ts` / `GoblinStatCalculator.ts` / `BaseRankSystem.ts`
  - 誕生/因子: `GoblinBirthService.ts` / `BirthSkillService.ts` / `FactorInheritanceService.ts` / `FactorService.ts`
  - 装備/ドロップ: `EquipmentService.ts` / `EquipmentTitleService.ts` / `DropRankRoller.ts` / `LuckRoller.ts`
- `usecases/`
  - 遠征: `StartExpeditionUseCase.ts` / `CompleteExpeditionUseCase.ts` / `ExecuteBattleUseCase.ts`
  - パーティ: `CreatePartyUseCase.ts` / `ManagePartyUseCase.ts` / `ConfigurePartyUseCase.ts` / `UpdatePartyMembersUseCase.ts` / `GetPartyByIdUseCase.ts` / `GetPartyListUseCase.ts`
  - ゴブリン: `GetGoblinByIdUseCase.ts` / `GetGoblinListUseCase.ts` / `DeleteGoblinUseCase.ts`

## インフラ層（`src/infrastructure/`）
- `database/`
  - `schema.ts`: SQLiteスキーマ。
  - `index.ts`: DB初期化/アクセス（シングルトン）。
  - `migrations/v1.ts`〜`v16.ts`: バージョン別マイグレーション。
- `repositories/`（シングルトン、`getInstance()` 取得、内部キャッシュで同期IF提供）
  - `SQLiteGoblinRepository.ts` / `SQLitePartyRepository.ts` / `SQLiteBaseStateRepository.ts`
  - `SQLiteExpeditionRepository.ts` / `SQLitePendingGoblinRepository.ts` / `SQLiteDungeonProgressRepository.ts`
  - `SQLiteEquipmentRepository.ts` / `SQLiteStoryProgressRepository.ts` / `SQLiteTutorialStateRepository.ts` / `SQLiteTicketRepository.ts`
- `backup/`
  - `SaveDataExporter.ts` / `SaveDataImporter.ts` / `BackupFileService.ts` / `BackupSignature.ts`

## 共有データ/型（`src/shared/`）
- `data/`
  - JSON ディレクトリ: `enemy/`（敵）/ `expeditionArea/`（遠征エリア）/ `story/`（ストーリー）
  - 装備: `equipmentPool.json`（ローダ: `equipmentPoolLoader.ts`）/ `equipmentConfig.ts` / `equipmentTitleConfig.ts`
  - スキル: `skillCatalog.ts` / `characterSkills.ts` / `skillBirthRules.ts` / `raceSkills.ts` / `skills.ts`
  - 呪文: `spells.ts` / `mageMagic.ts` / `recoveryMagic.ts`
  - 因子/種族/亜種: `factors.ts` / `goblinVariants.ts` / `races.ts`
  - ゴブリン/ジョブ: `goblinJobs.ts` / `founderGoblin.ts` / `pureGoblin.ts`
  - その他: `tips.json` など
- `i18n/`
  - `index.ts` / `keys.ts` / `entityLocalization.ts`
  - `resources/`: `ja.ts` / `en.ts` / `ko.ts` / `equipment.ts`
- `types/`
  - 主要型: `Goblin.ts` / `Party.ts` / `Expedition.ts` / `Battle.ts` / `Enemy.ts` / `Equipment.ts` / `CharacterSkill.ts` / `Factor.ts` / `Dungeon.ts` / `DungeonTier.ts` / `BaseState.ts` / `Story.ts` / `Tutorial.ts` ほか
- `utils/`
  - 画像: `goblinImages.ts` / `enemyImages.ts` / `factorImages.ts` / `splashImages.ts`
  - 計算: `goblinStats.ts` / `goblinHp.ts` / `enemyStats.ts` / `enemyTierScaling.ts` / `enemyExp.ts` / `scaling.ts` / `healing.ts` / `expeditionFloor.ts` / `expeditionClear.ts`
  - その他: `battleActionPolicy.ts` / `goblinProtection.ts`
- `constants/`
  - `colors.ts` / `purchases.ts` / `layout.ts`

## 補足
- `app/` 配下が画面の主実装で、ロジックは `presentation/hooks` と `presentation/stores` に分散します。
- `assets/` は画像などの静的アセット、`dist/` / `.expo/` / `ios/Pods/` / `ios/build/` は生成物で原則編集対象外です。
- `config/firebase.ts` は外部サービス設定（Firebase）。
