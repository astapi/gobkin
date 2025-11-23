# Repository Guidelines（リポジトリガイドライン）

## プロジェクト構成とモジュール配置
- `goblin_ink/` は Ink 製 CLI バトルシミュレーター。ゲームロジックは `src/battle.ts`・`src/ai.ts`、UI は `src/components/` 配下、ビルド成果物は `dist/` に出力されます。
- `goblin_web/` は Vite + React クライアント。機能別に `components/`、`contexts/`、`services/`、`repositories/`、`shared/` を分離し、静的アセットは `public/`、ビルド成果物は `dist/` に配置します。画面仕様は `SCREEN_DOCUMENTATION.md`、遠征ロジックは `EXPEDITION_IMPLEMENTATION.md` と `goblin_ink/spec.md` を参照してください。

## コミュニケーション方針
- Issue、Pull Request、レビューコメント、ドキュメント更新はすべて日本語で行ってください。

## ビルド・テスト・開発コマンド
- パッケージごとに依存を導入します（例：`cd goblin_ink && npm install`、`cd ../goblin_web && npm install`）。
- CLI 側: `npm run dev` でホットリロード、`npm run watch` は `tsc` 常駐、`npm run build` と `npm start` でビルド済みバンドルを実行します。
- Web 側: `npm run dev` で Vite 開発サーバー（デフォルト `5173`）、`npm run build` で TypeScript 参照ビルド後にバンドル、`npm run preview` で生成物を確認、`npm run lint` で ESLint を実行します。

## コーディングスタイルと命名規則
- TypeScript は `strict` 設定。公開 API には明示的な型注釈を付け、2 スペースインデント・シングルクォートを維持してください（Ink 側はセミコロンあり、Web 側は現状なし）。
- React のコンポーネントやコンテキスト、画面は `PascalCase`、カスタムフックは `use` で始め、サービスやリポジトリは用途を表す `CamelCase` クラス名に統一します。
- バレルファイル追加より明示的な import を優先し、Web では `npm run lint`、CLI では `tsc` をコミット前の最低ラインとします。

## テストガイドライン
- 自動テストは `goblin_web/src/services/ExpeditionEngine.test.ts` が中心です。Web 開発サーバー起動後、ブラウザコンソールで `runExpeditionTests()` を実行して遠征ロジックを検証します。
- 新規テストは対象モジュール横に `.test.ts` を追加し、ヘッドレス代替がない限りブラウザグローバルの露出を避けてください。
- 戦闘パラメータ、遠征生成、永続化を変更する際は PR へ手動検証結果（ログやスクリーンショット）を残します。

## プロジェクト概要
- `goblin_ink/`: DQ 形式のターン制コマンドバトルを TypeScript で実装した CLI 版。4 人 PT（ゴブリン軍）と 3 体の敵（人間軍）が物理・魔法攻撃や防御・逃走コマンドで戦う簡易 AI 付きのシミュレーターです。`npm run build` / `npm start` でビルド・実行し、`src/` には型定義・データ・バトル/AI/UI/メインループが分割配置されています。[^goblin-ink]
- `goblin_web/`: React + TypeScript + Vite 製のクライアントで、遠征（Expedition）機能をプリコンピュート方式で再生します。ダンジョン選択からパーティ編成・帰還条件設定、タイムライン再生、結果表示まで一連の UI が実装済みで、遠征エンジン・型定義・データを `src/services` / `src/types` / `src/data` にまとめています。未実装としてローカル保存や履歴表示などの段階 6 タスクが残っています。[^goblin-web]

[^goblin-ink]: 詳細は `goblin_ink/README.md` を参照してください。
[^goblin-web]: 詳細は `goblin_web/EXPEDITION_IMPLEMENTATION.md` を参照してください。

## コミットと Pull Request 方針
- Git 履歴に沿い `fix:`・`feat:`・`chore:` などの Conventional Commits を用い、短く要点をまとめます。追加説明は本文で補足してください。
- ブランチ名は作業範囲を示すスラッグ（例：`feature/expedition-balancing`）。PR では影響するパッケージと関連資料・Issue を明記します。
- すべての PR に概要の箇条書き、テスト証跡（コンソール出力や UI キャプチャ）、残タスクを添え、メンテナーへのレビュー依頼を行います。

## セキュリティと設定のヒント
- `goblin_web/.env.example` を `.env.local` にコピーし、Firebase キーを設定。Firestore と localStorage の切り替えは `VITE_USE_FIRESTORE` で制御します。
- `README_FIREBASE.md` に沿って Firestore ルールを検証し、シークレットやサービスアカウント、生成された `dist/` はリポジトリに含めないでください。
