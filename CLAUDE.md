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
# 開発サーバーの起動
cd goblin_web
npm run dev

# ビルド
npm run build

# Lint
npm run lint

# プレビュー
npm run preview
```

### goblin_ink (CLIバトル)

```bash
# 開発モードで実行（ビルド＋実行）
cd goblin_ink
npm run dev

# ビルド
npm run build

# 実行
npm start

# Watchモード
npm run watch
```

## アーキテクチャ

### goblin_web の設計パターン

**リポジトリパターン**を採用し、データアクセス層を抽象化しています：

- **Repositoryインターフェース**: `src/repositories/` 配下に定義
  - `GoblinRepository`: ゴブリンデータの管理
  - `PartyRepository`: パーティ編成の管理
  - `ItemRepository`: アイテムデータの管理

- **Repository実装**:
  - `FirestoreXxxRepositoryImpl`: Firestore を使った本番用実装
  - `JsonXxxRepositoryImpl`: JSONファイルを使った開発用実装

**データの流れ**:
1. UIコンポーネントが Repository インターフェースを通してデータ操作
2. Firestore/JSON のどちらを使うかは Repository 実装で切り替え
3. `AuthContext` がユーザー認証状態を管理
4. `ExpeditionStateContext` が遠征状態を管理

### コアシステム

**ExpeditionEngine** (`goblin_web/src/core/ExpeditionEngine.ts`):
- 遠征のシミュレーションエンジン
- シード値を使った決定論的な乱数生成により、再現可能なリプレイを生成
- `TimelineEvent` の配列として遠征の全イベントを記録

**Battle System** (`goblin_web/src/core/battle.ts`):
- ターン制戦闘ロジック
- ダメージ計算、戦闘ログ生成
- 敵AIと捕獲判定を含む

**Combatant** (`goblin_web/src/core/combatant.ts`):
- ゴブリンと敵の戦闘中の状態管理
- HP、攻撃力、防御力、素早さなどのパラメータ管理

### 型定義

主要な型定義は `goblin_web/src/types/index.ts` に集約されています：

- `Goblin`: ゴブリンの基本データ（ID、名前、種族、レベル、ステータス、装備）
- `Party`: パーティ情報（メンバーID、ステータス、遠征設定）
- `ExpeditionRequest`: 遠征リクエスト（パーティID、エリアID、帰還ポリシー）
- `ExpeditionReplay`: 遠征のリプレイデータ（イベントタイムライン、報酬サマリ）
- `TimelineEvent`: 遠征中のイベント（移動、戦闘、資源発見、罠など）
- `Enemy`: 敵キャラクターのデータ
- `Item`: アイテムデータと効果

### 画面構成

詳細は `SCREEN_DOCUMENTATION.md` を参照してください。主要な画面：

- `GoblinListScreen`: ゴブリン一覧
- `DungeonScreen`: ダンジョン選択
- `PartyEditScreen`: パーティ編成
- `ExpeditionSetupScreen`: 遠征設定（帰還条件の選択）
- `ExpeditionPlaybackScreen`: 遠征のリアルタイム再生
- `ExpeditionResultScreen`: 遠征結果表示（アニメーション付き）
- `FormationScreen`: パーティ管理と遠征履歴

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
