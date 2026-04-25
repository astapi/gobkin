# ゴブリン亜種追加ガイド

## 概要

ゴブリン亜種の追加作業を、できるだけ「定義追加だけ」で済ませるために、
亜種ごとの設定を [goblinVariants.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/goblinVariants.ts) に集約した。

現在は以下の方針になっている。

- 亜種の仕様は `src/shared/data/goblinVariants.ts` にまとめる
- 因子マスタは `goblinVariants.ts` から組み立てる
- 基礎能力値、HP係数、攻撃回数補正、初期スキルは `goblinVariants.ts` を参照する
- 画像だけは React Native の `require()` 制約があるため、`src/shared/utils/goblinImages.ts` に静的登録が必要

つまり、今後の追加作業は原則として次の2か所になる。

1. `src/shared/data/goblinVariants.ts` に亜種定義を1件追加
2. `src/shared/utils/goblinImages.ts` に画像 require を1件追加

---

## 1. 今の構成

### 1.1 定義の中心

亜種の中心定義は以下。

- [goblinVariants.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/goblinVariants.ts)

ここで管理しているもの:

- 因子ID
- 因子名
- 因子説明
- 因子継承確率
- 因子効果
- 亜種化確率
- 種族名
- avatar パス
- 画像キー
- 亜種追加効果
- 基礎能力値
- HP係数
- 戦闘ステータス基準値
- 初期スキル

### 1.2 この定義を参照する箇所

- 因子マスタ
  - [factors.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/factors.ts)
- 基礎能力値とHP係数
  - [goblinHp.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/utils/goblinHp.ts)
- 攻撃回数補正と血統戦闘値
  - [equipmentConfig.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/equipmentConfig.ts)
- 初期スキル
  - [raceSkills.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/raceSkills.ts)
- 画像表示
  - [goblinImages.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/utils/goblinImages.ts)

---

## 2. 定義しなくてはいけないもの

新しい亜種を追加するときは、まず `goblinVariants.ts` に入れる内容を決める。

### 2.1 必須項目

| 項目 | 内容 | 例 |
|------|------|----|
| `factorId` | 元になる因子ID | `orc` |
| `factorName` | 因子表示名 | `オーク因子` |
| `factorDescription` | 因子説明文 | `オークの特性を宿した因子。攻撃力と防御力が増す。` |
| `inheritProbability` | 因子継承確率 | `0.2` |
| `factorEffects` | 因子効果 | `ATK +25`, `DEF +20` |
| `variantProbability` | 亜種化確率 | `0.1` |
| `raceName` | 種族名 | `オークゴブリン` |
| `avatar` | 保存用画像パス | `/src/assets/goblin/orc_goblin.png` |
| `imageKey` | 画像マップ参照キー | `orc_goblin` |

### 2.2 性能項目

できるだけ定義しておくべき項目。

| 項目 | 内容 |
|------|------|
| `baseAttributes.power` | 力 |
| `baseAttributes.wisdom` | 知恵 |
| `baseAttributes.spirit` | 精神 |
| `baseAttributes.vitality` | 体力 |
| `baseAttributes.agility` | 敏捷 |
| `baseAttributes.luck` | 運 |
| `hpCoefficient` | HP成長係数 |
| `combatStats.attackCount` | 攻撃回数基準値 |
| `combatStats.accuracy` | 命中基準値 |
| `combatStats.evasion` | 回避基準値 |
| `defaultSkillIds` | 初期スキル ID 一覧 |

補足:
- `baseAttributes` と `hpCoefficient` を定義しない場合、種族性能はデフォルト寄りになる
- `combatStats.attackCount` を定義しない場合、攻撃回数差を持たせにくい
- `defaultSkillIds` を空配列にすれば、固有スキルなしの亜種として扱える

### 2.3 命名上の注意

- `raceName` は UI、テスト、ドキュメントでそのまま使われる
- `avatar` は `getGoblinImage()` のパス解決に使われる
- `imageKey` は `goblinImages.ts` のキーと一致させる必要がある
- ファイル名は React Native 側の `require()` と一致させる必要がある

今回の `skelton_goblin.png` については次の扱いを採用済み。

- 画像ファイル名は `skelton_goblin.png` のまま使用
- 既存の `undead` 因子の亜種 `アンデッドゴブリン` の avatar として接続
- 新種 `スケルトンゴブリン` は追加していない

---

## 3. 実装が必要な箇所

リファクタリング後、通常の亜種追加で触る場所はかなり減っている。

### 3.1 通常は必要な実装

#### 1. 亜種定義を追加する

対象:
- [goblinVariants.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/goblinVariants.ts)

内容:
- 新しい `GoblinVariantDefinition` を1件追加する

これで以下に自動反映される。

- 因子マスタ
- 亜種化時の種族名
- avatar
- 因子効果
- 亜種追加効果
- 基礎能力値
- HP係数
- 攻撃回数補正
- 初期スキル

#### 2. 画像 require を追加する

対象:
- [goblinImages.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/utils/goblinImages.ts)

内容:
- `goblinImages` に `imageKey: require(...)` を1行追加する

これは React Native の静的 `require()` 制約のため残っている。

### 3.2 通常は不要になった実装

以下は、今回のリファクタリング後は通常の亜種追加では直接編集しない想定。

- [factors.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/factors.ts)
- [goblinHp.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/utils/goblinHp.ts)
- [equipmentConfig.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/equipmentConfig.ts)
- [raceSkills.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/raceSkills.ts)
- [FactorInheritanceService.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/core/services/FactorInheritanceService.ts)
- [GoblinBirthService.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/core/services/GoblinBirthService.ts)

これらは共通定義を読む側に変更済み。

### 3.3 例外的に追加実装が必要なケース

以下の場合は、定義追加だけでは完結しない。

#### 新しいスキル効果そのものを作る場合

対象候補:
- [characterSkills.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/characterSkills.ts)
- 戦闘処理や装備処理の関連サービス

例:
- 新しい状態異常耐性
- 特殊な行動順補正
- 戦闘中イベントを起こすスキル

#### 新しい因子アイコンを追加する場合

対象:
- [factorImages.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/utils/factorImages.ts)

#### 新しい因子システム仕様を追加する場合

対象候補:
- [Factor.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/types/Factor.ts)
- [FactorInheritanceService.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/core/services/FactorInheritanceService.ts)

---

## 4. 今回の3画像の整理

## 4.1 orc_goblin.png

対応状況:

- `goblinVariants.ts` に定義済み
- `goblinImages.ts` に画像登録済み

扱い:

- `orc` 因子の亜種 `オークゴブリン` として利用

## 4.2 skelton_goblin.png

対応状況:

- `goblinVariants.ts` の `undead` 定義に接続済み
- `goblinImages.ts` に画像登録済み

扱い:

- `アンデッドゴブリン` 用画像として利用
- 新種 `スケルトンゴブリン` は未追加

## 4.3 troll_goblin.png

対応状況:

- `goblinVariants.ts` に定義済み
- `goblinImages.ts` に画像登録済み
- 基礎能力値、HP係数、攻撃回数基準値も `goblinVariants.ts` に集約済み

扱い:

- `troll` 因子の亜種 `トロルゴブリン` として利用

---

## 5. 追加手順

今後、新しい亜種を追加するときの基本手順は次の通り。

1. 画像ファイルを `assets/goblin/` に追加する
2. [goblinVariants.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/data/goblinVariants.ts) に亜種定義を追加する
3. [goblinImages.ts](/Users/astapi/projects/goblinKingdom/goblin_native/src/shared/utils/goblinImages.ts) に `require()` を追加する
4. 必要ならテストを追加する
5. 必要なら仕様ドキュメントを更新する

---

## 6. チェックリスト

### 定義

- 因子IDを決めた
- 因子名を決めた
- 因子説明文を決めた
- 継承確率を決めた
- 因子効果を決めた
- 亜種化確率を決めた
- 種族名を決めた
- avatar パスを決めた
- imageKey を決めた
- 亜種追加効果を決めた
- 基礎能力値を決めた
- HP係数を決めた
- 攻撃回数を決めた
- 初期スキルを決めた

### 実装

- `goblinVariants.ts` を更新した
- `goblinImages.ts` を更新した
- 型チェックを通した
- 関連テストを通した

---

## 7. 補足

この構成でも、画像登録だけは完全自動化していない。
理由は React Native で画像 `require()` が静的解決前提だから。

そのため、現在の最小作業単位は次の通り。

1. 亜種定義を1件追加する
2. 画像 require を1件追加する

これが、現状で最も少ない変更量で安全に運用できる形です。
