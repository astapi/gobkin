# Goblin Studio

ゴブリンキングダムのダンジョン/敵データを閲覧・編集し、シミュレーションを実行するローカル開発ツール。

## 前提
- Node.js 22 系（リポジトリ直下の `.node-version` に合わせる）
- `../../goblin_native/src/` を TypeScript / Vite から直接参照するため、同リポジトリに配置されている必要がある

## セットアップ
```bash
cd tools/studio
npm install
npm run dev
```

デフォルトで http://localhost:5180 で起動する。

## データ保存について
- ダンジョン/敵データ: `/api/dungeons` 経由で `../../goblin_native/src/shared/data/expeditionArea/*.json` と `../../goblin_native/src/shared/data/enemy/*.json` を直接読み書きする。変更は即 JSON に書き戻され、`git diff` で確認・コミット可能
- PTプリセット: `/api/party-presets` 経由で `tools/studio/data/party-presets.json` に保存される。デフォルトで `.gitignore` 済み（個人作業用）。チームで共有したい場合は `.gitignore` から `data/` を外してコミット
- セーブデータ（SQLite / バックアップJSON）には一切書き込まない。バックアップは読み取り専用でメモリ上のみ保持

## 実装ロードマップ
- [x] Step 1: scaffolding（一覧/詳細・読み取り確認）
- [x] Step 2: 閲覧 UI 強化（敵一覧・パターン表示）
- [x] Step 3: 編集＋保存（エリア設定・敵ステータス・パターン）
- [x] Step 4: エンカウントテーブル編集 UI 強化（ドラッグ配置・敵パレット）
- [x] Step 5: PT 編成（バックアップ JSON 読み込み対応）
- [x] Step 6: ダンジョン別シミュレーション（ExpeditionEngine 直接実行）
