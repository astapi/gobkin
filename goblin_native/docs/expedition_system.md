# 遠征システム

## 概要

遠征はダンジョンを探索する本ゲームの中心システム。
シード値ベースの決定論的シミュレーションで、同じシードなら同じ結果が再現される。
パーティを選択してダンジョンに派遣し、フロアを進みながら戦闘・探索・宝箱取得を行い、最終階のボスを倒すとダンジョン制圧となる。

## 遠征の全体フロー

```
【準備画面】
  パーティ選択 → ダンジョン選択 → 帰還ポリシー選択
  ↓
【遠征開始】StartExpeditionUseCase
  パーティ状態確認 → ゴブリンロード → ExpeditionEngine.generateExpedition()
  ↓
【シミュレーション】ExpeditionEngine
  パーティ状態初期化
  ↓
  フロア1: イベント生成 → 戦闘/探索 → HP更新 → 帰還判定
  フロア2: イベント生成 → 戦闘/探索 → HP更新 → 帰還判定
  ...
  最終フロア: ボス戦
  ↓
  帰還イベント生成 → 報酬集計 → ExpeditionReplay返却
  ↓
【再生画面】playback.tsx
  タイムライン形式でイベントを表示
  ↓
【遠征完了】CompleteExpeditionUseCase
  経験値分配 → レベルアップ → 因子獲得 → 宝箱装備保存 → ダンジョン制圧判定
  ↓
【結果画面】result.tsx
  経験値/ゴールド/宝箱/レベルアップ表示
  ↓
【ゴブリン誕生】初回制圧時のみ
  GoblinBirthService.createNewGoblin()
```

## シード値とランダム生成

### シード生成

```
seed = Math.floor(Math.random() × 0x7FFFFFFF)
```

### 擬似乱数生成器（線形合同法）

```
state = (state × 1664525 + 1013904223) % 0x100000000
return (state >>> 0) / 0x100000000
```

すべてのランダム判定（イベント種別、敵パターン、戦闘、宝箱ドロップ等）がこの乱数列から生成されるため、同じシードなら完全に同じ遠征結果になる。

## フロア探索

### イベント時刻の生成

各フロアに `perFloorEvents` 個のイベントが均等間隔+ジッターで配置される:

```
floorDuration = totalDuration / floors
baseTime = floorStart + (i+1) × (floorDuration / (perFloorEvents + 1))
jitter = (rng() - 0.5) × (floorDuration × 0.2)   ← ±10%のランダムずれ
eventTime = max(floorStart + 1, baseTime + jitter)
```

### イベント種別の選択

`eventWeights` に基づく加重抽選:

```json
"eventWeights": { "battle": 40, "exploring": 50 }
```

→ battle 44.4% / exploring 55.6%

### イベントフロー（1イベントあたり）

```
イベント種別判定
  ├─ "battle" → 敵パターン選択 → 戦闘実行 → HP反映
  │              → 敗北なら即帰還
  │              → 勝利なら宝箱判定 → 帰還条件判定
  ├─ "exploring" → 探索イベント記録（効果なし）
  └─ その他 → battleとして処理（フォールバック）
```

## TimelineEvent の種類

| type | 発生タイミング | 内容 |
|------|-------------|------|
| `move_start` | フロア探索開始時 | `floor`: フロア番号 |
| `floor_up` | フロア間移動時 | `from`, `to`: 移動元/先のフロア |
| `battle` | 通常戦闘時 | `enemy`: 敵スナップ, `combat`: 戦闘結果, `xp`: 経験値 |
| `boss` | ボス戦時 | 同上（最終フロア到達後） |
| `exploring` | 探索イベント時 | フロア番号のみ（効果なし） |
| `treasure` | 宝箱ドロップ時 | `items`: TreasureDrop[] |
| `return` | 遠征終了時 | `reason`: 終了理由 |

## 帰還ポリシー

パーティ派遣時に6種類から選択。戦闘勝利後に判定される。

| ポリシー | 条件 | 判定内容 |
|---------|------|---------|
| `never` | 帰還しない | ボスクリアまたは全滅まで続行 |
| `until_floor2` | 2階到達で帰還 | `currentFloor >= 2` |
| `until_floor3` | 3階到達で帰還 | `currentFloor >= 3` |
| `if_any_ko` | 1体でも戦闘不能 | `partyState.some(m => m.isKO)` |
| `if_two_ko` | 2体以上戦闘不能 | `partyState.filter(m => m.isKO).length >= 2` |
| `last_one` | 生存1体以下 | `aliveMembers <= 1` |

### 帰還判定のタイミング

- **戦闘勝利後**: `checkReturnConditions()` で帰還ポリシーを判定
- **戦闘敗北時**: 即座に `shouldReturn = true, reason = 'defeated'`
- 帰還理由は `policy_return`（ポリシーによる帰還）

### 推定探索時間への影響

帰還ポリシーごとに時間倍率が異なる:

| ポリシー | 倍率 |
|---------|------|
| never | ×1.0 |
| until_floor2 | ×0.4 |
| until_floor3 | ×0.6 |
| if_any_ko | ×0.7 |
| if_two_ko | ×0.75 |
| last_one | ×0.9 |

## 遠征の終了理由

| 理由 | 説明 |
|------|------|
| `completed` | ダンジョン踏破（ボスクリア） |
| `defeated` | 全滅（味方全員HP 0） |
| `policy_return` | 帰還ポリシーによる帰還 |
| `abort` | 緊急帰還（ユーザー操作、未実装） |

### 成功判定

`completed` または `policy_return` が成功とみなされる。
`defeated` は失敗。

## ボス戦

### 発生条件

最終フロアの全イベントを処理し、帰還せずに到達した場合。

### ボスパターン選択

```
bossPatterns = patterns.filter(p => p.isBoss && p.floors.includes(最終フロア))
→ ランダムに1パターン選択
```

### ボス戦後の処理

- **勝利**: `reason = 'completed'`、宝箱ドロップ判定あり
- **敗北**: `reason = 'defeated'`
- ボスなしエリア: 最終階到達で `reason = 'completed'`

## 敵パターンシステム

### EnemyPattern

```typescript
{
  id: "SP001",
  floors: [1, 2],                    // 出現フロア
  enemies: [["S001", "S001"], ["S002"]], // 2D配列: [列][スロット]
  isBoss?: boolean                    // ボスパターンフラグ
}
```

### 敵の隊列

`enemies` が2D配列で隊列を表現:

```
enemies[0] = ["E001", "E001"]  → 前列に2体
enemies[1] = ["E003"]          → 後列に1体
```

BattleSystem の隊列重み付け（前列50% → 25% → ...）がそのまま適用される。

### パターン選択

- 通常戦闘: `!isBoss && floors.includes(currentFloor)` のパターンから均等抽選
- ボス戦: `isBoss && floors.includes(最終フロア)` のパターンから均等抽選

## パーティ状態管理

### PartyState

遠征中の各メンバーの状態を管理:

```typescript
{
  id: string,         // ゴブリンID
  name: string,
  currentHP: number,  // 戦闘ごとに減少・引き継ぎ
  maxHP: number,      // 因子・Mod適用後の最大HP
  baseHP: number,     // 基礎HP（戦闘時のGoblin再構築用）
  atk, def, spd, sp, attackCount, accuracy, evasion,
  isKO: boolean,      // 戦闘不能
  isDead: boolean,    // 死亡
  mods, factors, variantFactorId,
  level: number,
  avatar: string
}
```

### HPの引き継ぎ

- 初期化時: `effectiveStats.hp`（因子・Mod適用後）
- 各戦闘後: `currentHP += allyHPDelta[index]`（通常は負数）
- HP 0以下: `isKO = true, isDead = true`
- **戦闘不能者はHP回復しない**（次の戦闘にも0のまま参加→即死）

### 戦闘時のGoblin再構築

```
PartyState → Goblin再構築（基礎ステータス + mods + factors）
→ BattleSystem.executeBattle(goblins, currentHP, enemies, rng)
→ 戦闘中はModStatCalculatorが因子・Modを適用した実効ステータスで計算
```

## 報酬システム

### 経験値

各戦闘イベント（battle/boss）に `xp` が設定される:

```
通常戦闘: area.rewards.xpFloor[currentFloor - 1]  （フロアごとに定義）
ボス戦: area.rewards.xpBoss
```

#### 経験値分配（CompleteExpeditionUseCase）

```
各戦闘時点での生存メンバー数で割る:
  xpPerMember = floor(event.xp / aliveCount)
→ 生存メンバーにのみ配分
```

生存者が少ないほど1人あたりの取得経験値が増える。

### ゴールド

```
goldGained = Σ(各戦闘の enemy.gold)
```

全敵のgoldを合算。自動的に拠点のゴールドに加算される。

### 宝箱ドロップ

#### ダンジョンレベル準拠ドロップ

```
1. 一律25%（DROP_CHANCE定数）で判定
2. areaLevelに対応する装備プールから候補取得
3. 同一遠征で既にドロップした装備は除外
4. 候補から均等抽選
5. 称号を抽選（EquipmentTitleService.rollTitle）
6. 称号付き名前を生成
```

#### 敵個別のレアドロップ

```
各敵の equipmentDrops を順番にチェック:
  probability で判定 → テンプレートから装備生成 → 称号抽選
```

#### 重複制限

同一遠征中に同じ `templateId` の装備は1個までしかドロップしない（`droppedIds` Setで追跡）。

## ダンジョン定義

### AreaConfig

```typescript
{
  id: "forest_outskirts",
  name: "周辺の森",
  areaLevel: 2,              // 個体値計算・装備プール用
  floors: 3,                 // フロア数
  baseDurationSec: 60,       // 基本探索時間（秒）
  encounter: {
    perFloorEvents: 3,       // フロアあたりのイベント数
    eventWeights: {           // イベント種別の重み
      battle: 40,
      exploring: 50
    }
  },
  rewards: {
    xpFloor: [8, 10, 12],   // フロアごとの戦闘経験値
    xpBoss: 30               // ボス戦経験値
  },
  // 宝箱ドロップ率は全エリア一律25%（ExpeditionEngine.DROP_CHANCE定数）
  unlockNext: "goblin_village_1"  // 制圧時に解放されるダンジョン
}
```

### ダンジョン一覧

| エリアレベル | ダンジョン群 |
|------------|------------|
| 1 | slime_cave |
| 2 | forest_outskirts, goblin_village_1/2/3 |
| 3 | orc_camp_1/2/3, undead_ruins_1/2/3, subjugation_force_1/2/3 |
| 4 | human_village_1/2/3 |
| 5 | dwarf_mine_1/2/3, elf_forest_1/2/3 |
| 6 | lizardman_swamp_1/2/3, troll_canyon_1/2/3 |
| 7 | human_fortress_1/2/3 |
| 8 | royal_capital_1/2/3 |

※ 各ダンジョン群の `_1/_2/_3` はサブステージ（同一エリアの難易度段階）。`_3` がボスステージで因子ドロップあり。

## ダンジョン制圧判定

### 制圧成功の条件

```
replay.summary.success === true
AND replay.summary.maxFloorReached >= dungeon.floors
```

つまり、帰還ポリシーによる途中帰還（policy_return）でも成功扱いだが、制圧には**全フロア到達**が必要。

### 制圧時の処理

1. ダンジョンをクリア済みにマーク
2. 初回制圧なら拠点化（`captureDungeon()`）
3. ゴールド加算
4. 次のダンジョン解放（`unlockNext`）
5. 新ゴブリン誕生（GoblinBirthService）

## 遠征の永続化

### ExpeditionRecord

```typescript
{
  id: "exp_1234567890_abc",
  partyId: number,
  partyName: string,
  dungeonId: string,
  dungeonName: string,
  startTime: Date,
  returnTime: Date | null,     // 帰還予定時刻
  status: 'ongoing' | 'completed' | 'failed',
  returnPolicy: string,
  replay?: ExpeditionReplay,   // JSON文字列で保存
}
```

### SQLiteテーブル

```sql
expeditions (
  id TEXT PRIMARY KEY,
  party_id INTEGER,
  party_name TEXT,
  dungeon_id TEXT,
  dungeon_name TEXT,
  start_time TEXT,
  return_time TEXT,
  status TEXT,
  return_policy TEXT,
  replay_json TEXT
)
```

### 自動完了メカニズム

`useExpeditionFlow` が1秒ごとに `completeDueExpeditions()` を実行:
- `returnTime <= now` の遠征を自動完了
- `CompleteExpeditionUseCase.execute()` で経験値・因子・装備を処理
- 重複処理防止（`processedExpeditionsRef`）

## 画面遷移

### preparation.tsx（準備画面）

- パーティ選択
- ダンジョン選択（アンロック済みのみ）
- 帰還ポリシー選択（6種類）
- 推定探索時間表示
- 「出撃」ボタンで遠征開始

### playback.tsx（再生画面）

- タイムライン形式でイベントを時系列表示
- move_start / floor_up / exploring / battle / boss / treasure / return

### result.tsx（結果画面）

- 到達フロア / ダンジョン踏破判定
- 経験値・ゴールド
- 宝箱ドロップ一覧
- レベルアップメンバー表示

## 関連ソースコード

| ファイル | 内容 |
|---------|------|
| `src/core/services/ExpeditionEngine.ts` | 遠征シミュレーション本体（615行） |
| `src/core/usecases/StartExpeditionUseCase.ts` | 遠征開始処理 |
| `src/core/usecases/CompleteExpeditionUseCase.ts` | 遠征完了処理（経験値・因子・装備） |
| `src/shared/types/Expedition.ts` | 全型定義（ExpeditionReplay, TimelineEvent, AreaConfig等） |
| `src/shared/types/Enemy.ts` | Enemy, EnemyPattern, EnemySnap 型 |
| `src/shared/types/Party.ts` | PartyState 型 |
| `src/shared/data/expeditionArea/` | ダンジョン定義JSON群（39ファイル） |
| `src/shared/data/enemy/` | 敵データJSON群 |
| `src/presentation/hooks/useExpeditionFlow.ts` | 遠征UIフック（自動完了、画面連携） |
| `src/presentation/stores/useExpeditionStore.ts` | 遠征Zustandストア |
| `app/(tabs)/formation/preparation.tsx` | 準備画面 |
| `app/(tabs)/formation/playback.tsx` | 再生画面 |
| `app/(tabs)/formation/result.tsx` | 結果画面 |
