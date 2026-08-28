# 攻略構成探索シミュレータ

`scripts/optimize-balance-strategy.js` は、`ExpeditionEngine` を評価関数として攻略構成を探索する。
固定ロードアウトの比較に使う `sim:balance:reference` と異なり、隊列、亜種、ジョブ、装備を遺伝的アルゴリズムで変更する。

## 基本実行

```bash
npm run sim:optimize -- \
  --scenario wolf_grassland_1 \
  --level 30
```

探索中は候補ごとに少数回の遠征を実行し、上位候補のみ多試行で再検証する。

```bash
npm run sim:optimize -- \
  --scenario lizardman_swamp_1 \
  --level 52 \
  --generations 30 \
  --population 60 \
  --iterations 20 \
  --validation-iterations 500
```

## 制約

- 装備はシナリオ JSON の `equipmentFilter.maxUnlockRank` と `maxDropRank` 以下に限定する。
- レア装備は既定で除外する。含める場合は `--allow-rare` を指定する。
- `--availability <path>` を指定した場合は、`sim:availability` の `availableEquipment` だけを装備候補にする。この場合、レア装備は可用性 JSON に含まれているものだけ候補に入る。
- 亜種は既存シナリオに登場する亜種を初期候補とする。上書きする場合は `--variants slime,wolf,...` を指定する。
- ジョブは既定で `guard,warrior,thief,mage,cleric` を探索する。
- Rank 2 以降はクレリック必須で探索する。変更する場合は `--cleric required|optional|forbidden` を指定する。

## 進行状況とレアドロップを考慮する

先に入手可能装備を分析し、その JSON を optimizer に渡す。

```bash
npm run sim:availability -- \
  --all-cleared-through goblin_village_1 \
  --tiers slime_cave:1 \
  --out reports/availability-goblin-village.json

npm run sim:optimize -- \
  --scenario goblin_village_1 \
  --level 12 \
  --availability reports/availability-goblin-village.json
```

この方式では、制圧済みダンジョンと到達済み Tier からレアドロップ候補を計算する。
レアドロップを「持っている前提」にするかどうかは、この JSON を入力に含めるかで切り替える。

複数段階をまとめて見る場合は `sim:progression` を使う。

```bash
npm run sim:progression -- \
  --through orc_camp_1 \
  --tiers slime_cave:1
```

各段階の availability と、バランスシナリオがある地点の optimizer 結果を `reports/progression-<areaId>/summary.json` にまとめる。
通常確認には軽量な `summary.compact.json` と `summary.report.txt` を使う。

最低攻略レベルを見たい場合は `--level-sweep` を指定する。

```bash
npm run sim:progression -- \
  --through orc_camp_1 \
  --tiers slime_cave:1,goblin_village_1:0 \
  --level-sweep 5:18:1
```

`summary.json` の `scenario.levelSweep.clearLevel80` と `clearLevel95` で、勝率80%/95%に届く最低レベルを確認する。

## 出力

探索結果は既定で `reports/strategy-<areaId>-lv<level>.json` に保存する。
上位候補の勝率、平均戦闘ターン、装備コスト、隊列、亜種、ジョブ、装備を含む。

`reports/strategy-optimizer-knowledge.json` には直近100回分の探索結果を蓄積する。
同一ダンジョン・同一レベルを再探索すると、過去の上位候補を初期集団へ混ぜて探索を再開する。

## 短時間の動作確認

```bash
npm run sim:optimize -- \
  --scenario orc_camp_1 \
  --level 12 \
  --generations 2 \
  --population 8 \
  --iterations 1 \
  --validation-iterations 2 \
  --top 2
```
