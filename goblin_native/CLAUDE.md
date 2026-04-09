# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## 概要

- このリポジトリは `goblin_native` 単体の Expo / React Native アプリです。
- ゴブリンを管理し、パーティを編成して遠征・戦闘を行うモバイルゲームを実装しています。
- 技術構成は Expo SDK 54 / React Native 0.81 / React 19 / TypeScript / Expo Router / SQLite / Zustand / Jest です。

## コミュニケーション

- 返信、レビュー、提案、コミットメッセージ案は日本語で簡潔かつ丁寧に記述してください。
- 以前の `goblin_ink` / `goblin_web` 前提の説明は無視し、このリポジトリの現行構成だけを参照してください。

## よく使うコマンド

```bash
# 開発サーバー
npm start

# ネイティブ実行
npm run ios
npm run android

# Web 確認
npm run web

# テスト
npm test

# 型チェック
npx tsc --noEmit
```

## 主要構成

```text
app/                    Expo Router 画面
  (tabs)/               タブ配下の主要画面
  base/                 拠点関連画面
  goblin/               ゴブリン詳細・装備画面
assets/                 画像などの静的アセット
docs/                   仕様・設計ドキュメント
src/
  config/               Firebase 設定
  core/                 ドメイン・サービス・ユースケース
  infrastructure/       SQLite / Repository 実装
  presentation/         UI 用 hooks / contexts / stores / components
  shared/               型・定数・マスターデータ・ユーティリティ
  types/                型拡張
ios/                    Expo prebuild 済み iOS ネイティブプロジェクト
```

## 画面構成

- `app/_layout.tsx`
  - ルートレイアウト。DB 初期化や Provider 設定の起点です。
- `app/(tabs)/_layout.tsx`
  - タブ構成の定義です。
- `app/(tabs)/index.tsx`
  - ゴブリン一覧のメイン画面です。
- `app/(tabs)/base.tsx`
  - 拠点トップ画面です。
- `app/base/training.tsx`, `app/base/upgrade.tsx`
  - 拠点機能の個別画面です。
- `app/(tabs)/formation/`
  - 編成、遠征準備、再生、ログ、結果、装備変更を含む遠征フローです。
- `app/goblin/detail.tsx`, `app/goblin/equipment.tsx`
  - ゴブリン詳細と装備変更画面です。

## アーキテクチャ

- ベースは Clean Architecture です。
- 依存方向は `presentation -> core/usecases -> core/domain|services -> repositories interface -> infrastructure` を保ちます。
- `src/core` には React Native / Expo 依存を持ち込まないでください。
- Repository 実装は `src/infrastructure/repositories` に置き、永続化は SQLite を前提にしています。
- 画面側では Context と Zustand store が共存しているため、新規 state は更新頻度と責務に応じて配置を選んでください。

## 実装上の要点

- パスエイリアスは `@/* -> src/*` です。
- ルーティングは Expo Router のファイルベースです。
- Jest は `ts-jest` を使い、`src/` 配下を対象にしています。
- SVG は `react-native-svg-transformer` で扱います。
- Expo 設定は [`app.json`](/Users/astapi/projects/goblinKingdom/goblin_native/app.json) を参照してください。
- Firebase 設定は [`src/config/firebase.ts`](/Users/astapi/projects/goblinKingdom/goblin_native/src/config/firebase.ts) にあります。

## 優先して見る場所

- 画面仕様: [`docs/screen_reference.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/screen_reference.md)
- 全体構成: [`docs/project_structure.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/project_structure.md)
- 実装ガイド: [`docs/implementation_guide.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/implementation_guide.md)
- 残タスク: [`docs/remaining_tasks.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/remaining_tasks.md)
- SQLite 関連: [`docs/sqlite_migration.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/sqlite_migration.md)

## 作業時の注意

- `dist/`, `.expo/`, `ios/Pods/`, `ios/build/` などの生成物は原則として編集対象にしません。
- 設定や構成を変更する場合は、Expo managed workflow と prebuild 済み iOS プロジェクトの両方への影響を確認してください。
- 大きい一覧やログ画面は、再レンダー範囲と描画コストを意識して実装してください。
- ドキュメント更新時は、存在しない旧ディレクトリや旧ファイル名を参照しないでください。
