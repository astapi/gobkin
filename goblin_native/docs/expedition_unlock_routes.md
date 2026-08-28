# 遠征エリア解放ルート

## 概要

この図は `src/shared/data/expeditionArea/allArea.json` の `unlockNext` / `unlockNexts` に基づく遠征エリアの解放ルートです。

- 実線: メインの `unlockNext`
- 点線: 寄り道・高難度・イベントなどの追加解放 `unlockNexts`
- `辺境の村` クリア後は、メインの `ウルフ草原` に加えて `ホビットの丘陵村` から始まる寄り道チェーン（丘陵村 → ドワーフ坑道 → エルフの隠れ里）が開きます。
- `オークの野営地・本陣` からは `オークの砦` にも分岐し、ここを制圧すると `vs討伐隊防衛戦` が解放されます。
- `vs討伐隊防衛戦・決戦` の後は、`蜘蛛影の森 -> 死霊の墓原 -> 風切りの断崖` を経て、平原会戦イベント（`vs辺境伯軍・平原会戦`）を制してから `辺境の城` 攻略へ進みます。
- `辺境の城` 制圧後は、奪還防衛戦イベントを挟んで `ヴァンパイアの古城` へ。同時に「約束の履行」サイドイベント（沼砦防衛戦・断崖の鷹匠戦）が開きます。
- `ヴァンパイアの古城` の後は `王都平原会戦` イベントを制してから王都決戦（城門 → 王城内部 → ドラゴン火山巣 → 玉座の間）へ進みます。

## 解放ルート

```mermaid
flowchart TD
  slime_cave["スライムの洞窟"]
  forest_outskirts["周辺の森"]
  goblin_village_1["ゴブリン集落"]
  forest_edge_village["森外れの廃村"]
  old_well_waterway["古井戸の地下水路"]
  undead_ruins_1["忘れられた廃墟"]
  bandit_hideout["盗賊のアジト"]
  road_1["街道"]
  orc_camp_1["オークの野営地"]
  human_village["辺境の村"]
  wolf_grassland_1["ウルフ草原"]
  lizardman_swamp_1["リザードマンの沼砦"]
  orc_fortress_1["オークの砦<br/>寄り道高難度"]
  subjugation_force_1["vs討伐隊防衛戦<br/>イベント"]
  spider_forest_1["蜘蛛影の森"]
  dead_grave_1["死霊の墓原"]
  harpy_cliff_1["風切りの断崖"]
  margrave_sortie_1["vs辺境伯軍・平原会戦<br/>イベント"]
  human_fortress_1["辺境の城"]
  fortress_defense_1["辺境の城・奪還防衛戦<br/>イベント"]
  swamp_defense_1["沼砦防衛戦<br/>約束の履行"]
  harpy_defense_1["断崖の鷹匠戦<br/>約束の履行"]
  troll_canyon_1["トロルの峡谷"]
  minotaur_labyrinth_1["ミノタウロス迷宮"]
  vampire_castle_1["ヴァンパイアの古城"]
  royal_field_battle_1["王都平原会戦<br/>イベント"]
  royal_capital_1["王都決戦・城門"]
  royal_capital_2["王都決戦・王城内部"]
  dragon_volcano_1["ドラゴンの火山巣"]
  royal_capital_3["王都決戦・玉座の間"]
  hobbit_hills_1["ホビットの丘陵村"]
  hobbit_hills_defense_1["丘陵村の徴税人<br/>約束の履行"]
  dwarf_mine_1["ドワーフ坑道"]
  dwarf_mine_purge_1["坑道の魔物払い<br/>約束の履行"]
  elf_forest_1["エルフの隠れ里"]
  cat_fortress_1["猫獣人の影遺跡<br/>課金解放"]
  necromancer_crypt_1["死霊術師の地下霊廟<br/>課金解放"]

  slime_cave --> forest_outskirts
  forest_outskirts --> goblin_village_1
  goblin_village_1 --> forest_edge_village
  forest_edge_village --> old_well_waterway
  old_well_waterway --> undead_ruins_1
  undead_ruins_1 --> bandit_hideout
  bandit_hideout --> road_1
  road_1 --> orc_camp_1
  orc_camp_1 --> human_village
  orc_camp_1 -.-> orc_fortress_1
  human_village --> wolf_grassland_1
  human_village -.-> hobbit_hills_1
  wolf_grassland_1 --> lizardman_swamp_1
  hobbit_hills_1 --> dwarf_mine_1
  hobbit_hills_1 -.-> hobbit_hills_defense_1
  dwarf_mine_1 --> elf_forest_1
  dwarf_mine_1 -.-> dwarf_mine_purge_1
  orc_fortress_1 --> subjugation_force_1
  subjugation_force_1 --> spider_forest_1
  spider_forest_1 --> dead_grave_1
  dead_grave_1 --> harpy_cliff_1
  harpy_cliff_1 --> margrave_sortie_1
  harpy_cliff_1 -.-> troll_canyon_1
  troll_canyon_1 --> minotaur_labyrinth_1
  margrave_sortie_1 --> human_fortress_1
  human_fortress_1 --> fortress_defense_1
  human_fortress_1 -.-> swamp_defense_1
  human_fortress_1 -.-> harpy_defense_1
  fortress_defense_1 --> vampire_castle_1
  vampire_castle_1 --> royal_field_battle_1
  royal_field_battle_1 --> royal_capital_1
  royal_capital_1 --> royal_capital_2
  royal_capital_2 --> dragon_volcano_1
  dragon_volcano_1 --> royal_capital_3

  classDef sideQuest fill:#fff7d6,stroke:#b8860b,stroke-width:2px,color:#222;
  classDef eventArea fill:#e4f0ff,stroke:#1e5aa8,stroke-width:2px,color:#222;
  classDef finalArea fill:#ffe4e4,stroke:#b22222,stroke-width:2px,color:#222;
  classDef purchaseArea fill:#efe4ff,stroke:#6a35a8,stroke-width:2px,color:#222;
  class orc_fortress_1,hobbit_hills_1,dwarf_mine_1,elf_forest_1,troll_canyon_1,minotaur_labyrinth_1 sideQuest;
  class subjugation_force_1,margrave_sortie_1,fortress_defense_1,royal_field_battle_1,swamp_defense_1,harpy_defense_1,hobbit_hills_defense_1,dwarf_mine_purge_1 eventArea;
  class royal_capital_3 finalArea;
  class cat_fortress_1,necromancer_crypt_1 purchaseArea;
```

## イベント型ダンジョン

「場所を攻略する」通常ダンジョンと違い、ストーリー上の会戦・防衛戦をそのまま遊ぶエリア。

| エリア | 種別 | 位置づけ |
| --- | --- | --- |
| vs討伐隊防衛戦 | 本筋イベント | 最初の対人間会戦。ギド戦死の山場 |
| vs辺境伯軍・平原会戦 | 本筋イベント | グレアムの出撃野戦。辺境の城攻略の前哨戦 |
| 辺境の城・奪還防衛戦 | 本筋イベント | 初めて「守る側」に回る防衛戦。騎士ロランが先鋒 |
| 王都平原会戦 | 本筋イベント | 王国全軍との最大会戦。元帥ガリウスが指揮 |
| 沼砦防衛戦 | 約束の履行（サイド） | 「沼を涸らさない」の履行。辺境の城クリアで解放 |
| 断崖の鷹匠戦 | 約束の履行（サイド） | 「空を分け合う」の履行。辺境の城クリアで解放 |
| 丘陵村の徴税人 | 約束の履行（サイド） | 「丘を守る」の履行。丘陵村クリアで解放 |
| 坑道の魔物払い | 約束の履行（サイド） | 「火を絶やさない」の履行。ドワーフ坑道クリアで解放 |

## 現在の寄り道エリア

| 解放元 | 寄り道エリア | 位置づけ |
| --- | --- | --- |
| 辺境の村 | ホビットの丘陵村 → ドワーフ坑道 → エルフの隠れ里 | 種族との約束を積む寄り道チェーン |
| オークの野営地・本陣 | オークの砦 | 討伐隊派遣の直接要因となる分岐ルート |
| 風切りの断崖 | トロルの峡谷 → ミノタウロス迷宮 | 高難度の分岐ルート |
| （課金） | 猫獣人の影遺跡 / 死霊術師の地下霊廟 | サイドストーリー購入で解放 |
