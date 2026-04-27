# ドロップシステム

## 概要

遠征中の戦闘勝利時に装備アイテムや因子を獲得できるシステム。
ドロップは3種類に分類される:

1. **ノーマルドロップ（宝箱）**: 敵レベル→アイテムランク抽選でランク別プールから抽選
2. **レアドロップ（敵固有）**: 敵ごとに設定された `rareEquipmentDrops` から抽選
3. **因子ドロップ**: ボス撃破時に因子を獲得

ノーマル / レアドロップはいずれも **PTの平均運値（luck）から算出した運乱数** をベースに判定される。固定確率ではなく、運値が高いほど閾値を超えやすくなる仕組み。

すべてのドロップはシード値ベースの決定論的乱数で処理されるため、同じシードなら同じ結果が再現される。

## ノーマルドロップ（宝箱）

### 発生条件

戦闘（通常戦闘・ボス戦）に**勝利**した直後に判定される。

```
敵1体ごとに:
1. PT平均運値から運乱数 luckRoll を抽選（rollLuckValue）
2. 100 - rare * 10 < luckRoll なら当選（rare はPT倍率の rare 値）
   └─ 失敗 → この敵からはドロップなし
3. 敵レベルからアイテムランクを抽選（DropRankRoller）
4. 該当ランクの装備プールから、同一遠征で既にドロップ済みの装備を除外
5. 残りの候補から均等抽選
6. 称号を抽選して装備名に付与
```

### ドロップ判定式

固定 15% から **運乱数ベース** に変更された。

```
normalThreshold = 100 - rare * 10
当選条件: normalThreshold < luckRoll
```

- `rare` は `PartyRewardMultipliers.rare`（PTの「レア倍率」、デフォルト 1.0）。
- `luckRoll` は PT平均運値から `LuckRoller.rollLuckValue()` で抽選した値（敵ごとに振り直し）。
- 例: `rare = 1.0` のとき閾値は 90 → 運乱数が 90 を超えれば当選。
- 例: `rare = 5.0` のとき閾値は 50 → 運乱数の上限 99.99 に対し当選確率が大きく上がる。

### 運乱数（LuckRoller）

PTメンバーの基本運値 `luck` の平均（小数切り捨て）を `LUCK_ROLL_TABLE` で参照し、`[min, max)` の連続値を抽選する。`max` は全ステップ共通で 99.99 固定。

| minLuck | min | max |
|--------:|----:|----:|
| 35 | 37.00 | 99.99 |
| 30 | 30.00 | 99.99 |
| 25 | 22.00 | 99.99 |
| 20 | 15.00 | 99.99 |
| 15 |  7.00 | 99.99 |
|  0 |  0.00 | 99.99 |

`luck >= minLuck` を満たす最上段のステップを採用する切り捨て方式。例:

- 運値 27 → 25枠（min 22.00）
- 運値 9  → 最下段（min 0.00）
- 運値 50 → 35枠固定（上限超過は最上段に留まる）

運値が高いほど `min` が押し上げられるため、`100 - rare * 10` の閾値を超えやすくなる。逆に運値が低いと `[0, 99.99)` の広い範囲を引き、低い数値が出るとそもそも閾値に届かない。

### アイテムランク

装備テンプレートは `rank` フィールドを持つ。`0` が最弱ランクで、最大は **8**。カテゴリごとに下位から昇順でランクが割り当てられる。剣/爪/鎧/小手はアイテム数が rank 数より多いため、下位を `rank 0` に寄せる（rank 0 が複数個あるのは許容）。

| カテゴリ | アイテム数 | 最弱装備（rank） | 最上位装備（rank） |
|---------|-----------|------------------|--------------------|
| 剣 (sword) | 11 | ひのきの棒 (0)〜銅の剣 (0)（3個） | アダマントソード (8) |
| 爪 (claw) | 11 | トゲ (0)〜どうのツメ (0)（3個） | アダマントクロー (8) |
| 弓 (bow) | 9 | スリングショット (0) | アダマントボウ (8) |
| 鎧 (armor) | 10 | ボロぬの (0)・かわのベスト (0)（2個） | アダマントアーマー (8) |
| 盾 (shield) | 9 | なべのフタ (0) | アダマントシールド (8) |
| 小手 (gauntlet) | 10 | ぬのの手袋 (0)・かわの小手 (0)（2個） | アダマントガントレット (8) |
| ワンド (wand) | 9 | 枝の杖 (0) | アダマントワンド (8) |
| ロッド (rod) | 9 | 見習いのロッド (0) | アダマントロッド (8) |

`getEquipmentByRank(rank)` で指定ランクのテンプレート一覧（全カテゴリ横断）を取得する。

### 敵レベル→ランク抽選テーブル

`DropRankRoller.DROP_RANK_TABLE` に定義。下から順にステップ（minLevel 昇順）が並ぶ。敵レベル `L` に対し `minLevel ≤ L` を満たす最上段のステップから抽選を開始し、確率に外れたら1段下のステップへ落ちる。最下段は rank 0 / 100% で必ず確定する。

| minLevel | rank | 確率 |
|---------:|:----:|-----:|
| 1 | 0 | 100% |
| 4 | 1 | 70% |
| 12 | 1 | 70% |
| 20 | 2 | 70% |
| 30 | 2 | 70% |
| 30 | 3 | 70% |
| 40 | 3 | 70% |
| 58 | 4 | 70% |
| 70 | 4 | 70% |
| 99 | 5 | 70% |
| 120 | 5 | 70% |
| 150 | 6 | 70% |
| 200 | 6 | 70% |
| 300 | 7 | 70% |
| 500 | 7 | 70% |

同一ランクが2段並んでいるのは、そのランクの出現帯を広げる（フォールバック時も再抽選できる）ため。

#### 例: 敵レベル 58

1. 58~ rank 4（70%）で当たれば rank 4 確定
2. 外れたら 40~ rank 3（70%）→ 外れたら 30~ rank 3（70%）
3. さらに外れたら 30~ rank 2 → 20~ rank 2 → 12~ rank 1 → 4~ rank 1 → 1~ rank 0（100%、必ず確定）

### 装備テンプレート一覧（rank）

#### 武器（剣系）

| 名前 | rank | ATK | DEF |
|------|:----:|-----|-----|
| ひのきの棒 | 0 | 2 | 0 |
| こんぼう | 0 | 5 | 1 |
| 銅の剣 | 0 | 8 | 2 |
| ブロードソード | 1 | 12 | 3 |
| ロングソード | 2 | 16 | 4 |
| ミスリルソード | 3 | 24 | 6 |
| ロイヤルソード | 4 | 32 | 8 |
| カイザーソード | 5 | 48 | 10 |
| エンシェントソード | 6 | 64 | 12 |
| ドラゴンソード | 7 | 96 | 24 |
| アダマントソード | 8 | 128 | 36 |

#### 武器（弓系）

| 名前 | rank | ATK |
|------|:----:|-----|
| スリングショット | 0 | 3 |
| ショートボウ | 1 | 6 |
| ロングボウ | 2 | 20 |
| ミスリルボウ | 3 | 30 |
| ロイヤルボウ | 4 | 45 |
| カイザーボウ | 5 | 60 |
| エンシェントボウ | 6 | 90 |
| ドラゴンボウ | 7 | 120 |
| アダマントボウ | 8 | 160 |

※ ランク抽選テーブルは現状 rank 7 が上限。rank 8 の装備（各カテゴリのアダマント等）は敵ドロップでは入手できず、店売りや敵個別ドロップで入手する想定。

### 重複制限

同一遠征中に同じ `templateId` の装備は**最大1個**までしかドロップしない。

```
droppedTemplateIds: Set<string> で遠征全体を通じて追跡
→ 既にドロップ済みの templateId は候補から除外
```

## 装備称号システム

### 概要

装備ドロップ時に自動的に称号が付与される。称号によって装備のステータス補正が変化する。

### 称号一覧

| ID | 称号名 | baseWeight | power | プラス倍率 | マイナス倍率 | 価格倍率 |
|----|--------|-----------|-------|----------|-----------|---------|
| worst | 最低な | 200 | 0.3 | ×0.50 | ×2.00 | ×0.50 |
| stinky | 臭い | 300 | 0.3 | ×0.80 | ×1.25 | ×0.80 |
| none | （なし） | 8800 | 0 | ×1.00 | ×1.00 | ×1.00 |
| masterwork | 名工の | 400 | 1.0 | ×1.33 | ×0.75 | ×2.00 |
| magical | 魔性の | 200 | 1.1 | ×1.58 | ×0.63 | ×3.00 |
| imbued | 宿った | 80 | 1.25 | ×2.10 | ×0.48 | ×9.00 |
| legendary | 伝説の | 15 | 1.55 | ×2.75 | ×0.36 | ×20.00 |
| terrifying | 恐ろしい | 4 | 1.80 | ×3.50 | ×0.29 | ×42.00 |
| broken | 壊れた | 1 | 1.67 | ×5.00 | ×0.20 | ×125.00 |

**補正の意味:**
- **プラス倍率**: プラス効果（ATK, DEF等の上昇値）に対する倍率
- **マイナス倍率**: マイナス効果（ペナルティ値）に対する倍率
- **価格倍率**: 売却価格に対する倍率

### 称号の抽選ロジック

```
1. titleMultiplier を 1〜99 の範囲に制限（M）
2. 各称号の重みを計算:
   - power = 0 の称号（なし）: weight = baseWeight（固定）
   - power > 0 の称号: weight = baseWeight × M^power
3. 全重みの合計で正規化して加重抽選
```

### titleMultiplier による確率変化

| 称号 | M=1 | M=10 | M=50 | M=99 |
|------|-----|------|------|------|
| 最低な | 2.0% | 2.0% | 1.3% | 0.9% |
| 臭い | 3.0% | 3.0% | 2.0% | 1.4% |
| （なし） | **88.0%** | 65.2% | 20.1% | **6.3%** |
| 名工の | 4.0% | 4.0% | 9.1% | 8.2% |
| 魔性の | 2.0% | 2.5% | 7.2% | 7.6% |
| 宿った | 0.8% | 1.4% | 6.5% | 8.9% |
| 伝説の | 0.15% | 0.5% | 5.7% | 13.4% |
| 恐ろしい | 0.04% | 0.3% | 4.7% | 17.2% |
| 壊れた | 0.01% | 0.05% | 2.1% | **8.3%** |

※ 現在の実装では `titleMultiplier` は常に**デフォルト値1**で使用されている。

### 称号の表示

```
称号なし: "ひのきの棒"
称号あり: "伝説のひのきの棒"
```

`EquipmentTitleService.formatTitledName(titleName, baseName)` で生成。

## レアドロップ（敵固有）

### 仕組み

敵データの `rareEquipmentDrops` フィールドで個別設定（旧 `equipmentDrops` からリネーム）:

```typescript
interface EquipmentDropConfig {
  templateId: string   // EquipmentTemplate.id
  probability: number  // 0.0〜1.0（候補内の重み付けに利用）
}
```

ノーマルドロップ（宝箱）とは**独立に**判定され、同じ重複制限（`droppedTemplateIds`）が適用される。

### 判定式

```
effectiveRare    = rare * rareDropMultiplierBoost   // boost 未指定時は 1
rareThreshold    = 100 - effectiveRare * 0.1
当選条件: rareThreshold < luckRoll
```

- 敵1体ごとに `luckRoll` を振り直す（ノーマルドロップとは別の抽選）。
- `rare` はPT倍率の `rare`、`rareDropMultiplierBoost` は `ExpeditionBoost.rareDropMultiplier`。
- ノーマルドロップが `rare * 10` であるのに対し、レアドロップは `rare * 0.1` と影響が桁違いに小さい。レアの上振れには PT倍率の積み上げと boost 倍率の併用が必要。
- 当選時は敵の `rareEquipmentDrops` から `probability` を重みとした加重抽選で 1 点選出する。

### ExpeditionBoost.rareDropMultiplier

出撃時に消費する課金/補助アイテムを想定したブースト枠。レアドロップ判定の `effectiveRare` にのみ乗算される（**ノーマルドロップには波及しない**）。

```typescript
interface ExpeditionBoost {
  rareDropMultiplier?: number  // 1 を基準に乗算。未指定または 0 以下は 1 として扱う
}
```

将来的に「探索時間1/2」「称号付与倍率2倍」など他のブースト項目も追加予定。

### 現在の使用状況

| エリア | 敵ID | 名前 | レアドロップ | 確率重み |
|-------|------|------|------------|---------:|
| スライムの洞窟 | S001 | スライム | `accessory_split_core`（分裂核 / `[10]回復能力` 付与） | 1 |

※ 分裂核は `equipmentPool.json` のアクセサリ枠（rank 未設定 / 価格 0 / 称号は通常通り抽選）に追加されている。

## 因子ドロップ

### 発生条件

**ボス戦に勝利**した場合のみ判定される。通常戦闘では因子は獲得できない。

```
1. ボス戦の outcome が 'win' であること
2. ボス敵の factorDrops が定義されていること
3. 生存メンバー（casualties に含まれない）のみが対象
4. 各メンバーごとに個別に確率判定
```

### 因子ドロップの処理

```
各生存ゴブリンについて:
  RNG = createSeededRandom(seed + goblinId)  ← ゴブリンごとに異なる乱数列
  各 factorDrop について:
    既に同じ因子を持っている → スキップ
    rng() < probability → 因子獲得
```

**重要**: `seed + goblinId` でゴブリンごとに異なる乱数列を使用するため、同じボスに対して各ゴブリンの獲得結果は独立。

### ボス別因子ドロップ一覧

| エリア | ボス名 | 敵ID | 獲得因子 | 確率 |
|-------|--------|------|---------|------|
| スライムの洞窟 | ボススライム | B_SLIME | slime | 100% |
| 周辺の森 | グレイウルフ | B001 | wolf | 100% |
| ゴブリンの村3 | ホブゴブリン | B_HOB | hobgoblin | 100% |
| オーク野営地3 | オークウォーロード | B_ORC | orc | 100% |
| アンデッド遺跡3 | 死霊術師の残骸 | B_LICH | undead | 100% |
| 討伐隊3 | 討伐隊長 | B_CAPTAIN | （なし） | - |
| ドワーフ鉱山3 | 鍛冶王 | B_FORGEKING | dwarf | 100% |
| エルフの森3 | 森の番人 | B_FORESTGUARD | elf | 100% |
| トカゲ人沼地3 | 沼王 | B_SWAMPKING | lizardman | 100% |
| トロル峡谷3 | 峡谷の暴君 | B_TYRANT | troll | 100% |

※ 全ボスの因子ドロップ確率は**100%**。ただし既に同じ因子を所持しているゴブリンはスキップされる。
※ サブステージ `_3` のボスのみが因子ドロップを持つ（`_1`, `_2` のボスは持たない）。

### 因子の永続化

`CompleteExpeditionUseCase` が獲得した因子をゴブリンに保存:

```
ゴブリンの factors 配列に追加 → リポジトリで永続化
```

## 装備ドロップの永続化

### 保存処理

`CompleteExpeditionUseCase` が装備をDBに保存:

```
各 TreasureDrop について:
  equipmentId = "eq_{timestamp}_{random9chars}"
  slotIndex = -1        ← インベントリ（未装備）
  goblinId = null       ← 誰にも装着されていない
  titleId, titleName    ← 称号情報
```

### TreasureDrop 型

```typescript
interface TreasureDrop {
  templateId: string          // EquipmentTemplate.id
  name: string                // 称号付き装備名（例: "伝説のひのきの棒"）
  titleId?: EquipmentTitleId  // 称号ID（undefinedなら称号なし）
  titleName?: string          // 称号の表示名
}
```

## 報酬サマリー

### RewardSummary

遠征完了時に全ドロップを集計:

```typescript
interface RewardSummary {
  success: boolean              // 遠征成功フラグ
  maxFloorReached: number       // 到達最大フロア
  xpGained: number              // 合計経験値
  goldGained: number            // 合計ゴールド
  casualties: string[]          // 戦死者のゴブリンID
  treasureDrops?: TreasureDrop[]    // 獲得装備一覧
  memberLevelUps?: MemberLevelUp[]  // レベルアップ情報
}
```

### TimelineEvent での記録

装備ドロップは `treasure` タイプのイベントとしてタイムラインに記録:

```typescript
{ type: "treasure"; at: number; floor: number; items: TreasureDrop[] }
```

遠征ログ再生画面でいつ・どの階層で宝箱を獲得したかを確認できる。

## 関連ソースコード

| ファイル | 内容 |
|---------|------|
| `src/core/services/ExpeditionEngine.ts` | rollTreasureDrops()、ノーマル/レア両方のドロップ判定 |
| `src/core/services/LuckRoller.ts` | PT平均運値→運乱数 (rollLuckValue) の抽選テーブル |
| `src/core/services/EquipmentTitleService.ts` | 称号抽選ロジック（rollTitle） |
| `src/core/services/FactorService.ts` | 因子ドロップ判定（rollFactorDrops） |
| `src/core/usecases/CompleteExpeditionUseCase.ts` | ドロップの永続化処理 |
| `src/shared/data/equipmentPool.json` | 装備テンプレート一覧（rank定義、accessory_split_core 等） |
| `src/shared/data/equipmentPoolLoader.ts` | ランク別プール取得（getEquipmentByRank） |
| `src/core/services/DropRankRoller.ts` | 敵レベル→アイテムランク抽選テーブル・ロジック |
| `src/shared/data/equipmentTitleConfig.ts` | 称号定義（重み・補正値） |
| `src/shared/types/Equipment.ts` | EquipmentTemplate 型 |
| `src/shared/types/Enemy.ts` | EquipmentDropConfig, Enemy.rareEquipmentDrops 型 |
| `src/shared/types/EquipmentTitle.ts` | EquipmentTitleId, EquipmentTitleDef 型 |
| `src/shared/types/Expedition.ts` | TreasureDrop, RewardSummary, ExpeditionBoost 型 |
| `src/shared/types/Party.ts` | PartyState.luck, PartyRewardMultipliers 型 |
| `src/shared/data/enemy/*.json` | 敵データ（factorDrops / rareEquipmentDrops 定義） |
| `src/shared/data/expeditionArea/*.json` | エリア定義 |
| `src/core/services/__tests__/TreasureDrop.test.ts` | ドロップシステムのテスト |
| `src/core/services/__tests__/LuckRoller.test.ts` | 運乱数抽選のテスト |

## 関連ドキュメント

- [遠征システム](expedition_system.md) — 遠征の全体フロー、報酬分配
- [戦闘システム](battle_system.md) — 戦闘勝利条件（ドロップのトリガー）
- [因子システム](factor_system.md) — 因子の効果と継承
- [MODシステム](mod_system.md) — 装備のMod効果
- [拠点ランクシステム](base_rank_system.md) — 装備ショップ解放条件
