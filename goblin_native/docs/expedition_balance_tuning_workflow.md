# 遠征バランス調整・シミュレーション手順

このドキュメントは、ダンジョンを「目標レベル付近でクリアできる難易度」に調整するための作業手順をまとめる。
会話コンテキストが失われても、この手順を読めば同じ調整を再開できる状態を目標にする。

## 対象ファイル

- エリア設定: `goblin_native/src/shared/data/expeditionArea/{areaId}.json`
- エリア一覧: `goblin_native/src/shared/data/expeditionArea/allArea.json`
- 敵・出現構成: `goblin_native/src/shared/data/enemy/{areaId}.json`
- 検証シナリオ: `goblin_native/scripts/balance/scenarios/{areaId}.json`
- 実行コマンド定義: `goblin_native/package.json`

敵データを変えたら、基本的に同じ `areaId` のシナリオも用意する。
`areaLevel` は表示・目安として、目標クリアレベルに合わせて個別JSONと `allArea.json` の両方を同期する。

## 使用する主なコマンド

作業ディレクトリは `goblin_native`。

```bash
cd goblin_native
```

固定ロードアウトのレベルスイープ:

```bash
npm run sim:balance:reference -- \
  --scenario <areaId> \
  --iterations 120 \
  --level-min <min> \
  --level-max <max>
```

攻略構成の最適化:

```bash
npm run sim:optimize -- \
  --scenario <areaId> \
  --level <targetLevel> \
  --jobs guard,warrior,thief,mage \
  --variants slime,wolf,hobgoblin \
  --cleric forbidden \
  --generations 6 \
  --population 20 \
  --iterations 8 \
  --validation-iterations 100 \
  --top 1 \
  --out reports/strategy-<areaId>-current-lv<targetLevel>.json
```

最適化結果のフロア到達確認:

```bash
node scripts/check-strategy-floor-gates.js \
  --strategy reports/strategy-<areaId>-current-lv<targetLevel>.json \
  --area <areaId> \
  --targets 1,2,3,4,5,all \
  --trials 80
```

検証:

```bash
node -e "for (const f of ['src/shared/data/enemy/<areaId>.json','src/shared/data/expeditionArea/<areaId>.json','scripts/balance/scenarios/<areaId>.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"
npm test -- --runInBand
```

一時レポートの掃除:

```bash
rm -f reports/strategy-<areaId>-current-lv*.json reports/strategy-optimizer-knowledge.json
```

## 前提の決め方

### ジョブ解放

`scripts/run-progression-simulation.js` の `getAvailableJobs()` が基準。

- baseRank 2 未満: ジョブなし
- baseRank 2 以上: `guard,warrior,thief,mage`
- `road_1` クリア後: `cleric` 追加

そのため、`road_1` 以前の調整では原則として:

```bash
--jobs guard,warrior,thief,mage --cleric forbidden
```

`road_1` 以降はクレリック解放済みなので、対象ダンジョンの時点で実際に使えるかを確認してから `cleric` を許可する。

### 装備

序盤から `road_1` までは、現在の調整では rank2 通常装備を基準にした。
シナリオでは以下を指定する。

```json
"equipmentFilter": {
  "maxUnlockRank": 2,
  "maxDropRank": 2
}
```

レア装備を含める場合は、単に `--allow-rare` を使うのではなく、進行・Tierごとの入手可能性を `sim:availability` または `sim:progression` で確認してから扱う。

### 亜種

固定ロードアウトでは、現実的な進行で使える想定として主に以下を使った。

- `slime`: 前衛・耐久枠
- `hobgoblin`: 前衛・火力枠
- `wolf`: 後衛・命中/弓火力枠

注意: 現在の `sim:optimize` は同一亜種の所持数を厳密に制限しない。
最適化結果で `slime` が複数体並ぶことがあるため、最適化結果は「理論上の突破可能性」として扱い、固定ロードアウトの勝率を主指標にする。

## シナリオJSONの基本形

`goblin_native/scripts/balance/scenarios/{areaId}.json` に作る。

```json
{
  "$schema": "balance-reference-scenario-v1",
  "areaId": "bandit_hideout",
  "description": "盗賊のアジト。忘れられた廃墟クリア後を想定し、guard/warrior/thief/mage と rank2 通常装備でLv20攻略を目標にしたシナリオ。クレリックは未解放。",
  "iterations": 200,
  "levelRange": { "min": 15, "max": 25, "step": 1 },
  "equipmentFilter": {
    "maxUnlockRank": 2,
    "maxDropRank": 2
  },
  "loadouts": [
    {
      "name": "A_job_rank2_balanced",
      "description": "目標Lv基準のrank2装備PT。クレリックなしで前衛2枚、弓シーフ2、メイジ1を使う。",
      "party": [
        {
          "name": "スライムガード",
          "variantFactorId": "slime",
          "job": "guard",
          "equipmentTemplateIds": [
            "armor_mithril",
            "shield_mithril",
            "sword_mithril",
            "gauntlet_mithril",
            "armor_armor",
            "shield_shield"
          ]
        },
        {
          "name": "ホブウォリアー",
          "variantFactorId": "hobgoblin",
          "job": "warrior",
          "equipmentTemplateIds": [
            "sword_mithril",
            "armor_mithril",
            "shield_mithril",
            "gauntlet_mithril",
            "sword_long"
          ]
        },
        {
          "name": "通常ウォリアー",
          "job": "warrior",
          "equipmentTemplateIds": [
            "sword_mithril",
            "armor_mithril",
            "shield_mithril",
            "gauntlet_mithril",
            "sword_long"
          ]
        },
        {
          "name": "ウルフシーフ",
          "variantFactorId": "wolf",
          "job": "thief",
          "equipmentTemplateIds": [
            "bow_mithril",
            "gauntlet_mithril",
            "armor_mithril",
            "hidden_mithril_dagger",
            "bow_long"
          ]
        },
        {
          "name": "通常シーフ",
          "job": "thief",
          "equipmentTemplateIds": [
            "bow_mithril",
            "gauntlet_mithril",
            "armor_mithril",
            "hidden_mithril_dagger",
            "bow_long"
          ]
        },
        {
          "name": "通常メイジ",
          "job": "mage",
          "equipmentTemplateIds": [
            "wand_mithril",
            "robe_mithril",
            "gauntlet_mithril",
            "armor_mithril",
            "wand_wand"
          ]
        }
      ]
    }
  ]
}
```

配列順が隊列順になる。
前列に耐久、後列に弓・魔法を置く。

## 敵構成の作り方

基本は6F構成。
各フロアに通常テーブル3つ、固定フロアボス1つを置く。
6F最後に最終ボス編成を置く。

```json
{
  "id": "AREA_03_002",
  "floors": [3],
  "enemies": [
    ["FRONT_A", "FRONT_B"],
    ["BACK_RANGED", "BACK_MAGIC"]
  ]
}
```

```json
{
  "id": "AREA_F3_BOSS",
  "floors": [3],
  "enemies": [
    ["HEAVY_FRONT", "FRONT_A"],
    ["BACK_MAGIC"]
  ],
  "isFloorBoss": true
}
```

```json
{
  "id": "AREA_FINAL",
  "floors": [6],
  "enemies": [
    ["B_BOSS", "HEAVY_FRONT"],
    ["BACK_RANGED", "BACK_MAGIC"]
  ],
  "isFloorBoss": true,
  "isBoss": true
}
```

`attackType: "range"` の敵は後列に置く。
職や敵イメージに合わせ、弓兵・魔術師・術師系は後列、盾・傭兵・大型敵は前列に置く。

## 調整ループ

### 1. 現状確認

```bash
rg -n "<areaId>|<ダンジョン名>" src/shared/data scripts/balance/scenarios
sed -n '1,220p' src/shared/data/expeditionArea/<areaId>.json
sed -n '1,280p' src/shared/data/enemy/<areaId>.json
```

確認するもの:

- `areaLevel`
- `floors`
- `unlockRequires` / `unlockNext`
- 直前ダンジョンで解放されるジョブ・rank
- 既存敵のレベル・HP・火力・防御
- 既存パターンが6F構成か

### 2. 目標レベルと前提を決める

例:

- `bandit_hideout`: Lv20、クレリック未解放、rank2通常装備
- `road_1`: Lv25、クリア前なのでクレリック未解放、rank2通常装備

### 3. 敵データとシナリオを編集

編集対象:

- `src/shared/data/enemy/<areaId>.json`
- `src/shared/data/expeditionArea/<areaId>.json`
- `src/shared/data/expeditionArea/allArea.json`
- `scripts/balance/scenarios/<areaId>.json`

大きなJSON差し替えはNodeで機械生成してよい。
手編集する場合はJSON構文に注意する。

### 4. 固定ロードアウトでスイープ

```bash
npm run sim:balance:reference -- \
  --scenario <areaId> \
  --iterations 120 \
  --level-min <targetLevel-5> \
  --level-max <targetLevel+5>
```

今回の運用では、固定ロードアウトの評価を主指標にした。

目安:

- 目標Lvで50%前後: 「そのLvでも構成や運でクリア可能」
- 目標Lvで70〜80%前後: 「そのLv程度で安定攻略圏」
- 目標Lv-2で80%以上: 簡単すぎる可能性が高い
- 目標Lv+3で50%未満: 難しすぎる可能性が高い

「Lv20程度」「Lv25程度」のような依頼では、厳密にLv20で80%に固定しない。
固定構成と最適化構成の両方を見て、目標Lv周辺で攻略圏に入るかを判断する。

### 5. 最適化シミュレーション

```bash
npm run sim:optimize -- \
  --scenario <areaId> \
  --level <targetLevel> \
  --jobs guard,warrior,thief,mage \
  --variants slime,wolf,hobgoblin \
  --cleric forbidden \
  --generations 6 \
  --population 20 \
  --iterations 8 \
  --validation-iterations 100 \
  --top 1 \
  --out reports/strategy-<areaId>-current-lv<targetLevel>.json
```

見るもの:

- `winRate`
- `rounds`
- 隊列
- 亜種の偏り
- 装備コスト

注意:

- 同一亜種を複数使う非現実的な構成が出ることがある。
- 装備スロット数はレベルで増えるため、Lv差が急に勝率へ出ることがある。
- `reports/strategy-optimizer-knowledge.json` は次回探索の初期集団に影響する。調整中に再現性を重視するなら削除してから実行する。

### 6. フロアゲート確認

最適化で目標Lvが通ったら、どこまで安定するか確認する。

```bash
node scripts/check-strategy-floor-gates.js \
  --strategy reports/strategy-<areaId>-current-lv<targetLevel>.json \
  --area <areaId> \
  --targets 1,2,3,4,5,all \
  --trials 80
```

結果の見方:

- 1F〜2F 100%、深層で崩れる: 段階的な難易度として自然
- 1Fから低勝率: 序盤が硬すぎる
- all 100%かつ平均roundsが短い: 簡単すぎる可能性

### 7. 数値調整

大きく外れた時は倍率で調整する。

簡単すぎる時:

- HPを上げる
- 後半敵とボスのHP/DEFを重点的に上げる
- 後衛攻撃・魔法敵を増やす
- 固定フロアボスを強くする

難しすぎる時:

- ボスHP/DEFを下げる
- 後半フロアの同時出現数を減らす
- 魔法敵・回復敵を減らす
- 命中や攻撃回数を下げる

倍率調整の例:

```js
const fs = require('fs')
const p = 'src/shared/data/enemy/road_1.json'
const data = JSON.parse(fs.readFileSync(p, 'utf8'))
for (const enemy of data.enemies) {
  const boss = enemy.isBoss
  enemy.hp = Math.round(enemy.hp * (boss ? 0.82 : 0.84))
  enemy.atk = Math.round(enemy.atk * (boss ? 0.88 : 0.9))
  if (enemy.magicAtk) enemy.magicAtk = Math.round(enemy.magicAtk * 0.9)
  enemy.def = Math.round(enemy.def * (boss ? 0.86 : 0.88))
  enemy.magicDef = Math.round((enemy.magicDef ?? 0) * 0.9)
}
fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
```

## 今回使った判断基準

| ダンジョン | 目標 | 固定構成の目安 | 最適化構成の目安 |
|---|---:|---|---|
| 森外れの廃村 | Lv12 | Lv12で不安定、Lv13で攻略圏 | Lv12で突破可能 |
| 古井戸の地下水路 | Lv15 | Lv15で50%、Lv17で80%付近 | Lv15で突破可能 |
| 忘れられた廃墟 | Lv18 | Lv18で50%付近 | Lv18で突破可能 |
| 盗賊のアジト | Lv20 | Lv19〜20で攻略圏 | Lv20で突破可能 |
| 街道 | Lv25 | Lv24〜25で80%弱 | Lv25で80%前後 |

固定構成は「現実的な標準PT」。
最適化構成は「AIが見つける攻略可能性」。
両方を見ることで、単純なレベルだけでなく、PT構成・装備・隊列改善で攻略できるかを確認する。

## レアドロップ・Tierを考慮する場合

今回の序盤調整では、原則として通常rank2装備を前提にした。
レアドロップを本格的に考慮する場合は、攻略済みダンジョンと到達Tierから入手可能性を計算する。

```bash
npm run sim:progression -- \
  --through <areaId> \
  --tiers slime_cave:1,goblin_village_1:0 \
  --level-sweep <min>:<max>:1 \
  --generations 5 \
  --population 12 \
  --iterations 3 \
  --validation-iterations 20
```

出力:

- `reports/progression-<areaId>/summary.json`
- `reports/progression-<areaId>/summary.compact.json`
- `reports/progression-<areaId>/summary.report.txt`

通常読むのは `summary.report.txt` と `summary.compact.json`。
`summary.json` は大きくなりやすい。

## 最終確認

必ず行う:

```bash
node -e "for (const f of ['src/shared/data/enemy/<areaId>.json','src/shared/data/expeditionArea/<areaId>.json','scripts/balance/scenarios/<areaId>.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"
npm test -- --runInBand
```

テストが確率系で一度だけ落ちた場合は、該当テスト単体と全体を再実行する。
再現するなら修正対象。再現しないなら最終報告に「初回のみ落ちたが再実行で通過」と明記する。

## 作業後に消すもの

シミュレーション中の一時出力は、共有成果物でなければ消す。

```bash
rm -f reports/strategy-<areaId>-current-lv*.json
rm -f reports/strategy-optimizer-knowledge.json
```

残すもの:

- 敵JSON
- エリアJSON
- `allArea.json`
- シナリオJSON
- 必要なら人間が読む `.md` / `.txt` レポート

## 注意点

- `git status --short` で既存の未コミット変更を確認し、無関係な変更を戻さない。
- `dist/` や生成物は触らない。
- `areaLevel` は個別エリアJSONと `allArea.json` の両方を同期する。
- 敵IDは既存参照がある場合はできるだけ維持する。
- `attackType: "range"` の敵は後列に置く。
- ボスの `rareEquipmentDrops` / `factorDrops` は、意図がなければ消さない。
- 最適化結果だけで難易度を決めない。固定ロードアウトのスイープと併用する。
