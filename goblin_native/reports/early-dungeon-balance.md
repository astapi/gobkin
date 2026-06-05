# Early Dungeon Balance Snapshot

対象: 周辺の森〜オークの野営地。
経験値は `ExpeditionEngine` 実行時の `calculateEnemyExp(level, raceTags, isBoss)` を基準に併記。

## Dungeon Summary

| Area | Lv | Floors | Enemy | Pattern | AvgPatHP | AvgPress | AvgXP | EstRandomXP | BossHP | BossXP | Diff |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| slime_cave | 1 | 2 | 2 | 2+0+1 | 6 | 3 | 3 | 9 | 20 | 29 | - |
| forest_outskirts | 2 | 6 | 6 | 18+6+1 | 76.2 | 33.9 | 24.9 | 224.5 | 236 | 54 | HPx12.7 / Pressx11.3 / XPx8.3 |

## Enemy Summary

### slime_cave / スライムの洞窟

| Enemy | Lv | HP | ATKxCount | DEF/MDEF | ACC/EVA | JSON Exp | Runtime Exp | Tags |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| S001 スライム | 1 | 4 | 2x1=2 | 1/0 | 70/9 | 1 | 2 | slime |
| B_SLIME (Boss) ボススライム | 3 | 20 | 3x1=3 | 2/1 | 100/11 | 5 | 29 | slime |

### forest_outskirts / 周辺の森

| Enemy | Lv | HP | ATKxCount | DEF/MDEF | ACC/EVA | JSON Exp | Runtime Exp | Tags |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| E001 森スライム | 2 | 7 | 3x1=3 | 1/1 | 120/8 | 2 | 4 | slime |
| E002 森ネズミ | 3 | 12 | 7x1=7 | 2/1 | 185/11 | 3 | 5 | beast |
| E003 森コウモリ | 4 | 18 | 9x1=9 | 3/4 | 220/18 | 5 | 7 | bat |
| E004 トゲリス | 5 | 26 | 13x1=13 | 6/7 | 235/13 | 7 | 9 | beast |
| E005 若ウルフ | 6 | 42 | 15x1=15 | 8/9 | 250/16 | 10 | 11 | wolf |
| B001 グレイウルフ | 8 | 100 | 18x2=36 | 10/12 | 270/16 | 25 | 14 | wolf |

## Pattern Summary

### slime_cave

| Pattern | Floors | Type | Count | Rows | HP | Press | MaxDEF | XP | Enemies |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| SP001 | 1,2 | regular | 1 | 1 | 4 | 2 | 1 | 2 | S001 |
| SP002 | 1,2 | regular | 2 | 1 | 8 | 4 | 1 | 4 | S001,S001 |
| SBOSS | 2 | boss | 1 | 1 | 20 | 3 | 2 | 29 | B_SLIME |

### forest_outskirts

| Pattern | Floors | Type | Count | Rows | HP | Press | MaxDEF | XP | Enemies |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| FO_1F_001 | 1 | regular | 1 | 1 | 7 | 3 | 1 | 4 | E001 |
| FO_1F_002 | 1 | regular | 2 | 1 | 14 | 6 | 1 | 8 | E001,E001 |
| FO_1F_003 | 1 | regular | 1 | 1 | 12 | 7 | 2 | 5 | E002 |
| FO_1F_END | 1 | floorBoss | 2 | 1 | 19 | 10 | 2 | 9 | E001,E002 |
| FO_2F_001 | 2 | regular | 2 | 1 | 24 | 14 | 2 | 10 | E002,E002 |
| FO_2F_002 | 2 | regular | 2 | 1 | 36 | 18 | 3 | 14 | E003,E003 |
| FO_2F_003 | 2 | regular | 3 | 2 | 42 | 23 | 3 | 17 | E002,E003,E002 |
| FO_2F_END | 2 | floorBoss | 4 | 2 | 60 | 32 | 3 | 24 | E003,E003,E002,E002 |
| FO_3F_001 | 3 | regular | 3 | 2 | 48 | 25 | 3 | 19 | E003,E003,E002 |
| FO_3F_002 | 3 | regular | 3 | 2 | 50 | 27 | 6 | 19 | E004,E002,E002 |
| FO_3F_003 | 3 | regular | 3 | 2 | 62 | 31 | 6 | 23 | E004,E003,E003 |
| FO_3F_END | 3 | floorBoss | 3 | 2 | 70 | 35 | 6 | 25 | E004,E004,E003 |
| FO_4F_001 | 4 | regular | 4 | 2 | 88 | 44 | 6 | 32 | E004,E004,E003,E003 |
| FO_4F_002 | 4 | regular | 3 | 2 | 78 | 33 | 8 | 25 | E005,E003,E003 |
| FO_4F_003 | 4 | regular | 4 | 2 | 92 | 42 | 8 | 30 | E005,E004,E002,E002 |
| FO_4F_END | 4 | floorBoss | 4 | 2 | 104 | 46 | 8 | 34 | E005,E004,E003,E003 |
| FO_5F_001 | 5 | regular | 3 | 2 | 110 | 43 | 8 | 31 | E005,E005,E004 |
| FO_5F_002 | 5 | regular | 4 | 2 | 112 | 50 | 8 | 36 | E005,E004,E004,E003 |
| FO_5F_003 | 5 | regular | 4 | 2 | 136 | 56 | 8 | 40 | E005,E005,E004,E004 |
| FO_5F_END | 5 | floorBoss | 5 | 2 | 154 | 65 | 8 | 47 | E005,E005,E004,E004,E003 |
| FO_6F_001 | 6 | regular | 4 | 2 | 136 | 56 | 8 | 40 | E005,E005,E004,E004 |
| FO_6F_002 | 6 | regular | 5 | 2 | 146 | 61 | 8 | 45 | E005,E005,E004,E003,E003 |
| FO_6F_003 | 6 | regular | 5 | 2 | 178 | 71 | 8 | 51 | E005,E005,E005,E004,E004 |
| FO_6F_END | 6 | floorBoss | 6 | 2 | 204 | 84 | 8 | 60 | E005,E005,E005,E004,E004,E004 |
| BOSS | 6 | boss | 5 | 3 | 236 | 92 | 10 | 54 | E005,E005,B001,E004,E004 |

## Notes

- `Pattern` の `regular+floorBoss+boss` は通常抽選パターン数 + フロアボス数 + 最終ボス数。
- `EstRandomXP` は `baseDurationSec / eventIntervalSec * battleWeight / totalWeight * AvgXP` の概算。実際の踏破ではボス戦・途中帰還・乱数で変動する。
- `Diff` は直前ダンジョン比。1.0 に近い場合、段階差が弱い。
