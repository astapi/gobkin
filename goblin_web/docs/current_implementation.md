# 現在の実装状況

このドキュメントはgoblin_webの現在の実装状況を整理したものです。

## 目次

1. [実装済み機能](#実装済み機能)
2. [データモデル](#データモデル)
3. [リポジトリ実装](#リポジトリ実装)
4. [コアシステム](#コアシステム)
5. [ダンジョン・エリアデータ](#ダンジョンエリアデータ)
6. [敵データ](#敵データ)
7. [アイテム・装備システム](#アイテム装備システム)
8. [認証・状態管理](#認証状態管理)

## 実装済み機能

### 画面構成（約3,300行のUIコンポーネント）

#### タブメニュー構成
- ゴブリン一覧タブ
- 編成タブ
- 遠征タブ

#### ゴブリン関連画面
- `GoblinListScreen.tsx`: 所持ゴブリンの一覧表示
- `GoblinCard.tsx`: ゴブリンカード表示コンポーネント
- `GoblinDetailModal.tsx`: ゴブリン詳細モーダル（ステータス、装備管理）

#### パーティ編成関連画面
- `FormationTabScreen.tsx`: パーティ編成タブのメイン画面
- `FormationScreen.tsx`: パーティ一覧と管理
- `PartyEditScreen.tsx`: パーティメンバー編集
- `PartySelectScreen.tsx`: パーティ選択画面
- `ExpeditionPreparationScreen.tsx`: 遠征準備画面

#### 遠征関連画面
- `ExpeditionTabScreen.tsx`: 遠征タブのメイン画面
- `DungeonScreen.tsx`: ダンジョン選択画面
- `ExpeditionSetupScreen.tsx`: 遠征設定画面
- `ExpeditionPlaybackScreen.tsx`: 遠征のリアルタイム再生
- `ExpeditionResultScreen.tsx`: 遠征結果表示（アニメーション付き）
- `ExpeditionLogScreen.tsx`: 遠征ログ詳細表示

#### モーダル類
- `DungeonSelectionModal.tsx`: ダンジョン選択モーダル
- `DungeonConfirmModal.tsx`: ダンジョン確認モーダル
- `FloorTargetSelectionModal.tsx`: 目標階層選択モーダル
- `ReturnPolicySelectionModal.tsx`: 帰還ポリシー選択モーダル
- `ExpeditionConfirmModal.tsx`: 遠征確認モーダル

## データモデル

型定義の場所: `src/shared/types/`

### ゴブリン関連 (Goblin.ts)
```typescript
Goblin: {
  id: string
  name: string
  race: string
  level: number
  avatar: string
  stats: GoblinStats
  equipment: EquipmentSlot[]
}

GoblinStats: {
  hp: number
  atk: number
  sp: number
  spd: number
  def: number
}

EquipmentSlot: {
  slotIndex: number (0-4)
  itemId: string | null
}
```

### パーティ関連 (Party.ts)
```typescript
Party: {
  id: string
  name: string
  memberIds: string[]
  status: PartyStatus
  dungeonId?: string
  targetFloor?: number
  returnPolicy?: ReturnPolicy
}

PartyStatus: "idle" | "expedition"

PartySnapshot: {
  food: number
  speed: number
  luck: number
  captureSlots: number
  // 他の遠征時パラメータ
}
```

### 遠征関連 (Expedition.ts)
```typescript
ExpeditionRequest: {
  partyId: string
  areaId: string
  returnPolicy: ReturnPolicy
}

ExpeditionReplay: {
  meta: { /* シード値、開始時刻など */ }
  timeline: TimelineEvent[]
  summary: RewardSummary
}

TimelineEvent: {
  type: "move_start" | "floor_up" | "battle" | "boss" |
        "resource" | "exploring" | "return"
  // イベント固有のデータ
}

ExpeditionEndReason:
  | "completed"      // ダンジョン完全クリア
  | "defeated"       // 全滅
  | "policy_return"  // 帰還ポリシーによる帰還
  | "abort"          // 中断

RewardSummary: {
  success: boolean
  maxFloorReached: number
  totalXp: number
  totalGold: number
  itemsObtained: Drop[]
  capturedEnemies: EnemySnap[]
  casualties: string[]
}
```

### 敵関連 (Enemy.ts)
```typescript
Enemy: {
  id: string
  name: string
  raceTags: string[]
  level: number
  baseStats: { hp, atk, def, spd }
  xp: number
  gold: number
}

EnemyPattern: {
  floor: number
  enemies: string[]
  isBoss: boolean
}

EnemyDatabase: {
  enemies: Enemy[]
  patterns: EnemyPattern[]
}
```

### アイテム関連 (Item.ts)
```typescript
Item: {
  id: string
  name: string
  description: string
  effect: ItemEffect
  icon?: string
}

ItemEffect: {
  hp?: number
  atk?: number
  sp?: number
  spd?: number
  def?: number
}

Drop: {
  itemId: string
  quantity: number
}
```

### 戦闘関連 (Battle.ts)
```typescript
BattleLogEntry: {
  turn: number
  actor: string
  action: string
  target?: string
  damage?: number
  hp?: number
  defeated?: boolean
}

CombatReplay: {
  rounds: number
  result: "victory" | "defeat"
  hpDeltas: Record<string, number>
  defeatedCount: number
  detailedLog: BattleLogEntry[]
  capture?: { /* 捕獲情報 */ }
}
```

### ダンジョン関連 (Dungeon.ts)
```typescript
Dungeon: {
  id: string
  name: string
  floors: number
  explorationTime: number
  description: string
  cleared: boolean
  difficulty: number
}
```

## リポジトリ実装

### リポジトリインターフェース

場所: `src/core/repositories/`

#### IGoblinRepository.ts
```typescript
- getGoblins(): Promise<Goblin[]>
- getGoblin(id): Promise<Goblin | null>
- saveGoblin(goblin): Promise<void>
- deleteGoblin(id): Promise<void>
- updateGoblinStats(id, stats): Promise<void>
- updateGoblinLevel(id, level): Promise<void>
- equipItem(goblinId, slotIndex, itemId): Promise<void>
- unequipItem(goblinId, slotIndex): Promise<void>
```

#### IPartyRepository.ts
```typescript
- getParties(): Promise<Party[]>
- getParty(id): Promise<Party | null>
- saveParty(party): Promise<void>
- deleteParty(id): Promise<void>
- updatePartyMembers(id, memberIds): Promise<void>
- updatePartyStatus(id, status): Promise<void>
```

#### IItemRepository.ts
```typescript
- getItems(): Promise<Item[]>
- getItem(id): Promise<Item | null>
- saveItem(item): Promise<void>
- deleteItem(id): Promise<void>
```

### Firestore実装

場所: `src/infrastructure/repositories/`

- `FirestoreGoblinRepositoryImpl.ts`: Firestoreを使用したゴブリンデータ管理、デフォルト5体を自動生成
- `FirestorePartyRepositoryImpl.ts`: パーティデータ管理
- `FirestoreItemRepositoryImpl.ts`: アイテムデータ管理、デフォルトアイテム自動生成
- `FirestoreExpeditionRepositoryImpl.ts`: 遠征記録の保存と取得、進行中の遠征管理

#### Firestoreデータ構造
```
users/{userId}/
  ├── goblins/{goblinId}
  ├── parties/{partyId}
  ├── items/{itemId}
  └── expeditions/{expeditionId}
```

### JSON実装（開発用）

- `JsonGoblinRepositoryImpl.ts`: ローカルストレージを使用
- `JsonPartyRepositoryImpl.ts`: ローカルストレージを使用

## コアシステム

場所: `src/core/services/`

### ExpeditionEngine.ts (17KB)

**機能**:
- シード値ベースの決定論的乱数生成（同じシードで同じ結果を再現可能）
- 遠征シミュレーション全体の制御
- フロア移動、イベント生成、戦闘実行
- TimelineEventの生成とExpeditionReplayの作成

**主要メソッド**:
- `generateExpedition(request, party)`: 遠征全体のシミュレーション実行
- `generateFloorEvents()`: フロアごとのイベント生成
- `processBattle()`: 戦闘イベント処理
- `checkReturnPolicy()`: 帰還ポリシーの判定

### BattleSystem.ts (5.9KB)

**機能**:
- ターン制戦闘ロジック
- 素早さ順の行動決定
- ダメージ計算の実行
- 戦闘ログの生成

**主要メソッド**:
- `executeBattle(allies, initialHP, enemies, rng, maxTurns)`: 戦闘実行
- `createAllyUnit()`: 味方ユニット作成
- `createEnemyUnit()`: 敵ユニット作成
- `createBattleResult()`: 戦闘結果生成

### DamageCalculator.ts (4.4KB)

**機能**:
- 複雑なダメージ計算ロジック
- 種族ボーナス/特効の適用
- クリティカル計算
- 防御力による軽減計算

**ダメージ計算式**:
```
damage = base * defMitigate * raceFactor * takenFactor * critFactor * rand

base = atk × skill.power
defMitigate = 1 - def/(def + defConstant)
raceFactor = 種族ボーナスの加算・乗算
critFactor = クリティカル時の倍率
```

### CombatantManager.ts

**機能**:
- ゴブリン/敵からCombatant型への変換
- 戦闘用データ構造の管理

## ダンジョン・エリアデータ

場所: `src/shared/data/areas.ts`

現在3つのエリアが定義されています。

### 1. 周辺の森 (forest_outskirts)
- **階数**: 3階
- **基本時間**: 60秒
- **エンカウント率**: 戦闘60%, 資源25%, 罠10%, NPC5%
- **出現敵**: スライム、ゴブリン斥候、森の狼、野生の猪
- **ボス**: 森の守護者 (Lv3)
- **報酬**: 小さな肉、回復草、木の枝、森の宝石

### 2. 苔むした洞窟 (mossy_cave)
- **階数**: 5階
- **基本時間**: 120秒
- **エンカウント率**: 戦闘70%, 資源20%, 罠8%, NPC2%
- **出現敵**: 洞窟スライム、コウモリの群れ、骸骨、洞窟蜘蛛
- **ボス**: スライムキング (Lv5)
- **報酬**: スライムコア、コウモリの翼、骨の欠片、洞窟の水晶、レア鉱石

### 3. 古びた採掘跡 (old_mine)
- **階数**: 7階
- **基本時間**: 240秒
- **エンカウント率**: 戦闘65%, 資源25%, 罠8%, NPC2%
- **出現敵**: 岩石ゴーレム、鉱山の亡霊、水晶蜘蛛、土の精霊
- **ボス**: 古代ゴーレム (Lv7)
- **報酬**: 鉄鉱石、貴重な宝石、ゴーレムコア、古代のルーン、ミスリル鉱石

### JSONファイルによる敵データ

`src/shared/data/enemy/forest_outskirts.json`:
- E001: スライム (Lv1, HP10, ATK2)
- E002: 森ネズミ (Lv2, HP10, ATK4)
- E003: ウルフ (Lv3, HP20, ATK5)
- E004: トゲリス (Lv4, HP20, ATK7)
- B001: グレイウルフ (Lv8, HP100, ATK15) - ボス

**出現パターン**:
- P001-P004: 通常戦闘（スライム群、混合編成など）
- BOSS: 3階でのボス戦

## 敵データ

`areas.ts`内のenemyDatabaseで14種類の敵を定義:

| 敵ID | 名前 | 基本HP | 基本ATK | 基本DEF |
|------|------|--------|---------|---------|
| slime | スライム | 20 | 8 | 3 |
| goblin_scout | ゴブリン斥候 | 25 | 12 | 5 |
| forest_wolf | 森の狼 | 35 | 15 | 8 |
| wild_boar | 野生の猪 | 45 | 18 | 12 |
| forest_guardian | 森の守護者 | 120 | 25 | 15 |
| cave_slime | 洞窟スライム | 30 | 10 | 4 |
| bat_swarm | コウモリの群れ | 20 | 12 | 2 |
| skeleton | 骸骨 | 40 | 16 | 10 |
| cave_spider | 洞窟蜘蛛 | 25 | 14 | 6 |
| slime_king | スライムキング | 180 | 30 | 20 |
| rock_golem | 岩石ゴーレム | 80 | 20 | 25 |
| mine_ghost | 鉱山の亡霊 | 50 | 18 | 8 |
| crystal_spider | 水晶蜘蛛 | 35 | 22 | 12 |
| earth_elemental | 土の精霊 | 70 | 24 | 18 |
| ancient_golem | 古代ゴーレム | 300 | 40 | 35 |

**種族タグ**: "beast"（魔獣）が主に使用されている

## アイテム・装備システム

### アイテムデータ

`areas.ts`内のitemDatabaseで14種類のアイテムを定義（レアリティ1-4）:

- **肉類**: 小さな肉
- **回復**: 回復草
- **素材**: 木の枝、骨の欠片、コウモリの翼、スライムコア
- **鉱石**: 鉄鉱石、レア鉱石、ミスリル鉱石
- **宝石**: 森の宝石、洞窟の水晶、貴重な宝石
- **特殊**: ゴーレムコア、古代のルーン

### 装備システム

場所: `src/core/domain/entities/GoblinEntity.ts`

**特徴**:
- 最大5スロット (MAX_EQUIPMENT_SLOTS = 5)
- アイテム装備でステータスにeffectが適用される
- 装備可能チェック（重複装備不可）
- 戦闘力計算に装備スロット使用数も考慮 (1スロット = +5ポイント)

**実装メソッド**:
- `equipItem(item, slotIndex)`: アイテム装備
- `canEquip(item)`: 装備可否判定
- `applyItemEffect(effect)`: ステータスへの効果適用
- `calculateCombatPower()`: 装備を含めた戦闘力計算

**デフォルトアイテム**:
```typescript
{
  id: 'wooden_stick',
  name: '木の棒',
  description: '素朴な木の棒。攻撃力が少し上がる。',
  effect: { atk: 2 }
}
```

## 認証・状態管理

### AuthContext

場所: `src/presentation/contexts/AuthContext.tsx`

**機能**:
- Firebase Authenticationによる匿名認証
- 自動サインイン（ユーザーが未認証の場合）
- 認証状態の管理とProviderパターン

**提供される値**:
- `user`: 現在の認証ユーザー
- `loading`: 認証処理中フラグ
- `signInAnonymous()`: 匿名認証関数

### ExpeditionStateContext

場所: `src/presentation/contexts/ExpeditionStateContext.tsx`

**機能**:
- 遠征中のパーティIDリスト管理
- 遠征記録の取得と管理
- Firestoreリポジトリとの連携

**提供される値**:
- `activeExpeditionPartyIds`: 遠征中のパーティIDリスト
- `setPartyExpeditionStatus()`: パーティの遠征状態変更
- `isPartyInExpedition()`: パーティが遠征中か判定
- `clearExpedition()`: 遠征をクリア
- `getExpeditionByPartyId()`: パーティの遠征記録取得
- `getOngoingExpeditions()`: 進行中の遠征一覧取得
- `getPartyExpeditionHistory()`: パーティの遠征履歴取得
- `expeditionRepository`: リポジトリへの参照

### カスタムHooks

場所: `src/presentation/hooks/`

**useGoblinService.ts**:
- ゴブリンデータの取得と管理
- リポジトリの初期化（Firestore/JSON切り替え）
- ローディング状態管理

**usePartyService.ts**:
- パーティデータの取得と管理
- パーティ編集操作（メンバー更新、ステータス変更）
- ダンジョン設定、目標階層設定、帰還ポリシー設定

**useExpeditionFlow.ts**:
- 遠征の開始・完了処理
- 遠征時間の見積もり
- 遠征記録のFirestore保存

**useCurrentTime.ts**:
- 現在時刻の1秒ごとの更新
- 遠征終了時刻の計算用

### UseCaseパターンの実装

場所: `src/core/usecases/`

実装されているUseCase:
- `StartExpeditionUseCase`: 遠征開始処理
- `ExecuteBattleUseCase`: 戦闘実行
- `ManagePartyUseCase`: パーティ管理
- `EquipItemUseCase`: アイテム装備
- `GetGoblinListUseCase`: ゴブリン一覧取得
- `GetGoblinByIdUseCase`: ゴブリン個別取得
- `CreatePartyUseCase`: パーティ作成
- `UpdatePartyMembersUseCase`: パーティメンバー更新
- `GetPartyListUseCase`: パーティ一覧取得
- `GetPartyByIdUseCase`: パーティ個別取得
- `ConfigurePartyUseCase`: パーティ設定

## アーキテクチャの特徴

### リポジトリパターンからUseCaseパターンへの移行

最近のコミット（33e8799）でリポジトリパターンからUseCaseパターンへリファクタリング:
- データアクセスと業務ロジックを明確に分離
- 将来的なUnity移植を見据えたプラットフォーム非依存設計

### 層構造

```
presentation/ (UI層) - React固有
    ↓
core/usecases/ (業務ロジック) - プラットフォーム非依存
    ↓
core/domain/ (ドメインエンティティ) - プラットフォーム非依存
    ↓
core/repositories/ (インターフェース) - プラットフォーム非依存
    ↑
infrastructure/ (実装) - 環境固有（Firestore/JSON）
```

### 決定論的シミュレーション

- シード値ベースの乱数生成により、同じ入力で同じ結果を保証
- リプレイ機能の実現
- デバッグとテストの容易性
