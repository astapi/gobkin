# キャラクタースキル仕様

## 概要

本プロジェクトでは、ゴブリン個体が持つ常時効果を `CharacterSkill` として管理する。

この仕組みは以下の2系統を統一的に扱うためのもの:

- 種族固有スキル
- 装備によって付与されるスキル

現在は、種族ごとの固有能力に加えて、防具が付与する「物理ダメージ軽減(%)」も `CharacterSkill` として処理している。
スキル本体の一次定義は `src/shared/data/skillCatalog.ts` に集約し、種族・職業・装備はスキル ID を参照する。

## データ構造

`CharacterSkill` は以下のような可変構造を持つ。

```ts
interface CharacterSkill {
  id: string
  name: string
  statBonuses?: Partial<Record<keyof GoblinStats, number>>
  equipmentCategoryMultiplier?: Partial<Record<EquipmentCategory, number>>
  equipmentStatMultipliers?: Partial<Record<EquipmentStat, number>>
  physicalDamageReductionPercent?: number
  additionalDamage?: number
  protectRearAllyNormalAttackMultiplier?: number
}
```

### 各フィールドの意味

- `id`
  - スキルの内部ID
- `name`
  - 表示名
- `statBonuses`
  - ゴブリン本体の能力値へ直接加算する
- `equipmentCategoryMultiplier`
  - 指定カテゴリの装備補正値を倍率強化する
- `equipmentStatMultipliers`
  - 指定ステータスの装備補正値を倍率強化する
- `physicalDamageReductionPercent`
  - 通常攻撃に対する被ダメージ軽減率
- `additionalDamage`
  - 通常攻撃1ヒットごとに固定加算する追加ダメージ
- `protectRearAllyNormalAttackMultiplier`
  - 自分より後列の味方が受ける通常攻撃ダメージを軽減する係数

## スキルの発生源

### 1. 種族固有スキル

種族ごとの初期スキル ID は `src/shared/data/goblinVariants.ts` の `defaultSkillIds` で定義する。
スキル本体は `src/shared/data/skillCatalog.ts` から解決し、ゴブリン生成時に `getDefaultSkillsForRace()` を通して個体へ付与される。

現在実装されている代表例:

- スライムゴブリン
  - `[1.3倍]鎧装備`
  - `後列防護`
- ウルフゴブリン
  - `[+2]攻撃回数アップ`
  - `[2.0倍]命中精度`
  - `[+13]追加ダメージ`

### 2. 装備付与スキル

装備テンプレートは `grantedSkillIds` を持てる。
この配列に設定したスキル ID が `skillCatalog.ts` から解決され、装備中のゴブリンへ付与される。

例:

```ts
{
  id: 'armor_armor',
  name: 'アーマー',
  category: 'armor',
  statBonuses: [
    { stat: 'critical_rate_percent', value: -3 },
    { stat: 'def_flat', value: 10 },
    { stat: 'hp_flat', value: 15 },
  ],
  grantedSkillIds: [
    'physical_reduction_6',
  ],
}
```

## 防具スキル仕様

現在、防具は `damage_reduction` のような装備ステータスではなく、`grantedSkillIds` によるスキル付与として物理軽減を表現している。

表記ルールは以下で統一:

```text
[-x%] 物理ダメージ軽減(%)
```

### 現在の防具と付与スキル

| 防具名 | 付与スキル |
|------|------|
| ボロぬの | `[-1%] 物理ダメージ軽減(%)` |
| かわのベスト | `[-2%] 物理ダメージ軽減(%)` |
| 毛皮のベスト | `[-3%] 物理ダメージ軽減(%)` |
| アーマー | `[-6%] 物理ダメージ軽減(%)` |
| ミスリルアーマー | `[-7%] 物理ダメージ軽減(%)` |
| ロイヤルアーマー | `[-8%] 物理ダメージ軽減(%)` |
| カイザーアーマー | `[-9%] 物理ダメージ軽減(%)` |
| エンシェントアーマー | `[-10%] 物理ダメージ軽減(%)` |
| ドラゴンアーマー | `[-11%] 物理ダメージ軽減(%)` |
| アダマントアーマー | `[-12%] 物理ダメージ軽減(%)` |

## 適用タイミング

### 装備時

装備時は `EquipmentService.equip()` が呼ばれ、対象装備の `grantedSkillIds` から解決されたスキルがゴブリンの `skills` に追加される。

### 解除時

装備解除時は `EquipmentService.unequip()` が呼ばれ、対象装備の `grantedSkillIds` から解決されたスキルがゴブリンの `skills` から除去される。

### 永続化

装備着脱後のゴブリンは `saveGoblin()` により保存されるため、装備由来スキルも `skills_json` に反映される。

## 戦闘での扱い

### 通常攻撃

`BattleSystem` では、対象キャラクターの `skills` から `physicalDamageReductionPercent` を集計し、通常攻撃ダメージへ適用する。

概念的には以下:

```ts
finalDamage =
  baseDamage
  * 汎用被ダメ軽減
  * 物理ダメージ軽減
  * 後列防護
```

### 呪文

`physicalDamageReductionPercent` は呪文ダメージには適用しない。
そのため「物理ダメージ軽減」という名称どおり、対象は通常攻撃のみである。

## スキル表示

スキルの表示文は `describeCharacterSkill()` で生成する。

現在の優先表示ルール:

- 物理ダメージ軽減
- 追加ダメージ
- 後列防護
- 鎧カテゴリ倍率
- 命中精度倍率
- 攻撃回数加算
- 上記に該当しない場合は `skill.name`

装備画面では `statBonuses` に加えて、解決後の `grantedSkills` も表示する。

## 実装上の注意

### 1. 物理軽減は防具スキルであり、装備ステータスではない

今後、防具に軽減効果を追加する場合は `statBonuses` に `damage_reduction` を入れず、`skillCatalog.ts` にスキルを追加したうえで `grantedSkillIds` にその ID を定義すること。

### 2. 物理軽減は加算合計

複数スキルがある場合、`physicalDamageReductionPercent` は単純加算で合計する。

例:

- `[-3%]`
- `[-6%]`

上記2つを同時に持つ場合、合計 `9%` 軽減として扱う。

### 3. 通常攻撃限定

名称が似ていても、Mod 系の被ダメ軽減とは意味が異なる。

- Mod の `damage_reduction`
  - 汎用の被ダメ軽減
- `physicalDamageReductionPercent`
  - 通常攻撃専用の軽減

## 関連ファイル

- `src/shared/types/CharacterSkill.ts`
- `src/shared/data/characterSkills.ts`
- `src/shared/data/skillCatalog.ts`
- `src/shared/data/raceSkills.ts`
- `src/shared/data/equipmentPool.json`
- `src/core/services/EquipmentService.ts`
- `src/core/services/BattleSystem.ts`
- `app/goblin/equipment.tsx`
