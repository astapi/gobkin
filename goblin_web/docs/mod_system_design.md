# ゴブリンModシステム 技術設計書

## 概要

Path of Exileのアイテムシステムを参考に、ゴブリンにModを付与するシステムを実装する。
ゴブリンの個体値（1〜64）がPoEのItem Levelに相当し、高い個体値ほど強力なModが付与される。

**簡略化ポイント:**
- レアリティシステムは導入しない
- 全ゴブリンに **0〜4個** のModをランダム付与
- ModプールはJSONファイルで外部管理

---

## 1. 型定義

### 1.1 Mod基本型 (`src/shared/types/Mod.ts`)

```typescript
/**
 * Modの種別
 * - prefix: ステータス増加系（HP%, ATK%, DEF%, SPD%, SP%, フラット増加）
 * - suffix: 軽減・特殊効果系（被ダメージ軽減など）
 */
export type ModType = 'prefix' | 'suffix'

/**
 * Modが影響するステータス
 */
export type ModStat =
  | 'hp_percent'      // HP %増加
  | 'hp_flat'         // HP +X
  | 'atk_percent'     // ATK %増加
  | 'atk_flat'        // ATK +X
  | 'def_percent'     // DEF %増加
  | 'def_flat'        // DEF +X
  | 'spd_percent'     // SPD %増加
  | 'sp_percent'      // SP %増加
  | 'sp_flat'         // SP +X
  | 'damage_reduction'// 被ダメージ軽減

/**
 * Modテンプレート定義（JSONから読み込み）
 */
export interface ModTemplate {
  id: string                    // 例: "hp_percent_t1"
  name: string                  // 表示名: "生命力の"
  group: string                 // 排他グループ: "hp_percent"
  type: ModType                 // prefix or suffix
  stat: ModStat                 // 影響するステータス
  tier: number                  // Tier（1が最上位、6が最下位）
  valueRange: [number, number]  // [min, max] の数値範囲
  weight: number                // 抽選時の重み
  requiredIndividual: number    // 必要個体値
}

/**
 * ゴブリンに付与されたMod実体
 */
export interface ModInstance {
  templateId: string  // ModTemplateのID
  value: number       // valueRange内でロールされた実数値
}

/**
 * Mod生成設定
 */
export interface ModGenerationConfig {
  minMods: number  // 最小Mod数（デフォルト: 0）
  maxMods: number  // 最大Mod数（デフォルト: 4）
}

export const DEFAULT_MOD_CONFIG: ModGenerationConfig = {
  minMods: 0,
  maxMods: 4,
}
```

### 1.2 拡張されたGoblin型

```typescript
// Goblin.ts への追加フィールド
export type Goblin = {
  id: number
  name: string
  race: string
  level: number
  experience: number
  avatar: string
  stats: GoblinStats           // 基礎ステータス
  factors?: string[]
  individualValue?: number     // 個体値 (1〜64)

  // === 新規追加 ===
  mods?: ModInstance[]         // 付与されたMod配列（0〜4個）
}
```

---

## 2. JSONによるModプール管理

### 2.1 ファイル構成

```
goblin_web/src/shared/data/
├── modPool.json           # Modテンプレート定義（メイン）
└── modPoolLoader.ts       # JSONローダー
```

### 2.2 modPool.json の構造

```json
{
  "version": "1.0.0",
  "config": {
    "minMods": 0,
    "maxMods": 4,
    "damageReductionCap": 75
  },
  "templates": [
    {
      "id": "hp_percent_t6",
      "name": "頑丈な",
      "group": "hp_percent",
      "type": "prefix",
      "stat": "hp_percent",
      "tier": 6,
      "valueRange": [5, 8],
      "weight": 1000,
      "requiredIndividual": 1
    }
  ]
}
```

### 2.3 modPoolLoader.ts

```typescript
// src/shared/data/modPoolLoader.ts

import { ModTemplate, ModGenerationConfig, DEFAULT_MOD_CONFIG } from '../types/Mod'
import modPoolData from './modPool.json'

interface ModPoolData {
  version: string
  config: {
    minMods: number
    maxMods: number
    damageReductionCap: number
  }
  templates: ModTemplate[]
}

const data = modPoolData as ModPoolData

/**
 * 全Modテンプレートを取得
 */
export function getModTemplates(): ModTemplate[] {
  return data.templates
}

/**
 * Mod生成設定を取得
 */
export function getModConfig(): ModGenerationConfig {
  return {
    minMods: data.config?.minMods ?? DEFAULT_MOD_CONFIG.minMods,
    maxMods: data.config?.maxMods ?? DEFAULT_MOD_CONFIG.maxMods,
  }
}

/**
 * 被ダメージ軽減の上限を取得
 */
export function getDamageReductionCap(): number {
  return data.config?.damageReductionCap ?? 75
}

/**
 * IDからModTemplateを取得
 */
export function getModTemplate(id: string): ModTemplate | undefined {
  return data.templates.find(t => t.id === id)
}

/**
 * 個体値で利用可能なModTemplateリストを取得
 */
export function getAvailableModTemplates(individualValue: number): ModTemplate[] {
  return data.templates.filter(t => t.requiredIndividual <= individualValue)
}
```

---

## 3. Mod生成ロジック

### 3.1 ModGeneratorService (`src/core/services/ModGeneratorService.ts`)

```typescript
import { ModInstance } from '@/shared/types/Mod'
import {
  getModTemplates,
  getModConfig,
  getModTemplate
} from '@/shared/data/modPoolLoader'
import { SeededRandom } from './SeededRandom'

export class ModGeneratorService {
  private rng: SeededRandom

  constructor(seed: number) {
    this.rng = new SeededRandom(seed)
  }

  /**
   * ゴブリン生成時にModを付与する（0〜4個）
   */
  generateMods(individualValue: number): ModInstance[] {
    const config = getModConfig()
    const modCount = this.rng.intInRange(config.minMods, config.maxMods)

    if (modCount === 0) {
      return []
    }

    const mods: ModInstance[] = []
    const usedGroups = new Set<string>()

    for (let i = 0; i < modCount; i++) {
      const mod = this.rollSingleMod(individualValue, usedGroups)
      if (mod) {
        mods.push(mod)
        const template = getModTemplate(mod.templateId)
        if (template) {
          usedGroups.add(template.group)
        }
      }
    }

    return mods
  }

  /**
   * 単一Modの抽選
   */
  private rollSingleMod(
    individualValue: number,
    excludeGroups: Set<string>
  ): ModInstance | null {
    const allTemplates = getModTemplates()

    // 1. 個体値を満たし、グループが未使用のModのみ候補に
    const candidates = allTemplates.filter(
      t => t.requiredIndividual <= individualValue && !excludeGroups.has(t.group)
    )

    if (candidates.length === 0) return null

    // 2. Weight に基づいて抽選
    const totalWeight = candidates.reduce((sum, t) => sum + t.weight, 0)
    let roll = this.rng.float() * totalWeight

    for (const template of candidates) {
      roll -= template.weight
      if (roll <= 0) {
        // 3. 値をロール
        const value = this.rng.intInRange(
          template.valueRange[0],
          template.valueRange[1]
        )
        return { templateId: template.id, value }
      }
    }

    return null
  }
}
```

### 3.2 生成フロー

```
ゴブリン生成
     ↓
個体値（1〜64）決定
     ↓
Mod数決定（0〜4のランダム）
     ↓
各スロットでMod抽選：
  - 個体値 ≥ requiredIndividual のModのみ候補
  - weight に基づいて抽選
  - 既存グループは除外（排他チェック）
  - valueRange内で実数値をロール
     ↓
ModInstance[] 完成
```

---

## 4. ステータス計算への統合

### 4.1 ModStatCalculator (`src/core/services/ModStatCalculator.ts`)

```typescript
import { Goblin, GoblinStats } from '@/shared/types/Goblin'
import { ModInstance } from '@/shared/types/Mod'
import { getModTemplate, getDamageReductionCap } from '@/shared/data/modPoolLoader'

/**
 * Modを適用した最終ステータスを計算
 */
export class ModStatCalculator {
  /**
   * 基礎ステータス + Mod効果 = 最終ステータス
   */
  static calculate(goblin: Goblin): GoblinStats {
    const base = { ...goblin.stats }
    const mods = goblin.mods ?? []

    // 1. フラット加算を集計
    const flatBonuses = this.aggregateFlatBonuses(mods)

    // 2. %増加を集計
    const percentBonuses = this.aggregatePercentBonuses(mods)

    // 3. 計算順序: (基礎 + フラット) * (1 + %合計)
    return {
      hp:  Math.floor((base.hp + flatBonuses.hp) * (1 + percentBonuses.hp / 100)),
      atk: Math.floor((base.atk + flatBonuses.atk) * (1 + percentBonuses.atk / 100)),
      def: Math.floor((base.def + flatBonuses.def) * (1 + percentBonuses.def / 100)),
      sp:  Math.floor((base.sp + flatBonuses.sp) * (1 + percentBonuses.sp / 100)),
      spd: Math.floor((base.spd + flatBonuses.spd) * (1 + percentBonuses.spd / 100)),
    }
  }

  /**
   * 被ダメージ軽減率を取得（戦闘時に使用）
   */
  static getDamageReduction(goblin: Goblin): number {
    const mods = goblin.mods ?? []
    let total = 0

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (template?.stat === 'damage_reduction') {
        total += mod.value
      }
    }

    // 上限適用
    return Math.min(total, getDamageReductionCap())
  }

  private static aggregateFlatBonuses(mods: ModInstance[]): Record<string, number> {
    const bonuses = { hp: 0, atk: 0, def: 0, sp: 0, spd: 0 }

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (!template) continue

      switch (template.stat) {
        case 'hp_flat':  bonuses.hp += mod.value; break
        case 'atk_flat': bonuses.atk += mod.value; break
        case 'def_flat': bonuses.def += mod.value; break
        case 'sp_flat':  bonuses.sp += mod.value; break
      }
    }

    return bonuses
  }

  private static aggregatePercentBonuses(mods: ModInstance[]): Record<string, number> {
    const bonuses = { hp: 0, atk: 0, def: 0, sp: 0, spd: 0 }

    for (const mod of mods) {
      const template = getModTemplate(mod.templateId)
      if (!template) continue

      switch (template.stat) {
        case 'hp_percent':  bonuses.hp += mod.value; break
        case 'atk_percent': bonuses.atk += mod.value; break
        case 'def_percent': bonuses.def += mod.value; break
        case 'sp_percent':  bonuses.sp += mod.value; break
        case 'spd_percent': bonuses.spd += mod.value; break
      }
    }

    return bonuses
  }
}
```

### 4.2 BattleSystem への統合

```typescript
// BattleSystem.ts での変更箇所

import { ModStatCalculator } from './ModStatCalculator'

// ダメージ計算時
private calculateDamage(attacker: Goblin, defender: Goblin, skill: Skill): number {
  // Mod適用後のステータスを使用
  const attackerStats = ModStatCalculator.calculate(attacker)
  const defenderStats = ModStatCalculator.calculate(defender)

  // 被ダメージ軽減を適用
  const damageReduction = ModStatCalculator.getDamageReduction(defender)

  const base = attackerStats.atk * skill.power
  const defMitigate = 1 - defenderStats.def / (defenderStats.def + 100)
  const reductionMitigate = 1 - damageReduction / 100

  return Math.max(1, Math.floor(base * defMitigate * reductionMitigate))
}
```

### 4.3 GoblinEntity への統合

```typescript
// GoblinEntity.ts での変更

import { ModStatCalculator } from '../services/ModStatCalculator'

export class GoblinEntity {
  // ...

  /**
   * Mod適用後の実効ステータスを取得
   */
  get effectiveStats(): GoblinStats {
    return ModStatCalculator.calculate(this.goblin)
  }

  /**
   * 戦力計算（Mod適用後）
   */
  calculateCombatPower(): number {
    const stats = this.effectiveStats
    const rawPower = stats.atk * 1.5 + stats.def * 1.2 + stats.sp + stats.spd + stats.hp / 10
    return Math.round(rawPower)
  }
}
```

---

## 5. ファイル構成

```
goblin_web/src/
├── shared/
│   ├── types/
│   │   ├── Goblin.ts          # 拡張（mods追加）
│   │   └── Mod.ts             # 【新規】ModTemplate, ModInstance
│   └── data/
│       ├── modPool.json       # 【新規】Modテンプレート（JSON）
│       └── modPoolLoader.ts   # 【新規】JSONローダー
├── core/
│   ├── services/
│   │   ├── ModGeneratorService.ts   # 【新規】Mod生成ロジック
│   │   ├── ModStatCalculator.ts     # 【新規】ステータス計算
│   │   ├── GoblinBirthService.ts    # 【修正】Mod生成統合
│   │   └── BattleSystem.ts          # 【修正】Mod効果適用
│   └── domain/
│       └── GoblinEntity.ts          # 【修正】effectiveStats追加
└── presentation/
    └── components/
        └── GoblinModDisplay.tsx     # 【新規】Mod表示UI
```

---

## 6. 実装優先度

### Phase 1: 基盤実装
1. `Mod.ts` 型定義
2. `modPool.json` データ作成
3. `modPoolLoader.ts` 実装
4. `ModGeneratorService.ts` 実装
5. `ModStatCalculator.ts` 実装

### Phase 2: 既存システム統合
6. `Goblin.ts` フィールド追加
7. `GoblinBirthService.ts` 修正
8. `GoblinEntity.ts` 修正
9. `BattleSystem.ts` 修正

### Phase 3: UI実装
10. Mod表示コンポーネント
11. ゴブリン詳細画面へのMod表示統合

---

## 7. JSON編集によるバランス調整

### 調整可能な項目

| 項目 | JSONパス | 説明 |
|------|----------|------|
| Mod数範囲 | `config.minMods`, `config.maxMods` | 0〜4 → 1〜6 など |
| 被ダメ軽減上限 | `config.damageReductionCap` | 75% → 50% など |
| 各Modの出現率 | `templates[].weight` | 値を変更 |
| 効果量の範囲 | `templates[].valueRange` | [min, max] を調整 |
| 必要個体値 | `templates[].requiredIndividual` | 解禁条件の調整 |

### 新規Mod追加手順

1. `modPool.json` の `templates` 配列に新しいModを追加
2. `stat` に新しい値を使う場合は `Mod.ts` の `ModStat` 型を拡張
3. `ModStatCalculator.ts` に計算ロジックを追加

---

## 8. 将来的な拡張案

### 追加Mod案（JSONに追加可能）
```json
{
  "id": "first_position_atk",
  "name": "先陣の",
  "group": "position_bonus",
  "type": "suffix",
  "stat": "first_position_atk",
  "tier": 3,
  "valueRange": [10, 15],
  "weight": 200,
  "requiredIndividual": 30
}
```

### 条件付きMod対応（将来）
- `stat` に新しい条件付き効果を定義
- `ModStatCalculator` で戦闘状況に応じた計算を追加
