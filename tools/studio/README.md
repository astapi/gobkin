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

## バランス調整の戦略PTで測る

バランスシミュレータ（`goblin_native/scripts/balance/`）の戦略ペルソナが山登り探索で組んだ
「隊列・ジョブ・亜種・装備」を、studio のシミュレーション画面から同じ構成で実行できる。

```bash
# goblin_native 側でビルドを書き出す（scripts/balance/out/strategist-builds.json に保存）
cd ../../goblin_native
node scripts/balance/exportStrategistBuilds.js --all          # 全エリア（重い）
node scripts/balance/exportStrategistBuilds.js spider_forest_1 # 単体
node scripts/balance/exportStrategistBuilds.js --tier 3 --level 120 vampire_castle_1
```

書き出すと、シミュレーション画面の「PT」セレクタに `[戦略] <areaId> Tier<n>` が並ぶ。
選ぶとエリア・Tier が自動で合い、隊列/ジョブ/装備のプレビューが出る。
レベルは任意に変更でき、装備枠数はそのレベルで再計算される（`measureArea.js` が
レベル走査で行っているのと同じ処理）。

- `--level` は探索を行うレベル。既定の 3 は `measureArea.js` がレベルグリッド下端から
  探索する挙動をそのまま再現する（`docs/balance_progress.md` の「Lv3盲目探索」）。
  高Tierの実力を見たい場合は `probeOptimalBuild.js` と同様に高いレベルを明示する
- ゴブリンの組み立て手順は `src/lib/strategistParty.ts` にあり、シミュレータ側の
  `scripts/balance/headless/strategistLayer.js` の buildStrategistGoblin と同一。
  片方を変更したら必ずもう片方も合わせ、`node scripts/balance/verifyStrategistBuilds.js`
  （goblin_native 側）でPTが一致することを確認する。この検証は studio の TS を実際に
  読み込んで実行し、effectiveStats / skills まで突き合わせる

## データ保存について
- ダンジョン/敵データ: `/api/dungeons` 経由で `../../goblin_native/src/shared/data/expeditionArea/*.json` と `../../goblin_native/src/shared/data/enemy/*.json` を直接読み書きする。変更は即 JSON に書き戻され、`git diff` で確認・コミット可能
- PTプリセット: `/api/party-presets` 経由で `tools/studio/data/party-presets.json` に保存される。デフォルトで `.gitignore` 済み（個人作業用）。チームで共有したい場合は `.gitignore` から `data/` を外してコミット
- 戦略ビルド: `/api/strategist-builds` 経由で `goblin_native/scripts/balance/out/strategist-builds.json` を読み取り専用で参照する。書き込みは `exportStrategistBuilds.js` だけが行い、git 管理下なので `git diff` でビルドの変化をレビューできる
- セーブデータ（SQLite / バックアップJSON）には一切書き込まない。バックアップは読み取り専用でメモリ上のみ保持

## 実装ロードマップ
- [x] Step 1: scaffolding（一覧/詳細・読み取り確認）
- [x] Step 2: 閲覧 UI 強化（敵一覧・パターン表示）
- [x] Step 3: 編集＋保存（エリア設定・敵ステータス・パターン）
- [x] Step 4: エンカウントテーブル編集 UI 強化（ドラッグ配置・敵パレット）
- [x] Step 5: PT 編成（バックアップ JSON 読み込み対応）
- [x] Step 6: ダンジョン別シミュレーション（ExpeditionEngine 直接実行）
- [x] Step 7: バランス調整の戦略PT・装備でのシミュレーション実行
