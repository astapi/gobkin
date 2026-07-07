# 因子システム

## 概要

因子（Factor）は、ダンジョンのボスを倒すことで味方ゴブリンが獲得できる特殊な能力要素。
獲得した因子はステータスボーナスとして常時適用され、さらに次世代のゴブリンに引き継がれる可能性がある。
引き継ぎ時に亜種化判定に成功すると、亜種ゴブリンが誕生する。

## 因子一覧

因子マスターデータは `src/shared/data/goblinVariants.ts`（亜種化を伴う因子。`factors.ts` が `factorDatabase` に変換）と、亜種化を伴わない単独因子（`src/shared/data/factors.ts` の `standaloneFactorDatabase`）から構成される。現行データは全16種。

| 因子ID | 名称 | 説明 | ドロップダンジョン |
|--------|------|------|------------------|
| slime | スライム因子 | 耐久性が増す | スライムの洞窟 (slime_cave) |
| wolf | ウルフ因子 | 敏捷性が増す | 周辺の森 (forest_outskirts) / ウルフ草原 (wolf_grassland_1) |
| orc | オーク因子 | 攻撃力と防御力が増す | オークの野営地 (orc_camp_1) |
| undead | アンデッド因子 | 生命力と耐性が増す | 忘れられた廃墟 (undead_ruins_1) / 森外れの廃村 (forest_edge_village) / 古井戸の地下水路 (old_well_waterway) |
| hobgoblin | ホブゴブリン因子 | 全能力が底上げされる | ゴブリン集落 (goblin_village_1) |
| dwarf | ドワーフ因子 | 防御力と耐久性が大幅に増す | ドワーフ坑道 (dwarf_mine_1) |
| elf | エルフ因子 | 防御力が増す | エルフの隠れ里 (elf_forest_1) |
| lizardman | リザードマン因子 | HP・攻撃力・防御力が増す | リザードマンの沼砦 (lizardman_swamp_1) |
| troll | トロル因子 | HPが大幅に増し、防御力も上がる | トロルの峡谷 (troll_canyon_1) |
| shadow | ワーキャット因子 | 素早さ・連撃性能・回避が増す | 猫獣人の影遺跡 (cat_fortress_1) |
| harpy | ハーピィ因子 | 回避力と魔法防御が増す | 風切りの断崖 (harpy_cliff_1) のボスに紐付く種族だが、**現状ボスの `factorDrops` は未設定でドロップ元なし** |
| hobbit | ホビット因子 | 命中力と回避が増す | ホビットの丘陵村 (hobbit_hills_1) のボスに紐付く種族だが、**現状ボスの `factorDrops` は未設定でドロップ元なし** |
| minotaur | ミノタウロス因子 | 攻撃力とHPが大きく増す | ミノタウロス迷宮 (minotaur_labyrinth_1) のボスに紐付く種族だが、**現状ボスの `factorDrops` は未設定でドロップ元なし** |
| vampire | ヴァンパイア因子 | 魔力と生命力が増す | ヴァンパイアの古城 (vampire_castle_1) のボスに紐付く種族だが、**現状ボスの `factorDrops` は未設定でドロップ元なし** |
| dragon | ドラゴン因子 | 攻防と生命力が大幅に増す | ドラゴンの火山巣 (dragon_volcano_1) のボスに紐付く種族だが、**現状ボスの `factorDrops` は未設定でドロップ元なし** |
| ratatoskr | ラタトスク因子 | 命中精度と回避能力が増す | 通常ボスドロップではなく、金のどんぐりチケット使用時の特殊エンカウント（`GOLDEN_ACORN_CLEAR_FACTOR_DROPS`、`minDungeonTier: 3`）でのみ入手可能。亜種化なし（`variantConfig` を持たない単独因子） |

※ 討伐隊 (subjugation_force_1) のボスは因子をドロップしない。
※ `human` 因子は未使用のため廃止済み（データ上に存在しない）。
※ harpy / hobbit / minotaur / vampire / dragon はゴブリン亜種・因子定義自体は存在するが、対応ダンジョンのボス JSON に `factorDrops` が設定されておらず、通常プレイでは入手経路がない（実装途中の可能性がある）。

## 因子の獲得

### 獲得条件

- ダンジョンの**ボス戦に勝利**すること
- 獲得判定の対象は**生存しているパーティメンバーのみ**（戦闘不能者はスキップ）
- 既に同じ因子を持っている場合はスキップ（重複獲得なし）

### 獲得確率

各ボスの `factorDrops` には基準確率（Tier 0 相当）が設定されている。ほとんどのボスは **`probability: 0.015`（1.5%）** だが、一部は個別に低く設定されている（例: `forest_edge_village` の undead は `0.006`、`old_well_waterway` の undead は `0.008`）。

この基準確率に、遠征したダンジョンの **Tier（難易度）に応じた倍率**がかかる（`getDungeonTierFactorDropMultiplier`、`src/shared/types/DungeonTier.ts`）。倍率は「Tierごとの実効ドロップ率 ÷ 基準ドロップ率(1.5%)」として計算される。

| Tier | 実効ドロップ率（基準0.015の場合） | 倍率 |
|------|-------------------------------|------|
| 0（通常） | 1.5% | ×1.0 |
| 1（魔性） | 2.5% | ×1.67 |
| 2（宿った） | 3.5% | ×2.33 |
| 3（伝説） | 4.5% | ×3.0 |
| 4（恐ろしい） | 5.5% | ×3.67 |
| 5（壊れた） | 6.5% | ×4.33 |

さらに以下の要素で最終確率が補正される（`CompleteExpeditionUseCase`）:
- ゴブリンが持つスキルによる因子ドロップ率ボーナス（%加算）・因子ドロップ倍率スキル
- 遠征ブースト（`expeditionBoost.factorDropMultiplier`、消費アイテム等による一時倍率）
- `factorDrops` に `minDungeonTier` が設定されている場合、そのTier未満では確率0（例: `ratatoskr` は `minDungeonTier: 3`）
- 例外: チュートリアルとして、スライムの洞窟 (`slime_cave`) の**初回クリア**時はスライム因子のドロップ確率が `1`（100%）に固定される

いずれの場合も上限は100%にクランプされる。

### 獲得の仕組み

1. 遠征完了時に `CompleteExpeditionUseCase` がボス戦イベントを検出
2. ボス戦勝利の場合、ボスの `factorDrops` 設定を取得
3. 各生存ゴブリンに対して `FactorService.rollFactorDrops()` で確率判定
4. 判定にはシード値（`seed + goblinId`）を使用し、決定論的に結果が決まる
5. 獲得した因子は `FactorService.addFactors()` で既存因子に追加（重複排除）
6. 実効ステータスが `GoblinStatCalculator` で再計算される
7. SQLiteに因子配列と実効ステータスを保存

## 因子のステータス効果

### 効果の種類

`FactorEffect` の `type` フィールドで効果種別を定義:

| type | 説明 | 現在の実装状況 |
|------|------|--------------|
| `stat_bonus` | ステータスにフラット値を加算 | 実装済み・全因子で使用 |
| `resistance` | 耐性付与 | 型定義のみ・未使用 |
| `skill_unlock` | スキル解放 | 型定義のみ・未使用 |

### 各因子のステータス効果

`src/shared/data/goblinVariants.ts`（`factorEffects`）および `src/shared/data/factors.ts`（`standaloneFactorDatabase`）が実データ。

| 因子 | HP | ATK | DEF | 魔攻 | 魔防 | 命中 | 回避 | 攻撃回数 |
|------|-----|------|------|------|------|------|------|----------|
| スライム | +20 | - | - | - | - | - | - | - |
| ウルフ | - | +10 | - | - | - | - | - | - |
| オーク | - | +20 | +20 | - | - | - | - | - |
| アンデッド | - | - | +15 | - | - | - | - | - |
| ホブゴブリン | - | +5 | +5 | - | - | - | - | - |
| ドワーフ | +60 | - | +30 | - | - | - | - | - |
| エルフ | - | - | +15 | - | - | - | - | - |
| リザードマン | +70 | +20 | +20 | - | - | - | - | - |
| トロル | +150 | - | +25 | - | - | - | - | - |
| シャドウ（ワーキャット） | - | +18 | - | - | - | - | +20 | +1 |
| ハーピィ | - | - | - | - | +15 | - | +15 | - |
| ホビット | - | - | - | - | - | +20 | +10 | - |
| ミノタウロス | +80 | +35 | - | - | - | - | - | - |
| ヴァンパイア | +60 | - | - | +30 | - | - | - | - |
| ドラゴン | +120 | +30 | +30 | - | - | - | - | - |
| ラタトスク | - | - | - | - | - | +10 | +10 | - |

※ 旧版に記載されていた HP/ATK/DEF 数値は現行データと乖離していたため、上記は実データ（`goblinVariants.ts` / `factors.ts`）に合わせて全面的に修正。

### ステータス計算式

`GoblinStatCalculator.calculate()` での計算順序:

```
実効値 = floor( (基礎ステ + 因子ボーナス + 装備フラット + スキルフラット) × (1 + 装備% / 100) )
```

因子ボーナスの計算 (`FactorInheritanceService.calculateFactorBonuses()`):
1. ゴブリンが持つ全因子の `effects` を合算

## 因子の引き継ぎ

新しいゴブリンが誕生する際、拠点ゴブリンから因子が引き継がれる可能性がある。

### 引き継ぎフロー

```
1. 親選出
   拠点ゴブリンからランダムに最大2体を選出（Fisher-Yatesシャッフル）
   ↓
2. 因子収集
   選出された親が持つ因子IDを収集（重複排除）
   ↓
3. 引き継ぎ判定
   各因子について inheritProbability の確率で個別判定
   ↓
4. 亜種化判定（引き継いだ因子がある場合のみ）
   引き継いだ因子を順番にチェックし、variantConfig.probability で判定
   最初に成功した1種のみ適用
```

### 引き継ぎ確率

| 因子 | 引き継ぎ確率 | 亜種化確率 | 複合確率（概算） |
|------|------------|----------|---------------|
| スライム | 30% | 20% | 6.0% |
| ウルフ | 25% | 15% | 3.75% |
| オーク | 20% | 10% | 2.0% |
| アンデッド | 20% | 15% | 3.0% |
| ホブゴブリン | 25% | 20% | 5.0% |
| ドワーフ | 20% | 10% | 2.0% |
| エルフ | 20% | 10% | 2.0% |
| リザードマン | 15% | 10% | 1.5% |
| トロル | 15% | 8% | 1.2% |
| シャドウ（ワーキャット） | 18% | 12% | 2.16% |
| ハーピィ | 15% | 8% | 1.2% |
| ホビット | 15% | 8% | 1.2% |
| ミノタウロス | 12% | 6% | 0.72% |
| ヴァンパイア | 10% | 5% | 0.5% |
| ドラゴン | 8% | 4% | 0.32% |
| ラタトスク | 18% | - (亜種化なし) | - |

※ 複合確率 = 引き継ぎ確率 × 亜種化確率。実際には親が該当因子を持っている必要がある。
※ ラタトスク因子は `variantConfig` を持たない単独因子（`standaloneFactorDatabase`）のため、亜種化判定の対象にならない。

### 引き継ぎの注意点

- 引き継がれるのは**因子のみ**（亜種かどうかは新たに判定される）
- 親が亜種でなくても、因子さえ持っていれば子が亜種になる可能性がある
- 複数の因子を引き継いだ場合、亜種化は最初に判定成功した1種のみ
- 因子を引き継いでも亜種化しない場合、通常のゴブリンとして因子付きで誕生する

## データ永続化

### SQLiteスキーマ

`goblins` テーブルの因子関連カラム:

| カラム | 型 | 説明 |
|--------|-----|------|
| `factors_json` | TEXT | 因子IDの配列をJSON文字列で保存（例: `["slime","orc"]`） |
| `variant_factor_id` | TEXT | 亜種の元となった因子ID（亜種でない場合はNULL） |
| `effective_stats_json` | TEXT | 因子ボーナス適用後の実効ステータスJSON |

### 更新タイミング

- **因子獲得時**: `updateGoblinFactors()` で `factors_json` と `effective_stats_json` を更新
- **ゴブリン誕生時**: `saveGoblin()` で全フィールドを保存

## UI表示

### ゴブリン一覧（GoblinCard）

- 因子アイコンを**最大2個**まで表示
- SVGアイコンを `getFactorImage()` で取得

### ゴブリン詳細画面

- 全因子を一覧表示
- 各因子について: アイコン、名称、説明文、ステータス効果（`STAT +XX` バッジ）

### 因子アイコンの対応状況

`src/shared/utils/factorImages.ts` のマッピング（現在SVG画像が用意されている因子）:

| 因子 | アイコン |
|------|---------|
| slime | `factor_slime.svg` |
| wolf | `factor_wolf.svg` |
| orc | `factor_orc.svg` |
| hobgoblin | `factor_hobgoblin.svg` |
| undead | `factor_undead.svg` |
| dwarf | `factor_dwarf.svg` |
| elf | `factor_elf.svg` |
| lizardman | `factor_lizardman.svg` |
| troll | `factor_troll.svg` |
| harpy | `factor_harpy.svg` |
| hobbit | `factor_hobbit.svg` |
| minotaur | `factor_minotaur.svg` |
| vampire | `factor_vampire.svg` |
| dragon | `factor_dragon.svg` |
| shadow | 専用アイコン未作成（`factor_wolf.svg` で代替） |
| ratatoskr | 専用アイコン未作成（`factor_wolf.svg` で代替） |
| その他（未定義の因子ID） | デフォルト（スライムアイコンで代替） |

## 全体フロー図

```
【遠征】ボス戦勝利
  │
  ├─ 生存ゴブリンごとに因子ドロップ判定
  │   └─ FactorService.rollFactorDrops(seed + goblinId)
  │       ├─ 既に所持 → スキップ
  │       └─ 確率判定成功 → 因子獲得
  │           ├─ factors配列に追加
  │           ├─ 実効ステータス再計算
  │           └─ SQLite保存
  │
  ▼
【ゴブリン誕生】遠征成功時
  │
  ├─ 親選出（拠点から最大2体）
  ├─ 親の因子を収集
  ├─ 各因子の引き継ぎ判定
  │   └─ inheritProbability で個別判定
  ├─ 引き継いだ因子で亜種化判定
  │   └─ variantConfig.probability で判定（最初の成功のみ）
  │
  ├─ 亜種化成功 → 亜種ゴブリン誕生
  │   ├─ 種族名・アバター変更
  │   ├─ 因子効果 + 追加効果
  │   └─ variantFactorId を記録
  │
  └─ 亜種化失敗 → 通常ゴブリン（因子付き）
      └─ 因子効果のみ適用
```

## 関連ソースコード

| ファイル | 内容 |
|---------|------|
| `src/shared/types/Factor.ts` | Factor, FactorEffect, FactorVariantConfig, FactorDropConfig 型定義 |
| `src/shared/data/factors.ts` | 因子マスターデータの集約（`goblinVariantDefinitions` + 単独因子。全16種） |
| `src/shared/data/goblinVariants.ts` | 亜種化を伴う因子・種族の定義（`GoblinVariantDefinition`） |
| `src/shared/types/DungeonTier.ts` | Tier別の因子ドロップ倍率（`getDungeonTierFactorDropMultiplier`） |
| `src/core/services/FactorService.ts` | 因子獲得判定（rollFactorDrops）、因子追加（addFactors） |
| `src/core/services/FactorInheritanceService.ts` | 引き継ぎ判定、亜種化判定、因子ボーナス計算 |
| `src/core/services/GoblinBirthService.ts` | ゴブリン誕生時の因子引き継ぎ統合 |
| `src/core/services/GoblinStatCalculator.ts` | 因子ボーナスを含む実効ステータス計算 |
| `src/core/usecases/CompleteExpeditionUseCase.ts` | 遠征完了時の因子獲得処理 |
| `src/infrastructure/repositories/SQLiteGoblinRepository.ts` | 因子のDB永続化 |
| `src/shared/utils/factorImages.ts` | 因子アイコン画像マッピング |
| `src/shared/data/enemy/*.json` | 各ダンジョンボスの因子ドロップ設定 |
