# 進行状況別の入手可能装備分析

`scripts/analyze-progression-availability.js` は、制圧済みダンジョンと到達済み Tier から、現在入手可能な装備と因子を集計する。

## 基本実行

```bash
npm run sim:availability -- \
  --cleared slime_cave,goblin_village_1 \
  --tiers slime_cave:1,goblin_village_1:0 \
  --out reports/availability-example.json
```

`--all-cleared-through <areaId>` を使うと、`allArea.json` の並びで指定ダンジョンまで制圧済みとして扱う。

```bash
npm run sim:availability -- \
  --all-cleared-through goblin_village_1 \
  --tiers slime_cave:1 \
  --out reports/availability-goblin-village.json
```

## 集計対象

- 店売り相当装備: 制圧済みダンジョンの `rankUpTarget` から到達拠点ランクを算出し、`unlockRank <= baseRank` の非レア装備を含める。
- 通常ドロップ相当装備: 制圧済みダンジョンと Tier の敵レベルから、出現し得る最大ドロップランク以下の非レア装備を含める。
- レア装備: 敵 JSON の `rareEquipmentDrops` と、`tier <= 現在Tier` を満たす `tierRareEquipmentDrops` を含める。
- 因子: 敵 JSON の `factorDrops` を、`minDungeonTier` 条件込みで含める。

未制圧だが解放済みのダンジョンを候補に含めたい場合は `--include-unlocked` を指定する。
通常の攻略前提では指定しない。

## optimizer 連携

生成した JSON は `sim:optimize` の `--availability` に渡せる。

```bash
npm run sim:optimize -- \
  --scenario goblin_village_1 \
  --level 12 \
  --availability reports/availability-goblin-village.json
```

`--availability` 指定時は、JSON 内の `availableEquipment` だけを装備候補にする。
この場合、レア装備は可用性分析で入手可能と判定されたものだけが候補に入る。

## 進行段階ごとにまとめて検証する

`sim:progression` は、`allArea.json` の並びで指定地点まで進めながら、各段階の availability を作成する。
同名のバランスシナリオがあるエリアでは、その availability を使って optimizer も実行する。

```bash
npm run sim:progression -- \
  --through orc_camp_1 \
  --tiers slime_cave:1 \
  --out-dir reports/progression-orc-camp
```

主な出力:

- `summary.json`: 各段階の装備数、レア数、新規レア、optimizer の最高勝率
- `summary.compact.json`: Studio や AI が読むための軽量サマリ
- `summary.report.txt`: 人間が読むためのテキストレポート
- `NN-areaId-availability.json`: その段階の入手可能装備
- `NN-areaId-strategy.json`: optimizer 結果。シナリオがあるエリアのみ

短時間確認だけしたい場合は、optimizer 設定を小さくする。

```bash
npm run sim:progression -- \
  --through goblin_village_1 \
  --tiers slime_cave:1 \
  --generations 1 \
  --population 5 \
  --iterations 1 \
  --validation-iterations 1
```

## レベルスイープ

`--level-sweep min:max:step` を指定すると、シナリオがあるエリアで複数レベルを順に評価する。
`summary.json` の `scenario.levelSweep` に、各レベルの勝率と `clearLevel80` / `clearLevel95` / `lowestWinningLevel` を出力する。

```bash
npm run sim:progression -- \
  --through orc_camp_1 \
  --tiers slime_cave:1,goblin_village_1:0 \
  --out-dir reports/progression-orc-camp-sweep \
  --level-sweep 5:18:1 \
  --generations 10 \
  --population 30 \
  --iterations 8 \
  --validation-iterations 100
```

スイープ実行時は `NN-areaId-strategy-lvN.json` がレベルごとに生成される。

`summary.json` は再現・デバッグ用に詳細を残す。
通常の確認や Studio 可視化には `summary.compact.json` または `summary.report.txt` を使う。
