# ドロップシステム

## 概要

遠征中の戦闘勝利時に装備アイテムや因子を獲得できるシステム。
ドロップは3種類に分類される:

1. **装備ドロップ（宝箱）**: ダンジョンレベル準拠の装備プールから抽選
2. **敵個別ドロップ**: 敵ごとに設定された固有装備ドロップ（現在未使用）
3. **因子ドロップ**: ボス撃破時に因子を獲得

すべてのドロップはシード値ベースの決定論的乱数で処理されるため、同じシードなら同じ結果が再現される。

## 装備ドロップ（宝箱）

### 発生条件

戦闘（通常戦闘・ボス戦）に**勝利**した直後に判定される。

```
1. rng() < DROP_CHANCE（25%）で確率判定
   └─ 失敗 → ドロップなし
2. areaLevel に対応する装備プールを取得
3. 同一遠征で既にドロップした装備を除外
4. 残りの候補から均等抽選
5. 称号を抽選して装備名に付与
```

### ドロップ確率

全エリア共通で **25%**（`DROP_CHANCE = 0.25`）。`ExpeditionEngine.ts` に定数として定義。
エリアの `areaLevel` はドロップする装備プールの選択に使用される。

### 装備プール選択

`getEquipmentByDungeonLevel(dungeonLevel)` でダンジョンレベルに対応する装備を取得:

```
対象 = dropLevelMin ≤ dungeonLevel ≤ dropLevelMax のテンプレート
```

### 装備テンプレート一覧

#### 武器（剣系）

| 名前 | dropLevelMin | dropLevelMax | ATK | DEF |
|------|-------------|-------------|-----|-----|
| ひのきの棒 | 1 | 2 | 2 | 0 |
| こんぼう | 4 | 10 | 5 | 1 |
| 銅の剣 | 8 | 15 | 8 | 2 |
| ブロードソード | 8 | 15 | 12 | 3 |
| ロングソード | 12 | 25 | 16 | 4 |
| ミスリルソード | 20 | 40 | 24 | 6 |
| ロイヤルソード | 35 | 60 | 32 | 8 |
| カイザーソード | 50 | 80 | 48 | 10 |
| エンシェントソード | 70 | 105 | 64 | 12 |
| ドラゴンソード | 95 | 135 | 96 | 24 |
| アダマントソード | 120 | 150 | 128 | 36 |

#### 武器（弓系）

| 名前 | dropLevelMin | dropLevelMax | ATK |
|------|-------------|-------------|-----|
| スリングショット | 1 | 2 | 3 |
| ショートボウ | 4 | 10 | 6 |
| ロングボウ | 12 | 25 | 20 |
| ミスリルボウ | 20 | 40 | 30 |
| ロイヤルボウ | 35 | 60 | 45 |
| カイザーボウ | 50 | 80 | 60 |
| エンシェントボウ | 70 | 105 | 90 |
| ドラゴンボウ | 95 | 135 | 120 |
| アダマントボウ | 120 | 150 | 160 |

※ `areaLevel` が `dungeonLevel` として使用されるため、現状はレベル1〜8の範囲。装備テンプレートの `dropLevelMin` が9以上のものは将来のコンテンツ拡張用。

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

## 敵個別ドロップ

### 仕組み

敵データの `equipmentDrops` フィールドで個別設定:

```typescript
interface EquipmentDropConfig {
  templateId: string   // EquipmentTemplate.id
  probability: number  // 0.0〜1.0
}
```

装備ドロップ（宝箱）とは**独立に**判定される。同じ重複制限（`droppedTemplateIds`）が適用される。

### 現在の使用状況

**実装済みだが、敵データでは未使用**。テストコードでのみ利用されている。
将来的なレアドロップ実装用のインフラとして存在。

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
| `src/core/services/ExpeditionEngine.ts` | rollTreasureDrops()、ドロップ判定の呼び出し元 |
| `src/core/services/EquipmentTitleService.ts` | 称号抽選ロジック（rollTitle） |
| `src/core/services/FactorService.ts` | 因子ドロップ判定（rollFactorDrops） |
| `src/core/usecases/CompleteExpeditionUseCase.ts` | ドロップの永続化処理 |
| `src/shared/data/equipmentPool.json` | 装備テンプレート一覧 |
| `src/shared/data/equipmentPoolLoader.ts` | ダンジョンレベル別プール取得 |
| `src/shared/data/equipmentTitleConfig.ts` | 称号定義（重み・補正値） |
| `src/shared/types/Equipment.ts` | EquipmentTemplate, EquipmentDropConfig 型 |
| `src/shared/types/EquipmentTitle.ts` | EquipmentTitleId, EquipmentTitleDef 型 |
| `src/shared/types/Expedition.ts` | TreasureDrop, RewardSummary 型 |
| `src/shared/data/enemy/*.json` | 敵データ（factorDrops 定義） |
| `src/shared/data/expeditionArea/*.json` | エリア定義（dropChance 定義） |
| `src/core/services/__tests__/TreasureDrop.test.ts` | ドロップシステムのテスト |

## 関連ドキュメント

- [遠征システム](expedition_system.md) — 遠征の全体フロー、報酬分配
- [戦闘システム](battle_system.md) — 戦闘勝利条件（ドロップのトリガー）
- [因子システム](factor_system.md) — 因子の効果と継承
- [MODシステム](mod_system.md) — 装備のMod効果
- [拠点ランクシステム](base_rank_system.md) — 装備ショップ解放条件
