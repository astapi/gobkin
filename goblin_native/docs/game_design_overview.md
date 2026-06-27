# ゴブリンキングダム ゲーム仕様総合ドキュメント

ゴブリンキングダム（goblin_native）の画面構成・画面遷移・主要システム仕様をまとめた総合ドキュメントです。
コード調査に基づき、実装ファイルのパスを併記しています。仕様の最終的な根拠は各実装ファイルを参照してください。

## 目次

1. [ゲーム全体像](#1-ゲーム全体像)
2. [画面構成と画面遷移](#2-画面構成と画面遷移)
3. [遠征の仕組み](#3-遠征の仕組み)
4. [戦闘の仕組み](#4-戦闘の仕組み)
5. [アイテム・装備の知識](#5-アイテム装備の知識)
6. [スキルの知識](#6-スキルの知識)
7. [因子の知識](#7-因子の知識)
8. [亜種ゴブリンの知識](#8-亜種ゴブリンの知識)
9. [ゴブリンが生まれる仕組み](#9-ゴブリンが生まれる仕組み)
10. [拠点の知識](#10-拠点の知識)

---

## 1. ゲーム全体像

ゴブリンを管理し、パーティを編成してダンジョンへ遠征させるモバイルRPGです。中心となるゲームループは次の通りです。

```
拠点でゴブリンを管理・育成・装備
        │
        ▼
パーティを編成して遠征に出発
        │
        ▼
シミュレーション戦闘（全自動）を再生・観戦
        │
        ▼
報酬獲得（経験値・ゴールド・装備・因子）
        │
        ▼
ダンジョン制圧 → 新ダンジョン解放 + 新ゴブリン誕生
        │
        ▼
因子を持つゴブリンから次世代（亜種含む）が生まれる
        │
        └──────────────► 拠点へ戻る（ループ）
```

技術構成は Expo SDK 54 / React Native 0.81 / React 19 / TypeScript / Expo Router / SQLite / Zustand。
アーキテクチャは Clean Architecture（`presentation -> core/usecases -> core/domain|services -> repositories interface -> infrastructure`）です。

**決定論的シミュレーション**: 遠征・戦闘はシード値ベースの疑似乱数（線形合同法）で計算され、同じシードなら結果が完全に再現されます。これによりリプレイ表示と遅延計算（後から再計算）が可能になっています。

---

## 2. 画面構成と画面遷移

Expo Router のファイルベースルーティングを採用。主要画面は以下の通りです。

### タブ構成（`app/(tabs)/_layout.tsx`）

| タブ | ファイル | 役割 |
| --- | --- | --- |
| ゴブリン一覧 | `app/(tabs)/index.tsx` | ゴブリン管理のメイン画面、産まれたゴブリンの受け入れ |
| 拠点 | `app/(tabs)/base.tsx` | 拠点トップ。施設メニューへの起点 |
| 編成/遠征 | `app/(tabs)/formation/` | 遠征フロー全体 |

### 拠点配下の画面（`app/base/`）

| 画面 | ファイル | 解放ランク |
| --- | --- | --- |
| 治療所 | `app/base/healing.tsx` | Rank 1 |
| 拠点拡張 | `app/base/upgrade.tsx` | Rank 1 |
| 訓練所 | `app/base/training.tsx` | Rank 2 |
| 装備商店 | `app/base/shop.tsx` | Rank 2 |
| 特別商店 | `app/shop.tsx` | Rank 1 |

### ゴブリン詳細（`app/goblin/`）

| 画面 | ファイル | 役割 |
| --- | --- | --- |
| ゴブリン詳細 | `app/goblin/detail.tsx` | ステータス・スキル・因子の詳細 |
| 装備変更 | `app/goblin/equipment.tsx` | 装備の装着・取り外し |

### 遠征フローの画面（`app/(tabs)/formation/`）

| 画面 | ファイル | 役割 |
| --- | --- | --- |
| 編成一覧 | `index.tsx` | パーティ一覧。状態別に遷移先が分岐 |
| 遠征準備 | `preparation.tsx` | ダンジョン・帰還ポリシー・目標階層の選択 |
| メンバー編集 | `edit.tsx` | パーティメンバーの編成 |
| 再生 | `playback.tsx` | 遠征シミュレーションのタイムライン再生 |
| 戦闘ログ | `battle-log.tsx` | 個別戦闘の詳細ログ |
| 結果 | `result.tsx` | 遠征の成果表示 |
| レベルアップログ | `level-up-log.tsx` | レベルアップ詳細 |
| パーティ情報 | `party-info.tsx` | PTスキル/ステータス比較/因子一覧 |

### 遠征フローの画面遷移

```
formation/index（パーティ一覧）
  ├─ [待機中パーティ] ─► preparation（ダンジョン・ポリシー・目標階層）
  │                         └─► edit（メンバー編集）
  │                         └─► 遠征開始 ─► playback へ
  │
  ├─ [遠征中パーティ] ─► playback（タイムライン再生）
  │                         ├─► battle-log（戦闘詳細）
  │                         └─► 規定時間経過で自動完了 ─► result へ
  │
  └─ [完了済みパーティ] ─► result（成果表示：到達階層・経験値・ゴールド・宝箱・因子・解放）
```

詳細な画面仕様は [`docs/screen_reference.md`](screen_reference.md) を参照してください。

---

## 3. 遠征の仕組み

### 3.1 概要

遠征はゲームの中心コンテンツです。パーティをダンジョンに派遣し、「フロア探索 → 戦闘/イベント → 帰還」のサイクルで経験値・ゴールド・装備・因子を獲得します。
シード値ベースの決定論的シミュレーションのため、同じシードなら結果が完全再現されます。

### 3.2 主要なクラス・ユースケース

| 要素 | ファイル | 役割 |
| --- | --- | --- |
| StartExpeditionUseCase | `src/core/usecases/StartExpeditionUseCase.ts` | 遠征開始。パーティ検証・装備の実効ステータス再計算・シード生成・状態を `expedition` に更新 |
| ExpeditionEngine | `src/core/services/ExpeditionEngine.ts` | シミュレーション本体。シードからフロア進行・戦闘・ドロップを確定計算 |
| LazyExpeditionComputer | `src/core/services/LazyExpeditionComputer.ts` | `ExpeditionMeta` から `ExpeditionReplay` を再計算（遅延計算） |
| CompleteExpeditionUseCase | `src/core/usecases/CompleteExpeditionUseCase.ts` | 遠征終了処理。経験値分配・レベルアップ・因子獲得・装備保存・ダンジョン制圧 |
| useExpeditionFlow | `src/presentation/hooks/useExpeditionFlow.ts` | 遠征ライフサイクル管理・UI連携・自動完了 |

### 3.3 遠征の進行フロー

1. **開始** (`StartExpeditionUseCase` → `useExpeditionFlow.startExpedition`)
   - パーティが遠征可能か検証（`PartyEntity.canStartExpedition()`）
   - メンバーの装備情報を最新化し実効ステータスを再計算
   - シード生成（`Math.floor(Math.random() * 0x7FFFFFFF)`）
   - `ExpeditionMeta`（seed・request・出発メンバー・報酬倍率・ブースト）を作成し `ExpeditionRecord` を保存
   - 探索時間を `estimateExplorationTime()` で算出し、`returnTime = startTime + durationSec` を記録

2. **シミュレーション** (`ExpeditionEngine.generateExpedition`)
   - シードから疑似乱数生成器を初期化
   - 目標階層までフロアごとにループ
     - `generateFloorEvents()` でフロア内のイベント時刻を生成
     - `selectEventType()` で各イベントの種別を抽選（battle / exploring / goldTreasure）
     - 戦闘実行・結果反映・帰還条件判定
   - 最終階層到達時にボス戦
   - 金のドングリ使用時はクリア報酬イベント（ラタトスクエンカウント）
   - 報酬集計し `ExpeditionReplay` を返却

3. **再生** (`playback.tsx`)
   - `ExpeditionReplay` のタイムラインを1秒ごとに再生し、イベントログ・HP・現在フロアを表示
   - 戦闘詳細は `battle-log.tsx` へ遷移

4. **完了** (`CompleteExpeditionUseCase` / `useExpeditionFlow` の自動完了)
   - `useExpeditionFlow` が1秒ごとに `returnTime <= now` の遠征を自動完了
   - 経験値分配（勝利戦闘ごとに生存メンバー数で割る）→ レベルアップ
   - ボスの `factorDrops` から因子を確率抽選
   - 宝箱ドロップを装備DBに保存
   - ダンジョン制圧判定 → 制圧時は次ダンジョン解放 + 新ゴブリン誕生
   - `result.tsx` で成果を表示

### 3.4 タイムラインイベント（`TimelineEvent`、`src/shared/types/Expedition.ts`）

`move_start` / `floor_up` / `floor_end` / `battle` / `boss` / `exploring` / `gold_treasure` / `treasure` / `return` の各種別があり、それぞれ発生時刻 `at` を持ちます。

### 3.5 帰還ポリシー（`ExpeditionRequest.returnPolicy`）

| ポリシー | 意味 | 探索時間倍率（目安） |
| --- | --- | --- |
| `never` | 全滅か踏破まで帰還しない | 1.0 |
| `if_any_ko` | 1体でも戦闘不能になれば帰還 | 0.7 |
| `if_two_ko` | 2体戦闘不能で帰還 | 0.75 |
| `last_one` | 最後の1体になったら帰還 | 0.9 |

帰還理由（`ExpeditionEndReason`）は `completed`（踏破）/ `defeated`（全滅）/ `policy_return`（ポリシー帰還）/ `abort`（緊急帰還）。

### 3.6 ダンジョンとTier

- **エリア定義** (`AreaConfig`、`src/shared/types/Expedition.ts`): `areaLevel`・`floors`・`baseDurationSec`・`encounter`（イベント間隔・重み）・`enemyTable`・`boss`・`unlockNext` など。
- **エリアデータ**: `src/shared/data/expeditionArea/`。なお `_2` / `_3` バリアントは廃止され、難易度は **Tier** に統合されています。
- **Tier**（`src/shared/types/DungeonTier.ts`）: 0〜5の難易度段階。

| Tier | 接頭辞 | statScale | rewardScale | 因子ドロップ率 | 称号抽選回数 |
| --- | --- | --- | --- | --- | --- |
| 0 | （なし） | 1.00 | 1.00 | 1.5% | 1 |
| 1 | 魔性 | 1.58 | 1.58 | 2.5% | 2 |
| 2 | 宿った | 2.10 | 2.10 | 3.5% | 4 |
| 3 | 伝説 | 2.75 | 2.75 | 4.5% | 7 |
| 4 | 恐ろしい | 3.50 | 3.50 | 5.5% | 12 |
| 5 | 壊れた | 5.00 | 5.00 | 6.5% | 25 |

Tier により敵ステータス・報酬・探索時間がスケールします。エリアレベルは `getDungeonTierAreaLevel(baseAreaLevel, tier)` で算出されます。

### 3.7 報酬の仕組み

- **経験値**: 通常戦闘 `round(敵Lv * 1.8 * 種族係数)`、ボス `round(敵Lv * 9.6 * 種族係数)`。種族係数は human=1.15, construct=1.2 など（`src/shared/utils/enemyExp.ts`）。勝利戦闘ごとに生存メンバー数で分配。
- **ゴールド**: 敵の `gold` 合計 × 各種倍率（パーティ報酬倍率・スキル・課金ブースト）+ 宝箱ゴールド。
- **宝箱ドロップ** (`ExpeditionEngine.rollTreasureDrops`):
  - **ノーマルドロップ**: 敵ごとに運判定（`100 - rare*10 < 運乱数`）→ 敵Lvから `DropRankRoller` でランク抽選 → 該当ランク装備プールから抽選。同一遠征で同一テンプレートは1個まで。
  - **レアドロップ**: 敵の `rareEquipmentDrops` / `tierRareEquipmentDrops` から、アイテムごとに判定（`100 - rare*0.1 < 運乱数`）。
  - **称号付与**: `EquipmentTitleService.rollTitle()`。Tierが高いほど抽選回数が増え高位称号が出やすい。
- **因子ドロップ**: ボスの `factorDrops` から確率抽選（後述）。

### 3.8 ブースト

| ブースト | 倍率 | 内容 |
| --- | --- | --- |
| 金のドングリ | 経験値・ゴールド・レア・称号 2.0倍 + 探索時短 | チケット消費 |
| 月パス | ゴールド・レア・称号・因子 1.5倍 | 月額 |

複数ブーストは乗算合成されます（`combineExpeditionBoosts`）。

詳細は [`docs/expedition_unlock_routes.md`](expedition_unlock_routes.md) も参照してください。

---

## 4. 戦闘の仕組み

戦闘は全自動です。プレイヤー操作はなく、**パーティ編成・装備・スキル・隊列が戦略の全て**です。LCG乱数（シード）で完全に再現可能です。

### 4.1 主要ファイル

| 要素 | ファイル | 役割 |
| --- | --- | --- |
| BattleSystem | `src/core/services/BattleSystem.ts` | 戦闘メインループ・命中判定・隊列選択 |
| DamageCalculator | `src/core/services/DamageCalculator.ts` | 基本ダメージ計算・種族ボーナス |
| GoblinStatCalculator | `src/core/services/GoblinStatCalculator.ts` | 実効ステータス計算 |

### 4.2 ターンの流れ（`executeBattle`、最大20ターン）

1. ターン10で呪文チャージ回復
2. 生存ユニットを行動順値でソート（高い順に行動）
   - 行動順値 = `max(1, agility)² × actionOrderMultiplier × randomB`（randomB は 0.21〜1.0）
3. 各ユニットが行動（呪文チャージがあれば魔法優先、なければ通常攻撃を攻撃回数分）
4. 勝敗判定（敵全滅=win / 味方全滅=lose / 20ターン到達=retreat）

### 4.3 ステータス（`GoblinStats`）

| ステータス | 戦闘での役割 |
| --- | --- |
| `hp` | 0で戦闘不能 |
| `atk` | `base = atk × skill.power` の基礎 |
| `def` | 防御軽減率 `1 - def/(def+100)` |
| `attackCount` | 1ターンの通常攻撃試行回数 |
| `accuracy` | 命中側パラメータ |
| `evasion` | 回避側パラメータ |
| `magicAtk` | 魔法ダメージ基礎 |
| `magicHeal` | ヒール回復量 |
| `criticalRate` | クリティカル率（上限50%） |

### 4.4 ダメージ計算

```
ダメージ = floor(
  (基本ダメージ × ダメージ補正 × 後列火力支援 × 隊列補正 + 追加ダメージ)
  × 物理威力 × クリティカル補正 × 物理与ダメージ倍率
  × 各種被ダメージ軽減（物理・遠距離・シールド・後列ガード等）
  × 防御ファクター × 2列攻撃倍率
)   // 最小値 1

基本ダメージ = (atk × skill.power) × (1 - def/(def+100)) × 種族係数 × 被ダメ係数 × クリ係数 × rand
rand = 0.6 + rng() × 0.45  // [0.6, 1.05)
```

- **攻撃回数によるダメージ減衰** (`getDamageModifier`): 1〜2回目は×1.0、3回目以降は `0.9^(回数-2)`。
- **命中率** (`hitRate = clamp(rand × (accuracy×accMod - evasion×hpMod), 5, 95)`)
  - 命中補正 (`getAccuracyModifier`): 1回目×1.0、2回目以降 `0.6 × 0.9^(回数-2)`。
  - HP補正 (`hpMod = 0.5 × (1 + HP割合)`): HP満タンで回避フル、瀕死で回避半減。

### 4.5 隊列（行・列）

敵・味方とも2次元配列で配置（`enemies[row][slot]`）。隊列補正（`getRowWeight`）により最前列は強化、後列ほど通常攻撃ダメージが減衰します。
- 近接武器（`weapon_melee_attack`）: 後列ほどダメージ低下
- 遠距離武器（`weapon_ranged_attack`）: 後列ほどダメージ上昇
- 後列火力支援（`inspire_150`）: 後列味方のダメージ1.5倍

### 4.6 魔法システム

- チャージがあれば魔法を優先。ターン10でチャージ回復。
- ターゲティング: `random_hits`（重複あり複数体）/ `multi_target`（重複なし複数体）/ `single_ally_lowest_hp`（最低HP味方）。
- 魔法ダメージは `magicAtk` と呪文係数・レベル補正から算出。

### 4.7 戦闘結果（`BattleResult`、`src/shared/types/Battle.ts`）

`outcome`（win/lose/retreat）、`allyHPDelta`（各メンバーのHP増減）、`enemyDefeated`、詳細ログ（`detailedLog`）を返します。
遠征エンジンが `allyHPDelta` をパーティ状態に反映し、HP0で `isKO`/`isDead` を設定します。

### 4.8 敵データ（`src/shared/data/enemy/`）

`Enemy`（`src/shared/types/Enemy.ts`）は level/hp/atk/def/attackCount/accuracy/evasion/exp/gold に加え、`raceTags`・`physicalResistancePercent`・`magicResistancePercent`・`skills`・`spells`・`rareEquipmentDrops`・`factorDrops` などを持ちます。`EnemyPattern` で出現フロアと隊列を定義します。

> 既知の改善対象（[`docs/battle_damage_investigation_2026-05-09.md`](battle_damage_investigation_2026-05-09.md)）: ダメージ/命中減衰が「命中HIT数」ではなく「ミス含む攻撃試行番号」で適用されている点など。

---

## 5. アイテム・装備の知識

### 5.1 装備プール（`src/shared/data/equipmentPool.json`）

バージョンとテンプレート配列で構成。各 `EquipmentTemplate`（`src/shared/types/Equipment.ts`）の主なフィールド:

```json
{
  "id": "sword_cypress_stick",
  "name": "ひのきの棒",
  "category": "weapon",
  "subCategory": "sword",
  "statBonuses": [{ "stat": "atk_flat", "value": 2 }, { "stat": "accuracy_flat", "value": 8 }],
  "grantedSkillIds": ["def_to_hp_1"],
  "range": "melee",
  "price": 5,
  "unlockRank": 1,
  "rank": 0
}
```

- **カテゴリ** (9種): `weapon` / `armor` / `robe` / `shield` / `large_shield` / `gauntlet` / `wand` / `rod` / `accessory`
- **武器サブカテゴリ** (7種): `sword` / `axe` / `spear` / `bow` / `staff` / `claw` / `hidden`
- **ステータス種別**: フラット（`hp_flat` 等）とパーセント（`hp_percent` / `atk_percent` / `def_percent` / `critical_rate_percent` / `damage_reduction`）
- `unlockRank`: 店売り解放ランク / `rank`: ドロップ抽選ランク / `isRare`: レア判定

### 5.2 入手方法

- **ドロップ**: 遠征中（前述の宝箱ドロップ）。ランク抽選は `DropRankRoller`（敵Lv以上の最上段ステップから確率判定、失敗で1段下へ）。
- **店売り**: `getShopEquipment(baseRank)` で拠点ランク以下の `unlockRank` を購入可能。装備商店（`app/base/shop.tsx`、Rank 2解放）。売却は買取価格50%。

### 5.3 称号（`EquipmentTitle`）

ドロップ時に確率付与される接頭辞。プラス補正倍率・マイナス補正倍率・価格倍率・抽選重み・ランクを持ちます（`src/shared/data/equipmentTitleConfig.ts`）。

| 称号 | プラス倍率 | マイナス倍率 | rank |
| --- | --- | --- | --- |
| 最低な (worst) | 0.50 | 2.00 | 1 |
| 臭い (stinky) | 0.80 | 1.25 | 2 |
| （なし） | 1.00 | 1.00 | 0 |
| 名工の (masterwork) | 1.33 | 0.75 | 3 |
| 魔性の (magical) | 1.58 | 0.63 | 4 |
| 宿った (imbued) | 2.10 | 0.48 | 5 |
| 伝説の (legendary) | 2.75 | 0.36 | 6 |
| 恐ろしい (terrifying) | 3.50 | 0.29 | 7 |
| 壊れた (broken) | 5.00 | 0.20 | 8 |

付与判定 → あり判定時にTier別回数だけ重み抽選 → 最も高ランクの称号を採用（`EquipmentTitleService`）。

### 5.4 ステータスへの影響（`GoblinStatCalculator`）

```
通常ステータス = floor((基礎 + 因子 + 装備フラット + スキルフラット) × (1 + 装備%/100)) × スキル倍率
HPのみ        = floor((基礎 + 装備フラット + スキルフラット) × (1 + 装備%/100)) + 因子HP
```

### 5.5 装備スロットと重複ペナルティ

- **スロット解放** (`src/shared/data/equipmentConfig.ts`): レベルに応じて解放。通常最大23枠、才能「アイテム装備可能数」持ちは最大28枠。
- **重複ペナルティ** (`EquipmentService.getDuplicatePenaltyPercent`): 同一装備を複数装備すると2個目以降のボーナスが減少。3個目90%、5個以上70%…14個以上で1%まで低下。

### 5.6 付与スキル

`grantedSkillIds` / `grantedSkills` で装備時にスキル付与。武器には自動的に `weapon_melee_attack` / `weapon_ranged_attack` が付与されます。高度な例: `wand_bakuen` は `grant_fireball` + `fireball_twice` + `fireball_damage_120`。

### 5.7 関連UI・ツール

- 装備変更画面: `app/goblin/equipment.tsx`（カテゴリ/サブカテゴリフィルタ、ステータス・付与スキル表示、重複ペナルティ可視化）。
- i18n: `src/shared/i18n/resources/equipment.ts`（ja/en/ko、300+エントリ）。
- レアアイテム管理ツール: `tools/studio/src/pages/RareItemsPage.tsx`。

---

## 6. スキルの知識

### 6.1 型定義（`src/shared/types/CharacterSkill.ts`）

`CharacterSkill` は約60フィールドを持ち、効果カテゴリは以下に大別されます。

- **能力値/ステータス**: `baseAttributeBonuses` / `statBonuses` / `statMultipliers` / `baseStatMultipliers`
- **ダメージ**: `physicalDamagePercent` / `spellDamagePercent` / `additionalDamage` / `criticalRateBonusPercent` / `criticalDamageBonusPercent`
- **被ダメ軽減**: `physicalDamageReductionPercent` / `magicDamageReductionPercent` / `rangedAttackDamageReductionPercent` / `breathDamageReductionPercent` および対応する `*TakenMultiplier`
- **マスタリー**: `equipmentCategoryMultiplier` / `weaponSubCategoryMultiplier` / `equipmentStatMultipliers`
- **回復/HP**: `hpRegenPercent` / `hpRegenAmount` / `defToHpPercent` / `magicHealToHpPercent` / `surviveLethalDamageAtHp1`
- **戦術/行動**: `actTwicePerTurn` / `twoColumnAttack` / `coverLowHpAlly` / `actionOrderMultiplier` / `counterAttackAvoidanceRate`
- **特殊**: `recoverRandomUsedSpellOnDefend` / `immediateReviveOnAllyDeath` / `magicDamageFollowUp` / `criticalAttackFollowUp` / `physicalCounterAttack`
- **呪文**: `grantsSpellId` / `spellChargeBonusForId` / `extraSpellCharges` / `recoveryMagicLevel` / `mageMagicLevel` / `spellTakenMultipliers`
- **獲得系**: `expBonusPercent` / `expMultiplier` / `factorDropBonusPercent` / `factorDropMultiplier` / `goldBonusPercent` / `partyRareMultiplier` / `partyTitleMultiplier` / `expeditionTimeMultiplier`
- **種族系**: `raceBonus` / `raceTakenBonus` / `undead`
- **その他**: `itemSlotsBonus` / `rearAllyDamageMultiplier` / `protectRearAllyNormalAttackMultiplier` / `pureGoblinPartyStatBonusPercent` ほか

### 6.2 スキルカタログ（`src/shared/data/skillCatalog.ts`、約200種）

主な系統:

| 系統 | 例 | 効果 |
| --- | --- | --- |
| レアドロップ | `rare_slime_core` / `rare_ambush` / `rare_guardian` | 特殊効果 |
| HP系 | `hp_multiplier_5〜13` / `hp_regen_20` / `hp_regen_flat_10` | HP増加・回復 |
| 追加ダメージ | `additional_damage_1〜13` | 固定ダメージ加算 |
| マスタリー | `armor_mastery_*` / `shield_mastery_*` / `sword_mastery_*` | 装備カテゴリ/武器倍率 |
| 才能 | `talent_hp_150` / `talent_atk_150` / `talent_itemSlots` | 基本ステータス1.5倍 |
| 攻撃回数 | `attack_count_up_1〜11` | 攻撃回数+N |
| 基本能力値 | `base_power_up_1〜10` ほか6種 | 力/知恵/精神/体力/敏捷/運の加算 |
| 戦術 | `cover_low_hp_ally` / `two_column_attack` / `two_actions` / `action_order_150` | 行動・かばう等 |
| 威力 | `physical_damage_*` / `spell_damage_*` / `breath_damage_*` | ダメージ% |
| 軽減 | `physical_reduction_*` / `magic_reduction_*` / `attack_resistant_*` | 被ダメ軽減 |
| 変換 | `def_to_hp_*` / `magic_heal_to_hp_*` | ステータス変換 |
| 呪文 | `grant_heal` / `grant_fireball` / `recovery_magic_lv1〜7` / `mage_magic_lv1〜7` | 呪文習得・強化 |
| PT効果 | `magic_field` / `inspire_150` / `party_rare_mult_*` / `party_title_mult_*` | パーティ全体効果 |
| 種族特攻 | `beast_slayer_*` / `undead_slayer_*` / `dragon_slayer_*` | 対種族倍率 |
| 獲得 | `exp_bonus_*` / `factor_drop_bonus_*` / `gold_bonus_50` | 報酬増加 |
| ゴブリン固有 | `goblin_pack_tactics` / `goblin_binder` | 純ゴブリンPT戦術 |

### 6.3 入手方法

- **出生時**（最大4スキル、純ゴブリンのみ）: 因子由来（`factorSkillInheritanceRules`）+ 拠点ランク由来（`pureGoblinSkillManifestationRules`）の確率抽選（`src/shared/data/skillBirthRules.ts`）。
- **装備付与**: `grantedSkillIds`。
- **種族スキル**: `getRaceSkillIds(raceTags)` で種族から自動付与（亜種の固有スキル）。
- **ジョブスキル**: 訓練所でジョブ付与時（後述）。

### 6.4 戦闘での適用

`BattleSystem` 内で動的に効果を適用。行動順（`action_order_*`）、2回行動（`two_actions`）、2列攻撃（`two_column_attack`）、被ダメ軽減、魔法/会心援護、物理反撃、かばう、HP再生、呪文習得などが処理されます。ステータス系は `GoblinStatCalculator` で最終ステータスに反映。

### 6.5 i18n

`src/shared/i18n/resources/ja.ts` の `entities.skill.*` でラベル/説明を定義。未定義時は `describeCharacterSkill` がフィールドから自動生成します。

> スキルの追加・編集手順は `goblin-kingdom-skill-adder` スキルにまとまっています。

---

## 7. 因子の知識

### 7.1 概要

因子（Factor）はゴブリンに継承される「遺伝子」で、ステータスボーナスを与え、亜種ゴブリン誕生のトリガーになります。詳細は [`docs/factor_system.md`](factor_system.md) を参照。

### 7.2 型定義（`src/shared/types/Factor.ts`）

- `Factor`: `id` / `name` / `description` / `effects`（`FactorEffect[]`） / `inheritProbability`（継承確率） / `variantConfig?`（亜種化設定）
- `FactorEffect`: `type`（`stat_bonus` / `resistance` / `skill_unlock`） / `target`（対象ステータス） / `value`
- `FactorVariantConfig`: `probability`（亜種化確率） / `raceId` / `raceName` / `avatar`
- `FactorDropConfig`: `factorId` / `probability`（基準0.015） / `minDungeonTier?`

### 7.3 因子一覧（`src/shared/data/goblinVariants.ts`、`factors.ts`）

16種類（亜種対応15種 + ラタトスク）。代表例:

| 因子ID | 因子名 | 継承確率 | 亜種化確率 | 主効果 |
| --- | --- | --- | --- | --- |
| slime | スライム因子 | 0.30 | 0.20 | HP+20 |
| wolf | ウルフ因子 | 0.25 | 0.15 | ATK+10 |
| orc | オーク因子 | 0.20 | 0.10 | ATK+20, DEF+20 |
| hobgoblin | ホブゴブリン因子 | 0.25 | 0.20 | ATK+5, DEF+5 |
| dragon | ドラゴン因子 | 0.08 | 0.04 | HP+120, ATK+30, DEF+30 |
| shadow | ワーキャット因子 | 0.18 | 0.12 | ATK+18, 攻撃回数+1, 回避+20 |
| ratatoskr | ラタトスク因子 | 0.18 | （亜種なし） | 命中+10, 回避+10 |

（全16種は `goblinVariants.ts` を参照）

### 7.4 入手（ドロップ）

- ボス戦勝利時、ボスの `factorDrops` から確率抽選（`FactorService.rollFactorDrops`）。
- シード = `meta.seed + goblinId` の決定論的乱数。既所持因子はスキップ。
- 確率 = `drop.probability × probabilityMultiplier`（Tier倍率・スキル `factorDropBonus/Multiplier`）。
- Tier別実効率: 1.5%(T0) 〜 6.5%(T5)、最大約4.33倍（`DUNGEON_TIER_FACTOR_DROP_RATE`）。
- 生存メンバーのみ対象。
- **チュートリアル特例**: スライム洞窟初回クリア時はスライム因子を確定獲得。

### 7.5 効果と継承

- **ステータス**: 全因子の `effects` を合算しフラット加算（HPは計算式末尾で加算）。
- **継承**（`FactorInheritanceService.evaluateInheritance`、新ゴブリン誕生時）:
  1. 拠点ゴブリンから親を最大2体選出（Fisher-Yates）
  2. 親の因子を収集（重複排除）
  3. 各因子を `inheritProbability` で個別判定
  4. 引き継いだ因子をシャッフルし、各 `variantConfig.probability` で亜種判定
  5. **最初に成功した1種のみ亜種化**（複合亜種なし）

### 7.6 表示・永続化

- ゴブリンカード（`GoblinCard.tsx`）に因子アイコン最大2個 + 短縮名、超過分は `+N`。
- アイコン: `src/shared/utils/factorImages.ts`。
- 永続化（SQLite）: `factors_json` / `variant_factor_id` / `effective_stats_json`。
- チュートリアル: `learn_factor` → `learn_unlock` → `add_goblin` → `finish`。

---

## 8. 亜種ゴブリンの知識

### 8.1 概要

特定の因子を引き継いだゴブリンが、その因子に対応する別種族（Race）に進化したものが「亜種ゴブリン」です。定義は `src/shared/data/goblinVariants.ts`。

### 8.2 亜種定義（`GoblinVariantDefinition`）

`factorId` / `raceId` / `raceName` / `avatar` / `inheritProbability` / `variantProbability` / `factorEffects` / `hpCoefficient`（HP成長率） / `baseAttributes`（亜種固有の基本能力値） / `defaultSkillIds`（生まれつきスキル）。

### 8.3 主な亜種

| 亜種ID | 種族名 | 継承/亜種化 | HP係数 | 特性 |
| --- | --- | --- | --- | --- |
| slime | スライムゴブリン | 0.30 / 0.20 | 1.2 | HP・耐久 |
| wolf | ウルフゴブリン | 0.25 / 0.15 | 0.9 | ATK・敏捷 |
| orc | オークゴブリン | 0.20 / 0.10 | 1.5 | ATK・DEF |
| hobgoblin | ホブゴブリン | 0.25 / 0.20 | 1.2 | 均衡型 |
| dwarf | アイアンゴブリン | 0.20 / 0.10 | 1.0 | DEF・HP |
| troll | トロルゴブリン | 0.15 / 0.08 | 1.7 | 高HP |
| minotaur | ゴズゴブリン | 0.12 / 0.06 | 1.45 | 高ATK |
| vampire | ヴァンプゴブリン | 0.10 / 0.05 | 1.05 | 魔法攻撃 |
| dragon | ドラゴンゴブリン | 0.08 / 0.04 | 1.6 | 最高レア |
| shadow | シャドウゴブリン | 0.18 / 0.12 | 0.85 | 攻撃回数+1・回避 |

（lizardman / elf / harpy / hobbit などを含む全15亜種は `goblinVariants.ts` 参照）

### 8.4 亜種化の特徴

- 亜種化は引き継いだ因子の `variantConfig.probability` で判定。
- 複数因子を引き継いでも**最初に亜種化判定に成功した因子のみ**反映。
- 亜種は `defaultSkillIds` の固有スキルを持つ（純ゴブリンの「生まれつきスキル」抽選対象外）。
- `raceId` が `goblin`（純ゴブリン）以外、`variantFactorId` に元因子が記録されます。

---

## 9. ゴブリンが生まれる仕組み

### 9.1 主要ファイル

| 要素 | ファイル |
| --- | --- |
| 誕生ロジック | `src/core/services/GoblinBirthService.ts` |
| 因子継承 | `src/core/services/FactorInheritanceService.ts` |
| 個体値計算 | `src/core/services/BaseRankSystem.ts` |
| 生まれつきスキル | `src/shared/data/skillBirthRules.ts` |
| 遠征完了トリガー | `src/presentation/hooks/useExpeditionFlow.ts` |

### 9.2 誕生のトリガー

1. **遠征完全クリア時**（最も基本）: ダンジョンを全フロア制圧すると新ゴブリンが「待機中（pending）」として生成され、拠点一覧に追加候補として表示。待機枠上限は `拠点ランク × 5`。
2. **ストーリー報酬**: ストーリー読了で特定亜種を確定付与（`useStoryStore.grantPendingGoblin`）。待機枠上限を超えても付与。

### 9.3 生成フロー（`createNewGoblin`）

```
createNewGoblin(nextId, individualValue?, baseGoblins?, areaLevel?, baseRank?)
  ├─ 個体値決定
  │   ├─ individualValue 指定があればそれ
  │   ├─ areaLevel + baseRank → calculateIndividualValue()
  │   └─ どちらもなければ 1
  ├─ 因子継承評価（baseGoblins から）
  │   └─ FactorInheritanceService.evaluateInheritance()
  │       → inheritedFactors / isVariant / variantRaceId ...
  └─ createGoblin()
      ├─ 亜種なら亜種アバター・固有スキル・基本能力値を適用
      ├─ 純ゴブリンなら生まれつきスキルを抽選（最大4、因子由来＋ランク由来）
      └─ baseAttributes を基本値±[-5,+3]で変動
```

### 9.4 個体値（IV、1〜64）

```
finalIV = clamp(floor(min + (max-min)*rand) + BASE_RANK_BONUS[baseRank], 1, 64)
```

- エリアレベル別ベース範囲 `AREA_LEVEL_IV_RANGES`: Area1 [1,8] 〜 Area8 [50,60]
- 拠点ランクボーナス `BASE_RANK_BONUS`: Rank1=0 〜 Rank7=+12

例: Rank3拠点でArea3遠征 → IV = (12-20) + 4 = 16〜24。

### 9.5 ステータス確定

`GoblinStatCalculator.calculate()` で `基礎（レベル・亜種HP係数依存）+ 因子 + 装備 + スキル` を合成。HPは亜種の `hpCoefficient` の影響を受けます。

### 9.6 拠点への受け入れ（`app/(tabs)/index.tsx`）

「産まれたゴブリン」セクションで待機ゴブリンを表示。承認（`saveGoblin` → `removePendingGoblin`）または解雇（`removePendingGoblin`）。一括解雇も可能。

---

## 10. 拠点の知識

### 10.1 拠点トップ（`app/(tabs)/base.tsx`）

拠点ランク（1-7）、収容数（current/max）、最大パーティ数、所在地名、施設メニューを表示。

| 施設 | 遷移先 | 解放ランク | 機能 |
| --- | --- | --- | --- |
| 治療所 | `/base/healing` | 1 | HP0ゴブリンをゴールドで治療（Lv依存、亜種1.2倍） |
| 拠点拡張 | `/base/upgrade` | 1 | ダンジョン制圧後にゴールドでランクアップ |
| 訓練所 | `/base/training` | 2 | 純ゴブリンにジョブを付与（変更不可） |
| 装備商店 | `/base/shop` | 2 | 装備の購入・売却（買取50%） |
| 特別商店 | `/shop` | 1 | 課金アイテム |

### 10.2 拠点ランク（`src/core/services/BaseRankSystem.ts`）

| Rank | 最大PT | 最大ゴブリン | IVボーナス | 昇格コスト | 解放ダンジョン |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 10 | 0 | 0 | - |
| 2 | 2 | 20 | +2 | 100 | goblin_village_1 |
| 3 | 3 | 35 | +4 | 500 | human_village |
| 4 | 4 | 50 | +6 | 1500 | orc_fortress_1 |
| 5 | 5 | 70 | +8 | 4000 | human_fortress_1 |
| 6 | 6 | 100 | +10 | 10000 | vampire_castle_1 |
| 7 | 8 | 150 | +12 | 25000 | royal_capital_3 |

ランクアップ手順: 指定ダンジョン制圧（`capturedDungeons` に追加）→ `upgrade.tsx` で昇格ボタン → ゴールド消費 → `performRankUp()` で `BaseState` 更新。

### 10.3 BaseState（`src/shared/types/BaseState.ts`）

`rank` / `capacity` / `currentMaxParties` / `currentMaxGoblins` / `currentIVBonus` / `capturedDungeons` / `gold` / `nextGoblinId`。リポジトリは `IBaseStateRepository`（SQLite実装）。

### 10.4 訓練所（ジョブ）

- 対象: 純ゴブリン、保護対象外、ジョブ未取得、遠征中でない。
- ジョブ種別: `guard` / `thief` / `mage` / `warrior` / `cleric` / `rider` / `necromancer`。
- 解放条件: ダンジョン制圧またはストーリー閲覧（`getGoblinTrainingJobDefinitions`）。
- ジョブはレベルに応じたジョブスキルを付与（例: Guard Lv1 `talent_def_150` / `armor_mastery_150`、Lv15 `cover_low_hp_ally`）。**ジョブ変更不可**。

### 10.5 資源・通貨

| 資源 | 用途 | 入手 |
| --- | --- | --- |
| ゴールド | 治療・ランクアップ・装備購入 | 遠征報酬・装備売却 |
| 金のドングリ | 探索時短 + 報酬倍率 | 課金・イベント |
| 因子 | 亜種化の遺伝子 | ボスドロップ |
| 装備 | 装着・スキル付与 | 商店・ドロップ |

### 10.6 拠点と他システムの関係

```
拠点ランク
  ├─ currentMaxParties → 編成可能パーティ数
  ├─ currentMaxGoblins → ゴブリン収容上限（待機追加時の制限）
  ├─ currentIVBonus    → 新ゴブリンの個体値に加算
  ├─ capturedDungeons  → ランクアップ可否・ジョブ解放条件
  └─ gold              → ランクアップ・治療・装備購入の原資
```

遠征完全クリア → `GoblinBirthService.createNewGoblin(..., areaLevel, baseRank)` で拠点ランクボーナスが個体値に自動反映され、拠点所属ゴブリンの因子が子に継承されます。

---

## 付録: 主要ファイル早見表

| 領域 | 主要ファイル |
| --- | --- |
| 遠征エンジン | `src/core/services/ExpeditionEngine.ts` |
| 遠征開始/完了 | `src/core/usecases/StartExpeditionUseCase.ts` / `CompleteExpeditionUseCase.ts` |
| 遠征UIフロー | `src/presentation/hooks/useExpeditionFlow.ts` |
| 戦闘 | `src/core/services/BattleSystem.ts` / `DamageCalculator.ts` |
| ステータス計算 | `src/core/services/GoblinStatCalculator.ts` |
| 装備 | `src/shared/data/equipmentPool.json` / `src/core/services/EquipmentService.ts` |
| スキル | `src/shared/data/skillCatalog.ts` / `src/shared/types/CharacterSkill.ts` |
| 因子/亜種 | `src/shared/data/goblinVariants.ts` / `src/core/services/FactorInheritanceService.ts` |
| ゴブリン誕生 | `src/core/services/GoblinBirthService.ts` |
| 拠点 | `src/core/services/BaseRankSystem.ts` / `app/(tabs)/base.tsx` |
| Tier | `src/shared/types/DungeonTier.ts` |

## 関連ドキュメント

- 画面仕様: [`docs/screen_reference.md`](screen_reference.md)
- 全体構成: [`docs/project_structure.md`](project_structure.md)
- 因子システム: [`docs/factor_system.md`](factor_system.md)
- 遠征解放ルート: [`docs/expedition_unlock_routes.md`](expedition_unlock_routes.md)
- 戦闘ダメージ調査: [`docs/battle_damage_investigation_2026-05-09.md`](battle_damage_investigation_2026-05-09.md)
