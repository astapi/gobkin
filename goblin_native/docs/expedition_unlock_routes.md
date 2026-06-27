# 遠征エリア解放ルート

## 概要

この図は `src/shared/data/expeditionArea/allArea.json` の `unlockNext` / `unlockNexts` に基づく遠征エリアの解放ルートです。

- 実線: メインの `unlockNext`
- 点線: 寄り道・高難度などの追加解放 `unlockNexts`
- `辺境の村` クリア後は、まず `ウルフ草原` から `リザードマンの沼砦` へ進み、機動力と湿地戦術を獲得します。
- `オークの野営地・本陣` からは `オークの砦` にも分岐し、ここを制圧すると `vs討伐隊防衛戦` が解放されます。
- `vs討伐隊防衛戦・決戦` の後は、`蜘蛛影の森 -> 死霊の墓原 -> 風切りの断崖` を経て、ようやく `辺境の城` 攻略へ進みます。

## 解放ルート

```mermaid
flowchart TD
  slime_cave["スライムの洞窟"]
  forest_outskirts["周辺の森"]
  goblin_village_1["ゴブリン集落・外縁"]
  undead_ruins_1["忘れられた廃墟・入口"]
  undead_ruins_1["忘れられた廃墟・深部"]
  undead_ruins_1["忘れられた廃墟・最奥"]
  road_1["街道"]
  orc_camp_1["オークの野営地・前哨"]
  orc_camp_1["オークの野営地・陣営"]
  orc_camp_1["オークの野営地・本陣"]
  orc_fortress_1["オークの砦<br/>寄り道高難度"]
  wolf_grassland_1["ウルフ草原"]
  subjugation_force_1["vs討伐隊防衛戦・前哨戦"]
  spider_forest_1["蜘蛛影の森"]
  dead_grave_1["死霊の墓原・外縁"]
  dead_grave_1["死霊の墓原・墓群"]
  dead_grave_1["死霊の墓原・霊廟"]
  human_village["辺境の村"]
  hobbit_hills_1["ホビットの丘陵村"]
  dwarf_mine_1["ドワーフ坑道・入口"]
  dwarf_mine_1["ドワーフ坑道・深層"]
  dwarf_mine_1["ドワーフ坑道・最深部"]
  elf_forest_1["エルフの隠れ里・外縁"]
  elf_forest_1["エルフの隠れ里・内部"]
  elf_forest_1["エルフの隠れ里・中枢"]
  lizardman_swamp_1["リザードマンの沼砦・浅瀬"]
  lizardman_swamp_1["リザードマンの沼砦・深沼"]
  lizardman_swamp_1["リザードマンの沼砦・本拠"]
  harpy_cliff_1["風切りの断崖"]
  troll_canyon_1["トロルの峡谷・入口"]
  troll_canyon_1["トロルの峡谷・深部"]
  troll_canyon_1["トロルの峡谷・暴君の間"]
  minotaur_labyrinth_1["ミノタウロス迷宮"]
  human_fortress_1["辺境の城・外郭"]
  human_fortress_1["辺境の城・城内"]
  human_fortress_1["辺境の城・本丸"]
  vampire_castle_1["ヴァンパイアの古城"]
  royal_capital_1["王都決戦・城門"]
  royal_capital_2["王都決戦・王城内部"]
  dragon_volcano_1["ドラゴンの火山巣"]
  royal_capital_3["王都決戦・玉座の間"]

  slime_cave --> forest_outskirts
  forest_outskirts --> goblin_village_1
  goblin_village_1 --> forest_edge_village
  forest_edge_village --> old_well_waterway
  old_well_waterway --> undead_ruins_1
  undead_ruins_1 --> undead_ruins_1
  undead_ruins_1 --> undead_ruins_1
  undead_ruins_1 --> road_1
  road_1 --> orc_camp_1
  orc_camp_1 --> orc_camp_1
  orc_camp_1 --> orc_camp_1
  orc_camp_1 --> human_village
  human_village --> wolf_grassland_1
  wolf_grassland_1 --> lizardman_swamp_1
  orc_camp_1 -.-> orc_fortress_1
  hobbit_hills_1
  dwarf_mine_1 --> dwarf_mine_1
  dwarf_mine_1 --> dwarf_mine_1
  elf_forest_1 --> elf_forest_1
  elf_forest_1 --> elf_forest_1
  orc_fortress_1 --> subjugation_force_1
  subjugation_force_1 --> spider_forest_1
  spider_forest_1 --> dead_grave_1
  dead_grave_1 --> dead_grave_1
  dead_grave_1 --> dead_grave_1
  dead_grave_1 --> harpy_cliff_1
  harpy_cliff_1 --> human_fortress_1
  lizardman_swamp_1 --> lizardman_swamp_1
  lizardman_swamp_1 --> lizardman_swamp_1
  harpy_cliff_1 -.-> troll_canyon_1
  troll_canyon_1 --> troll_canyon_1
  troll_canyon_1 --> troll_canyon_1
  troll_canyon_1 --> minotaur_labyrinth_1
  human_fortress_1 --> human_fortress_1
  human_fortress_1 --> human_fortress_1
  human_fortress_1 --> vampire_castle_1
  vampire_castle_1 --> royal_capital_1
  royal_capital_1 --> royal_capital_2
  royal_capital_2 --> dragon_volcano_1
  dragon_volcano_1 --> royal_capital_3

  classDef sideQuest fill:#fff7d6,stroke:#b8860b,stroke-width:2px,color:#222;
  classDef finalArea fill:#ffe4e4,stroke:#b22222,stroke-width:2px,color:#222;
  class orc_fortress_1,hobbit_hills_1,dwarf_mine_1,elf_forest_1 sideQuest;
  class royal_capital_3 finalArea;
```

## 現在の寄り道エリア

| 解放元 | 寄り道エリア | 位置づけ |
| --- | --- | --- |
| 解放元なし | ホビットの丘陵村 | いったん宙に置かれた独立寄り道エリア。 |
| 解放元なし | ドワーフ坑道・入口 | いったん宙に置かれた装備強化ルート。 |
| 解放元なし | エルフの隠れ里・外縁 | いったん宙に置かれた独立支線。 |
| オークの野営地・本陣 | オークの砦 | 討伐隊派遣の直接要因となる分岐ルート。 |
| vs討伐隊防衛戦・決戦 | 蜘蛛影の森 | アラクネの協力を得るための次章メインルート。 |
| 死霊の墓原・霊廟 | 風切りの断崖 | 辺境の城攻略前に空の戦力を得る中継ルート。 |
