# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

ゴブリンキングダムRPGは、ゴブリンを管理し、ダンジョンへの遠征を行うブラウザベースのゲームプロジェクトです。
TypeScriptとReactで実装された**Webアプリ**（`goblin_web`）と、ターミナル上で動作する**CLIバトルシステム**（`goblin_ink`）の2つのサブプロジェクトから構成されています。

## プロジェクト構成

- `goblin_web/`: React + Vite + TypeScript (Webアプリケーション)
- `goblin_ink/`: React Ink + TypeScript (CLIバトルシステム)

## よく使うコマンド

### goblin_web (Webアプリケーション)

```bash
cd goblin_web

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# Lint
npm run lint

# テスト (Vitest)
npm run test          # watchモード
npm run test:ui       # UI付きテスト

# 単一テストファイルの実行
npx vitest run src/core/services/BattleSystem.test.ts

# プレビュー
npm run preview
```

### goblin_ink (CLIバトル)

```bash
cd goblin_ink

# 開発モードで実行（ビルド＋実行）
npm run dev

# ビルド
npm run build

# 実行
npm start

# Watchモード
npm run watch
```

## アーキテクチャ

**詳細**:
- [goblin_web/docs/architecture.md](goblin_web/docs/architecture.md): アーキテクチャ設計
- [goblin_web/docs/current_implementation.md](goblin_web/docs/current_implementation.md): 現在の実装状況

このプロジェクトは将来的なUnity等への移植を見据えて設計されています。コアロジックはプラットフォーム非依存に保ち、UI層のみが環境固有となるよう層分離されています。

### goblin_web のディレクトリ構成

```
goblin_web/src/
├── core/                    # 【移植対象】プラットフォーム非依存
│   ├── domain/              # ドメインエンティティ
│   │   ├── GoblinEntity.ts
│   │   ├── PartyEntity.ts
│   │   ├── EnemyEntity.ts
│   │   └── ItemEntity.ts
│   ├── usecases/            # ユースケース（ビジネスロジック）
│   │   ├── StartExpeditionUseCase.ts
│   │   ├── CompleteExpeditionUseCase.ts
│   │   ├── CreatePartyUseCase.ts
│   │   └── ...
│   ├── services/            # ゲームシステム
│   │   ├── ExpeditionEngine.ts    # 遠征シミュレーション
│   │   ├── BattleSystem.ts        # 戦闘システム
│   │   ├── BaseManagementService.ts  # 拠点管理
│   │   ├── GoblinBirthService.ts  # ゴブリン生成
│   │   └── ExperienceSystem.ts    # 経験値システム
│   └── repositories/        # Repositoryインターフェース
│       ├── IGoblinRepository.ts
│       ├── IPartyRepository.ts
│       └── IItemRepository.ts
├── infrastructure/          # 【部分移植】データ永続化実装
│   └── repositories/
│       ├── FirestoreXxxRepositoryImpl.ts  # 本番用
│       └── JsonXxxRepositoryImpl.ts       # 開発用
├── presentation/            # 【非移植】UI層（React固有）
│   ├── components/          # 画面コンポーネント
│   ├── contexts/            # React Context
│   └── hooks/               # カスタムフック
└── shared/                  # 共通データ・型定義
    ├── types/
    └── data/
```

### 設計パターン

**リポジトリパターン**を採用し、データアクセス層を抽象化しています：

- **Repositoryインターフェース**: `src/core/repositories/` に定義
- **Repository実装**: `src/infrastructure/repositories/` に配置
  - `FirestoreXxxRepositoryImpl`: Firestore を使った本番用実装
  - `JsonXxxRepositoryImpl`: JSONファイルを使った開発用実装

**データの流れ**:
1. UIコンポーネント → UseCase → Repository という依存方向
2. Firestore/JSON のどちらを使うかは Repository 実装で切り替え
3. `AuthContext` がユーザー認証状態を管理
4. `ExpeditionStateContext` が遠征状態を管理

### コアシステム

**ExpeditionEngine** (`src/core/services/ExpeditionEngine.ts`):
- 遠征のシミュレーションエンジン
- シード値を使った決定論的な乱数生成により、再現可能なリプレイを生成
- `TimelineEvent` の配列として遠征の全イベントを記録

**BattleSystem** (`src/core/services/BattleSystem.ts`):
- ターン制戦闘ロジック
- ダメージ計算、戦闘ログ生成
- 敵AIを含む

**BaseManagementService** (`src/core/services/BaseManagementService.ts`):
- 拠点の状態管理と自動ゴブリン生成

**GoblinBirthService** (`src/core/services/GoblinBirthService.ts`):
- ゴブリンの生成ロジック

### 型定義

主要な型定義は `goblin_web/src/shared/types/` に集約されています：

- `Goblin`: ゴブリンの基本データ（ID、名前、種族、レベル、ステータス、装備）
- `Party`: パーティ情報（メンバーID、ステータス、遠征設定）
- `ExpeditionRequest`: 遠征リクエスト（パーティID、エリアID、帰還ポリシー）
- `ExpeditionReplay`: 遠征のリプレイデータ（イベントタイムライン、報酬サマリ）
- `TimelineEvent`: 遠征中のイベント（移動、戦闘、資源発見、罠など）
- `Enemy`: 敵キャラクターのデータ
- `Item`: アイテムデータと効果

### 画面構成

主要な画面（`src/presentation/components/`）：

- `GoblinListScreen`: ゴブリン一覧
- `DungeonScreen`: ダンジョン選択
- `PartyEditScreen`: パーティ編成
- `ExpeditionSetupScreen`: 遠征設定（帰還条件の選択）
- `ExpeditionPlaybackScreen`: 遠征のリアルタイム再生
- `ExpeditionResultScreen`: 遠征結果表示（アニメーション付き）
- `FormationScreen`: パーティ管理と遠征履歴
- `BaseManagementScreen`: 拠点管理

### goblin_ink のバトルシステム

DQ形式のターン制コマンドバトルを実装：

- `spec.md` にバトルシステムの仕様を記載
- 物理攻撃、魔法攻撃、回復、防御、逃走コマンド
- 簡易AI実装（敵の行動パターン）
- Ink (React for CLI) を使用したターミナルUI

主要ファイル：
- `src/types.ts`: 型定義
- `src/data.ts`: キャラクター・スキルデータ
- `src/battle.ts`: バトルシステムコア
- `src/ai.ts`: 敵AI
- `src/components/BattleScreen.tsx`: バトルUI

## 遠征システムの帰還ポリシー

遠征の帰還条件を設定可能：
- `never`: 最後まで探索
- `until_floor2`: 2階で帰還
- `until_floor3`: 3階で帰還
- `if_any_ko`: 誰か1人でも倒れたら帰還
- `last_one`: 最後の1人になったら帰還

## Firebase設定

`goblin_web` はFirebaseを使用：
- Firestore: データ永続化
- Firebase Authentication: ユーザー認証
- 設定ファイル: `goblin_web/src/config/firebase.ts`

## 開発時の注意点

- `goblin_web` と `goblin_ink` は独立したプロジェクトなので、それぞれで `npm install` が必要
- Firestoreを使う場合は適切なFirebase設定が必要
- 遠征システムはシード値ベースなので、同じシードで同じ結果を再現できる
- アイテム装備機能は最近追加されたので、既存のゴブリンデータに `equipment` フィールドが必要
