# 戦闘システム仕様書

## 概要

ゴブリンキングダムの戦闘システムは**ターン制・全自動戦闘**を採用しています。味方ゴブリンと敵ユニットが素早さ順に行動し、攻撃回数分の通常攻撃を行います。シード付き乱数（LCG）による決定論的な戦闘で、リプレイの完全再現が可能です。

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| `src/core/services/BattleSystem.ts` | 戦闘メインループ・命中判定 |
| `src/core/services/DamageCalculator.ts` | ダメージ計算 |
| `src/core/services/ModStatCalculator.ts` | 実効ステータス計算（因子・Mod・装備） |
| `src/core/services/CombatantManager.ts` | 戦闘参加者管理 |
| `src/core/services/ExpeditionEngine.ts` | 遠征エンジン（戦闘を呼び出す） |
| `src/shared/types/Battle.ts` | 戦闘関連の型定義 |
| `src/shared/types/Goblin.ts` | ゴブリンの型定義 |
| `src/shared/types/Enemy.ts` | 敵の型定義 |
| `src/core/services/__tests__/CombatStats.test.ts` | 戦闘ステータスのテスト |

---

## ターンの流れ

```
while (currentTurn < maxTurns) {
  1. ターン開始ログ記録（HP状態スナップショット）
  2. 生存ユニットを行動順値順にソート（高い順）
  3. 各ユニットが行動:
     a. 攻撃回数分ループ（attackCount回）
     b. ターゲット選択（隊列に基づく）
     c. 命中判定
     d. ダメージ計算＆適用
     e. ログ記録
  4. 勝敗判定:
     - 敵全滅 → 'win'
     - 味方全滅 → 'lose'
     - maxTurns到達 → 'retreat'
}
```

### 行動順序

全ユニット（味方+敵）は `敏捷² × スキル補正 × 乱数B(0.21〜1.0)` の降順で行動します。

---

## ステータスシステム

### ゴブリンのステータス（`GoblinStats`）

| ステータス | 説明 |
|-----------|------|
| `hp` | 最大HP |
| `atk` | 攻撃力 |
| `def` | 防御力 |
| `attackCount` | 攻撃回数。敏捷ベースで算出し、血統差分を最終補正として加算 |
| `accuracy` | 命中精度。基本能力値とLv依存式から算出 |
| `evasion` | 回避能力。基本能力値とLv依存式から算出 |

### 血統別の攻撃回数補正

| 血統 | 補正値 |
|------|------|
| ゴブリン | 0 |
| スライムゴブリン | 0 |
| ウルフゴブリン | **1** |
| オークゴブリン | 0 |
| ホブゴブリン | 0 |

### 実効ステータスの計算

`ModStatCalculator.calculate()` で基本値から実効値を算出します。

```
最終ステータス = (基本値 + 因子ボーナス + Modフラット + 装備フラット) × (1 + (Mod% + 装備%) / 100)
```

適用順序:
1. **基本ステータス**: ゴブリン生成時に決定
2. **因子ボーナス**: 継承した因子による加算
3. **Modフラット加算**: `ModInstance[]` のフラット値
4. **装備フラット加算**: `EquipmentStatBonus` のフラット値
5. **乗算処理**: `(1 + (Mod% + 装備%) / 100)`

---

## 命中判定

### 命中率公式

```
hitRate = rand × (attacker.accuracy × accMod − defender.evasion × hpMod)
hitRate = clamp(hitRate, 5, 95)

判定: rng() × 100 < hitRate → 命中
```

### 攻撃回数補正（accMod）

```typescript
function getAccuracyModifier(attackNumber: number): number {
  if (attackNumber <= 1) return 1.0
  return 0.6 * Math.pow(0.9, attackNumber - 2)
}
```

| 攻撃回目 | 補正値 |
|---------|--------|
| 1回目 | 1.0 |
| 2回目 | 0.6 |
| 3回目 | 0.54 |
| 4回目 | 0.486 |
| n回目 (n≥2) | 0.6 × 0.9^(n-2) |

### 残りHP補正（hpMod）

```
hpRatio = defender.currentHP / defender.maxHP
hpMod = 0.5 × (1 + hpRatio)
```

| HP割合 | hpMod | 効果 |
|--------|-------|------|
| 100% | 1.0 | 通常の回避率 |
| 50% | 0.75 | 回避率低下 |
| 瀕死 | ≈0.5 | 回避率半減 |

HPが低いほど回避率が下がるため、集中砲火を受けたユニットは命中されやすくなります。

### 命中率の上下限

- **最低**: 5%（どんなに回避が高くても5%は当たる）
- **最高**: 95%（どんなに命中が高くても5%は外れる）

### 計算例

ゴブリン（accuracy=150, 1回目攻撃） vs スライム（evasion=10, HP50%）:
```
accMod = 1.0
hpMod = 0.5 × (1 + 0.5) = 0.75
hitRate = 0.5 × (150 × 1.0 − 10 × 0.75) = 0.5 × 142.5 = 71.25%
```

---

## ダメージ計算

### ダメージ公式

```
ダメージ = floor(base × defMitigate × raceFactor × takenFactor × critFactor × rand)
最小値: 1
```

### 各要素の詳細

#### 基本攻撃力

```
base = attacker.atk × skill.power
```
※ 通常攻撃の `skill.power` = 1.0

#### 防御軽減率

```
defMitigate = 1 − defender.def / (defender.def + 100)
```

| 防御値 | ダメージ通過率 |
|--------|-------------|
| 0 | 100% |
| 50 | 67% |
| 100 | 50% |
| 200 | 33% |
| 300 | 25% |

#### 種族ボーナス

- **攻撃側**: スキルに定義された `raceBonus` が、対象の `raceTags` に該当する場合に適用
- **防御側**: 装備に定義された `raceTakenBonus` が、攻撃者の `raceTags` に該当する場合に適用

#### クリティカル

```
判定: rng() < critRate
critFactor = 1.5（クリティカル時）/ 1.0（通常時）
```
※ デフォルトの `critRate` = 0

#### ランダム変動

```
rand = 0.95 + rng() × 0.10  // ±5%
```

### 攻撃回数によるダメージ補正

```typescript
function getDamageModifier(attackNumber: number): number {
  if (attackNumber <= 2) return 1.0
  return Math.pow(0.9, attackNumber - 2)
}
```

| 攻撃回目 | 補正値 |
|---------|--------|
| 1回目 | 1.0 |
| 2回目 | 1.0 |
| 3回目 | 0.9 |
| 4回目 | 0.81 |
| 5回目 | 0.729 |

→ 3回目以降は指数関数的にダメージが低下します。

### 被ダメージ軽減（damage_reduction）

Modや装備から`damage_reduction`ステータスを集計し、上限付きで適用:

```
reductionFactor = 1 − damageReduction / 100
finalDamage = max(1, floor(baseDamage × dmgMod × reductionFactor))
```

---

## 隊列システム

### 敵の配置

敵は2次元配列 `Enemy[][]` で表現されます:

```
row 0: [敵A, 敵B, 敵C]  ← 最も狙われやすい
row 1: [敵D, 敵E]
row 2: [敵F]             ← 最も狙われにくい
```

### 味方の配置

味方は1列1ユニット。パーティ内の配列インデックスがそのまま列番号になります。

### ターゲット選択アルゴリズム

1. 生存ユニットを列でグループ化
2. 前列が全滅した場合、次の列を新しい列0として詰め直し
3. 列の狙われ率を重み付き抽選で決定
4. 選択された列内のユニットも同じロジックで抽選

### 列の狙われ率

```typescript
function getRowWeight(row: number, totalRows: number): number {
  if (totalRows <= 1) return 1
  const effectiveRow = Math.min(row, totalRows - 2)
  return Math.pow(0.5, effectiveRow + 1)
}
```

| 生存列数 | 列0 | 列1 | 列2 | 列3 | 列4 |
|---------|-----|-----|-----|-----|-----|
| 1 | 100% | - | - | - | - |
| 2 | 50% | 50% | - | - | - |
| 3 | 50% | 25% | 25% | - | - |
| 4 | 50% | 25% | 12.5% | 12.5% | - |
| 5 | 50% | 25% | 12.5% | 6.25% | 6.25% |

※ 最後の2列は常に同率になります。

---

## 乱数生成（シード付きRNG）

LCG（Linear Congruential Generator）を使用:

```typescript
function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return (state >>> 0) / 0x100000000
  }
}
```

- **範囲**: [0.0, 1.0)
- **用途**: 同じシードで同じ戦闘結果を再現（リプレイ機能）
- 遠征全体で1つのシードからRNGを生成し、全イベントで共有

---

## 装備システムとの連携

### 装備によるステータス効果

| 効果タイプ | 例 |
|-----------|-----|
| `atk_flat` / `atk_percent` | 攻撃力の加算・乗算 |
| `def_flat` / `def_percent` | 防御力の加算・乗算 |
| `hp_flat` / `hp_percent` | HPの加算・乗算 |
| `accuracy_flat` | 命中精度の追加 |
| `evasion_flat` | 回避の追加 |
| `attackCount_flat` | 攻撃回数の追加 |
| `damage_reduction` | 被ダメージ軽減 |

### 装備スロット数（血統別）

```
スロット数 = min(baseSlots + floor(level / slotsPerLevel), maxSlots)
```

| 血統 | 初期スロット | レベル毎 | 最大スロット |
|------|-----------|---------|-----------|
| ゴブリン | 2 | 5Lvごとに+1 | 6 |
| 魔獣 | 1 | 7Lvごとに+1 | 4 |

---

## バトル実行インターフェース

### 入力

```typescript
executeBattle(
  allies: Goblin[],         // 味方ゴブリン配列
  initialAllyHP: number[],  // 各ゴブリンの初期HP
  enemies: Enemy[][],       // 敵の2D配列 [row][slot]
  rng: () => number,        // シード付き乱数関数
  maxTurns: number = 20     // 最大ターン数
): BattleResult
```

### 出力（`BattleResult`）

```typescript
interface BattleResult {
  rounds: number                    // 戦闘ターン数
  outcome: 'win' | 'lose' | 'retreat'  // 戦闘結果
  allyHPDelta: number[]             // 各ゴブリンのHP変動
  enemyDefeated: number             // 倒した敵の数
  detailedLog: BattleLogEntry[]     // 全ターンの詳細ログ
}
```

### バトルログエントリ

```typescript
interface BattleLogEntry {
  turn: number
  actorId: string
  actorName: string
  action: string            // '通常攻撃' など
  targetId?: string
  targetName?: string
  damage?: number
  missed?: boolean          // ミス判定
  attackIndex?: number      // 複数攻撃時の回数（1-based）
  isAlly: boolean
  targetDefeated?: boolean
  actorHP?: number
  targetHP?: number
  turnState?: {             // ターン開始時のHP状態
    allies: Array<{ id, name, currentHP, maxHP }>
    enemies: Array<{ id, name, currentHP, maxHP }>
  }
}
```

---

## 遠征エンジンでの利用

`ExpeditionEngine.resolveCombat()` が戦闘を呼び出します:

1. `PartyState` から `Goblin[]` を再構築
2. `BattleSystem.executeBattle()` を実行
3. 結果の `allyHPDelta` をパーティに反映
4. HP 0 のメンバーに `isKO = true`, `isDead = true` を設定

---

## 敵配置パターンの例

各ダンジョンのJSONファイル（`src/shared/data/enemy/`）でパターンを定義:

```json
{
  "patterns": [
    {
      "id": "P001",
      "floors": [1, 2, 3],
      "enemies": [
        ["E001", "E001", "E001"]
      ]
    },
    {
      "id": "BOSS",
      "floors": [3],
      "enemies": [
        ["E003", "E003", "E003", "E003", "E003"],
        ["E004", "E004", "E004"],
        ["B001"]
      ],
      "isBoss": true
    }
  ]
}
```

ボス戦では複数列の敵配置となり、隊列システムが重要な役割を果たします。

---

## 設計上のポイント

- **全自動戦闘**: プレイヤーの操作は不要。パーティ編成と装備選択が戦略の中心
- **決定論的**: シード値で全ての乱数が決まるため、リプレイ再現が可能
- **隊列の重要性**: 前列は狙われやすいが後列を守る壁役として機能
- **複数回攻撃の減衰**: 高攻撃回数の血統（ウルフゴブリン等）は手数で勝るが、後半の攻撃は命中・ダメージ共に減衰
- **HP依存の回避**: 瀕死のユニットは回避しにくく、集中砲火が有効
