# 戦闘ステータスリファレンス

goblin_native の戦闘システムで使用されるステータスの仕様書。

## 用語定義

| 用語 | 意味 | 例 |
|---|---|---|
| 種族 | モンスターの大分類 | 魔獣、アンデッド、人間 |
| 血統 | ゴブリンの派生 | ゴブリン、スライムゴブリン、ウルフゴブリン、オークゴブリン、ホブゴブリン |

## コアステータス

| ステータス | 型 | 説明 |
|---|---|---|
| hp | number | ヒットポイント。0になると戦闘不能 |
| atk | number | 攻撃力。ダメージ計算の基礎値 |
| def | number | 防御力。被ダメージの軽減率に使用 |
| spd | number | 速度。ターン内の行動順序を決定（高い順） |
| attackCount | number | 攻撃回数。1ターンに攻撃できる回数（血統基本値） |
| accuracy | number | 命中精度。命中率計算の攻撃側パラメータ |
| evasion | number | 回避能力。命中率計算の防御側パラメータ |

## 派生ステータス

| ステータス | 型 | 説明 |
|---|---|---|
| damageReduction | number | 被ダメージ軽減率（0〜上限値%）。Modと装備から算出 |
| row | number | 隊列の行番号（0-based）。前列ほど狙われやすい |
| rowSlot | number | 行内のスロット番号（0-based） |

## 血統別初期値

attackCount は血統ごとに固定値が設定される。

| 血統 | attackCount | accuracy | evasion |
|---|---|---|---|
| ゴブリン | 2 | 20 | 15 |
| スライムゴブリン | 2 | 20 | 15 |
| ウルフゴブリン | 3 | 20 | 15 |
| オークゴブリン | 2 | 20 | 15 |
| ホブゴブリン | 2 | 20 | 15 |

### ゴブリン生成時のランダム範囲

attackCount 以外のステータスはランダム範囲で生成される。

| ステータス | 最小値 | 最大値 |
|---|---|---|
| hp | 55 | 80 |
| atk | 10 | 16 |
| def | 8 | 14 |
| spd | 8 | 14 |
| accuracy | 15 | 25 |
| evasion | 10 | 20 |

## ステータス計算

### 最終ステータスの算出

```
最終値 = (基礎 + 因子フラット + Modフラット + 装備フラット) × (1 + (Mod% + 装備%) / 100)
```

計算はModStatCalculatorで行われ、以下の4つのソースから合算される:

1. **基礎ステータス** - レベルアップで成長する値（`goblin.stats`）
2. **因子ボーナス** - 獲得した因子（Factor）からのフラット加算
3. **Modボーナス** - Modインスタンスからのフラット加算・%増加
4. **装備ボーナス** - 装備品からのフラット加算・%増加

### Modで修正可能なステータス

| ModStat | 対象 |
|---|---|
| hp_flat / hp_percent | HP |
| atk_flat / atk_percent | 攻撃力 |
| def_flat / def_percent | 防御力 |
| spd_flat / spd_percent | 速度 |
| attackCount_flat / attackCount_percent | 攻撃回数 |
| accuracy_flat / accuracy_percent | 命中精度 |
| evasion_flat / evasion_percent | 回避能力 |
| damage_reduction | 被ダメージ軽減率 |

## ダメージ計算

### 基本式

```
damage = base × 防御軽減率 × 種族ボーナス × 被ダメ修正 × クリティカル × 乱数
```

### 各要素の詳細

| 要素 | 計算式 | デフォルト値 |
|---|---|---|
| base | `atk × skill.power` | 通常攻撃: power = 1.0 |
| 防御軽減率 | `1 - def / (def + defConstant)` | defConstant = 100 |
| 種族ボーナス | 攻撃側の装備・スキルによる種族特効 | 1.0 |
| 被ダメ修正 | 防御側の装備による種族耐性 | 1.0 |
| クリティカル | クリティカル発生時の倍率 | 1.5倍 |
| 乱数 | `min + random() × (max - min)` | 0.95〜1.05（±5%） |

### 被ダメージ軽減の適用

ダメージ計算後、さらに被ダメージ軽減率が適用される:

```
最終ダメージ = floor(計算ダメージ × (1 - damageReduction / 100))
最小ダメージ = 1
```

## 命中率計算

### 基本式

```
hitRate = accuracy × 命中補正(n) × 乱数A − evasion × HP補正 × 乱数B
→ clamp(5, 95)
```

- **命中補正(n)**: 攻撃回数による命中率低下（後述）
- **HP補正**: `0.5 × (1 + 現在HP / 最大HP)` — HPが減ると回避力が低下
- **乱数A, B**: それぞれ独立した乱数
- **下限5%、上限95%** に制限

## 攻撃回数による補正

1ターンに複数回攻撃する場合、回数が増えるほど威力と命中が低下する。

| 攻撃回数 | ダメージ補正 | 命中補正 |
|---|---|---|
| 1回目 | ×1.0 | ×1.0 |
| 2回目 | ×1.0 | ×0.6 |
| 3回目 | ×0.9 | ×0.54 |
| 4回目 | ×0.81 | ×0.486 |
| n回目 (n≥3) | ×0.9^(n-2) | ×0.6 × 0.9^(n-2) |

## 隊列システム

### 狙われ率の計算

敵は2D配列 `enemies[row][slot]` で配置され、前列ほど狙われやすい。

| 行 | 重み |
|---|---|
| 0（前列） | 1/2 |
| 1（中列） | 1/4 |
| 2（後列） | 1/8 |
| ... | 1/2^(n+1) |

※ 最後の2列は同率になる。

### ターゲット選択の流れ

1. 生存ユニットの列を前詰め
2. 列ごとの重みで抽選 → 対象の列を決定
3. 選ばれた列内でスロット順に重み付き抽選 → 対象ユニットを決定

## 戦闘フロー

1. **初期化**: Goblin/Enemy → BattleUnit に変換（Mod・装備の実効ステータスを適用）
2. **ターンループ**（最大20ターン）:
   1. 生存ユニットを spd 順にソート
   2. 各ユニットが attackCount 回攻撃:
      - 隊列を考慮してターゲット選択
      - 命中判定（accuracy vs evasion）
      - ヒット時: ダメージ計算 → 被ダメ軽減適用 → HP減少
      - ミス時: ログに missed を記録
   3. 全滅判定 → 勝敗が決まればループ終了
3. **結果生成**: 戦闘ログ、勝敗、HP変化量を返却

## 関連ファイル

| ファイル | 内容 |
|---|---|
| `src/shared/types/Goblin.ts` | GoblinStats 型定義 |
| `src/shared/types/Enemy.ts` | Enemy 型定義 |
| `src/shared/types/Battle.ts` | BattleLogEntry 型定義 |
| `src/shared/types/Mod.ts` | ModStat 型定義 |
| `src/shared/types/Equipment.ts` | EquipmentStat 型定義 |
| `src/shared/types/Factor.ts` | FactorEffect 型定義 |
| `src/core/services/BattleSystem.ts` | 戦闘ロジック本体 |
| `src/core/services/DamageCalculator.ts` | ダメージ計算 |
| `src/core/services/ModStatCalculator.ts` | 最終ステータス計算 |
| `src/core/services/CombatantManager.ts` | ユニット変換 |
| `src/shared/data/equipmentConfig.ts` | 血統別初期値 |
| `src/shared/data/factors.ts` | 因子マスターデータ |
