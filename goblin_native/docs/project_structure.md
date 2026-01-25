# goblin_native ディレクトリ構成・コンポーネント概要

## 関連ドキュメント
- [screen_reference.md](./screen_reference.md) 画面リファレンス
- [implementation_guide.md](./implementation_guide.md) 実装順序ガイド
- [migration_tasks.md](./migration_tasks.md) 移行タスク一覧
- [sqlite_migration.md](./sqlite_migration.md) SQLite移行設計

## 目的
- アプリの全体構成（画面/ドメイン/データ/インフラ）を俯瞰し、改修時の参照点を整理します。

## 主要ディレクトリ

```
app/                       Expo Router 画面（タブ/画面レイアウト）
assets/                    画像などの静的アセット
docs/                      プロジェクト内ドキュメント
src/                       アプリ本体（ドメイン/ユースケース/インフラ/プレゼンテーション）
  config/                  外部サービス設定（例: Firebase）
  core/                    ドメイン・ユースケース・サービス
    domain/                エンティティ
    repositories/          リポジトリIF
    services/              ゲームロジック/計算系
    usecases/              アプリケーションユースケース
  infrastructure/          DB・リポジトリ実装
    database/              SQLiteスキーマ/初期化/マイグレーション
    repositories/          SQLiteリポジトリ
  presentation/            UIの状態管理レイヤ
    contexts/              Context/Store
    hooks/                 画面ロジック用カスタムフック
    components/            共有UIコンポーネント（現時点は空）
  shared/                  共通定義/データ/ユーティリティ
    constants/             定数
    data/                  マスターデータ（敵/遠征エリア/因子/Mod など）
    types/                 型定義
    utils/                 画像マッピング/スケーリングなど
  types/                   型拡張（例: svg.d.ts）
```

## 画面（`app/`）
- `app/_layout.tsx`
  - ルートレイアウト。
  - アプリ起動時にDBとリポジトリを初期化（シングルトンパターン）。
  - 初期化完了までローディング画面を表示。
- `app/(tabs)/_layout.tsx`
  - タブ構成のレイアウト定義。
- `app/(tabs)/index.tsx`
  - ゴブリン一覧/詳細（モーダル）などのUI。
- `app/(tabs)/base.tsx`
  - 拠点管理（拠点ステータス、保留ゴブリンの受入/追放）。
- `app/(tabs)/formation/`
  - 遠征（編成〜再生〜結果）フロー。
  - `index.tsx`: 入口/編成メニュー
  - `preparation.tsx`: 遠征準備
  - `edit.tsx`: パーティ編成編集
  - `playback.tsx`: 遠征/戦闘の再生
  - `log.tsx`: 遠征ログ
  - `battle-log.tsx`: 戦闘ログ
  - `result.tsx`: 遠征結果

## プレゼンテーション層（`src/presentation/`）
- `contexts/`
  - `AuthContext.tsx` / `AuthContextValue.ts`: 認証状態の保持。
  - `ExpeditionStateContext.tsx` / `ExpeditionStateContextValue.ts`: 遠征状態の保持。
  - `battleLogStore.ts`: バトルログのストア。
- `hooks/`
  - 全てのhooksは `getInstance()` でシングルトンリポジトリを取得。
  - アプリ起動時に既に初期化済みのため、データ取得のみを実行。
  - 主なhooks:
    - `useGoblinService.ts`: ゴブリン取得・保存・削除など。
    - `usePartyService.ts`: パーティ操作。
    - `useExpeditionService.ts` / `useExpeditionFlow.ts`: 遠征操作・フロー管理。
    - `usePendingGoblins.ts`: 保留ゴブリン管理。
    - `useBaseState.ts`: 拠点状態。
    - `useDungeonProgress.ts`: ダンジョン進行。
    - `useCurrentTime.ts`: 時刻ユーティリティ。

## コア層（`src/core/`）
- `domain/`
  - `GoblinEntity.ts` / `PartyEntity.ts` / `EnemyEntity.ts` などのエンティティ。
- `repositories/`
  - `IGoblinRepository.ts` / `IPartyRepository.ts` などのIF。
- `services/`
  - 戦闘/成長/因子/Mod 計算など（例: `BattleSystem.ts`, `ExperienceSystem.ts`, `ModStatCalculator.ts`）。
- `usecases/`
  - 遠征開始/完了/戦闘実行/パーティ管理などのユースケース。

## インフラ層（`src/infrastructure/`）
- `database/`
  - `schema.ts`: SQLiteスキーマ。
  - `migrations/v1.ts`: 初期マイグレーション。
  - `migrations/v2.ts`: v2マイグレーション（unlock_notified追加）。
  - `index.ts`: DB初期化/アクセス（シングルトンパターン）。
- `repositories/`
  - 全てのリポジトリは**シングルトンパターン**を採用。
  - `getInstance()` メソッドでインスタンスを取得。
  - 内部キャッシュを使用して同期的なインターフェースを提供。
  - 主なリポジトリ:
    - `SQLiteGoblinRepository.ts`
    - `SQLitePartyRepository.ts`
    - `SQLiteBaseStateRepository.ts`
    - `SQLiteExpeditionRepository.ts`
    - `SQLitePendingGoblinRepository.ts`
    - `SQLiteDungeonProgressRepository.ts`

## 共有データ/型（`src/shared/`）
- `data/`
  - `enemy/` / `expeditionArea/` のJSON
  - `modPool.json` / `modPoolLoader.ts`
  - `skills.ts` / `races.ts` / `factors.ts`
- `types/`
  - `Goblin.ts` / `Party.ts` / `Expedition.ts` / `Battle.ts` などの型定義。
- `utils/`
  - `goblinImages.ts` / `factorImages.ts` / `scaling.ts`
- `constants/`
  - `colors.ts`

## 補足
- `dist/` はビルド成果物。
- `assets/` は画像などの静的アセット。
- `config/firebase.ts` は外部サービス設定（Firebase）。
