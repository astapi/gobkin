# AGENTS.md

## 概要

- このリポジトリは `goblin_native` 単体の Expo / React Native アプリです。
- 旧構成の `goblin_ink` や `goblin_web` は存在しません。作業時は現在のディレクトリ構成のみを前提にしてください。

## コミュニケーション

- すべて日本語で、簡潔かつ丁寧に記述してください。
- 提案やレビューでは、実ファイルと実装済み構成に基づいて説明してください。

## プロジェクト構成

```text
app/                    Expo Router の画面
assets/                 画像などの静的アセット
docs/                   仕様・設計ドキュメント
src/
  config/               Firebase 設定
  core/                 ドメイン / サービス / ユースケース
  infrastructure/       SQLite / Repository 実装
  presentation/         components / contexts / hooks / stores
  shared/               constants / data / types / utils
  types/                型拡張
ios/                    Expo prebuild 済み iOS プロジェクト
```

## 技術スタック

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Expo Router
- expo-sqlite
- Zustand
- Jest + ts-jest

## 主要コマンド

```bash
npm start
npm run ios
npm run android
npm run web
npm test
npx tsc --noEmit
```

## 実装ルール

- `src/core` はプラットフォーム非依存を維持し、React Native / Expo 依存を入れないでください。
- 依存方向は `presentation -> core -> infrastructure` を崩さないでください。
- パスエイリアスは `@/* -> src/*` です。
- 画面遷移は Expo Router のファイルベースルーティングに従ってください。
- 永続化は SQLite 前提です。Repository 実装は `src/infrastructure/repositories` に集約してください。
- UI 状態は Context と Zustand store が混在しているため、責務と更新頻度に応じて配置を選んでください。

## 参照先

- 画面仕様: [`docs/screen_reference.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/screen_reference.md)
- 全体構成: [`docs/project_structure.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/project_structure.md)
- 実装ガイド: [`docs/implementation_guide.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/implementation_guide.md)
- 残タスク: [`docs/remaining_tasks.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/remaining_tasks.md)
- SQLite: [`docs/sqlite_migration.md`](/Users/astapi/projects/goblinKingdom/goblin_native/docs/sqlite_migration.md)

## 注意点

- `dist/`, `.expo/`, `ios/Pods/`, `ios/build/` などの生成物は通常編集しません。
- 構成変更時は `app.json`, `babel.config.js`, `metro.config.js`, `jest.config.js`, `tsconfig.json` の整合性を確認してください。
- 古いドキュメントを更新する際は、存在しないディレクトリ名や画面名を残さないでください。
