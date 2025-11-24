# Firestore コレクション定義

このドキュメントは、ゴブリンキングダムRPGで使用されるFirestoreデータベースのコレクション構造を定義します。

## 目次

- [コレクション構造概要](#コレクション構造概要)
- [ユーザーごとのコレクション](#ユーザーごとのコレクション)
  - [users ドキュメント](#users-ドキュメント)
  - [goblins コレクション](#goblins-コレクション)
  - [pendingGoblins コレクション](#pendinggoblins-コレクション)
  - [parties コレクション](#parties-コレクション)
  - [items コレクション](#items-コレクション)
  - [expeditions コレクション](#expeditions-コレクション)

---

## コレクション構造概要

Firestoreのデータは、ユーザーごとにサブコレクションとして管理されています。

```
users (collection)
└── {userId} (document)
    ├── baseState (field) - 拠点の状態データ
    ├── goblins (subcollection)
    │   └── {goblinId} (document)
    ├── pendingGoblins (subcollection)
    │   └── {goblinId} (document)
    ├── parties (subcollection)
    │   └── {partyId} (document)
    ├── items (subcollection)
    │   └── {itemId} (document)
    └── expeditions (subcollection)
        └── {expeditionId} (document)
```

---

## ユーザーごとのコレクション

すべてのコレクションは `users/{userId}` の配下にサブコレクションとして配置されています。また、ユーザードキュメント自体にも拠点の状態データが保存されます。これにより、ユーザーごとにデータが完全に分離され、セキュリティルールの適用が簡単になります。

---

### users ドキュメント

**パス**: `users/{userId}`

ユーザーの基本情報と拠点の状態を管理するドキュメントです。

#### フィールド定義

| フィールド名 | 型 | 必須 | 説明 |
|-------------|-----|-----|------|
| `baseState` | `BaseState` | ✓ | 拠点の状態データ（詳細は下記） |

#### BaseState 型

```typescript
{
  capacity: number,           // 収容数（デフォルト: 8）
  rank: number,              // 拠点ランク（デフォルト: 1）
  lastSpawnTime: number,     // 最後にゴブリンが追加された時刻（Unix timestamp）
  slimeCaveCleared: boolean, // スライムの洞窟クリア状態
  firstBonusGranted: boolean,// 初回ボーナス受取済みフラグ
  nextGoblinId?: number      // 次に生成されるゴブリンのID
}
```

#### 動作フロー

1. **初期化**: ユーザーが初めて拠点管理画面を開いたときにデフォルト値で作成される
2. **時間経過チェック**: 拠点管理画面を開くたびに、`lastSpawnTime`と現在時刻を比較
3. **ゴブリン生成**: 経過時間に応じて新しいゴブリンを生成し、`pendingGoblins`コレクションに追加
4. **状態更新**: ゴブリンが追加されるたびに`lastSpawnTime`を更新

#### 実装ファイル

- 型定義: `src/shared/types/BaseState.ts`
- インターフェース: `src/core/repositories/IBaseStateRepository.ts`
- Firestore実装: `src/infrastructure/repositories/FirestoreBaseStateRepositoryImpl.ts`

---

### goblins コレクション

**パス**: `users/{userId}/goblins/{goblinId}`

ゴブリンキャラクターのデータを管理します。

#### ドキュメントID

- **形式**: `number` を `toString()` で変換した文字列
- **例**: `"0"`, `"1"`, `"2"`

#### フィールド定義

| フィールド名 | 型 | 必須 | 説明 |
|-------------|-----|-----|------|
| `id` | `number` | ✓ | ゴブリンの一意ID |
| `name` | `string` | ✓ | ゴブリンの名前 |
| `race` | `string` | ✓ | 種族名（例: "ゴブリン"） |
| `level` | `number` | ✓ | レベル |
| `avatar` | `string` | ✓ | アバター画像のパス |
| `stats` | `GoblinStats` | ✓ | ステータス情報（詳細は下記） |
| `equipment` | `EquipmentSlot[]` | ✓ | 装備スロット情報（詳細は下記） |

#### GoblinStats 型

```typescript
{
  hp: number,    // HP（最大体力）
  atk: number,   // 攻撃力
  sp: number,    // SP（スペシャルポイント/魔力）
  spd: number,   // 素早さ
  def: number    // 防御力
}
```

#### EquipmentSlot 型

```typescript
{
  slotIndex: number,      // スロット番号（0～4）
  itemId: string | null   // 装備しているアイテムのID（未装備の場合はnull）
}
```

#### デフォルトデータ

初回アクセス時に以下の5体のデフォルトゴブリンが自動的に作成されます：

- グラッシュ (ID: 0, Lv15)
- ズィーク (ID: 1, Lv12)
- シャープ (ID: 2, Lv13)
- ガード (ID: 3, Lv11)
- スピード (ID: 4, Lv14)

#### 実装ファイル

- インターフェース: `src/core/repositories/IGoblinRepository.ts`
- Firestore実装: `src/infrastructure/repositories/FirestoreGoblinRepositoryImpl.ts`

#### クエリ例

```typescript
// すべてのゴブリンをIDでソートして取得
const q = query(
  collection(db, 'users', userId, 'goblins'),
  orderBy('id')
)
```

---

### pendingGoblins コレクション

**パス**: `users/{userId}/pendingGoblins/{goblinId}`

拠点に追加される前の、保留中のゴブリンデータを管理します。時間経過により自動生成されたゴブリンが一時的に保存されます。

#### ドキュメントID

- **形式**: `number` を `toString()` で変換した文字列
- **例**: `"100"`, `"101"`, `"102"`

#### フィールド定義

`goblins` コレクションと同じ構造です：

| フィールド名 | 型 | 必須 | 説明 |
|-------------|-----|-----|------|
| `id` | `number` | ✓ | ゴブリンの一意ID |
| `name` | `string` | ✓ | ゴブリンの名前（100種類の候補からランダム選択） |
| `race` | `string` | ✓ | 種族名（例: "ゴブリン"） |
| `level` | `number` | ✓ | レベル（初期値: 1） |
| `avatar` | `string` | ✓ | アバター画像のパス |
| `stats` | `GoblinStats` | ✓ | ステータス情報（ランダム生成） |
| `equipment` | `EquipmentSlot[]` | ✓ | 装備スロット情報（初期値: すべて未装備） |

#### 動作フロー

1. **自動生成**: 拠点管理システムが10秒ごと（デバッグモード）に時間経過をチェック
2. **保存**: 新しいゴブリンが生成されると、このコレクションに保存される
3. **上限管理**: 保留リストは拠点ランク × 5体まで保持（例: ランク1 = 最大5体）
4. **拠点への追加**: ユーザーが選択したゴブリンは `goblins` コレクションに移動
5. **削除**: 拠点に追加されたゴブリンは、このコレクションから削除される

#### 実装ファイル

- インターフェース: `src/core/repositories/IPendingGoblinRepository.ts`
- Firestore実装: `src/infrastructure/repositories/FirestorePendingGoblinRepositoryImpl.ts`

#### クエリ例

```typescript
// すべての保留中ゴブリンをIDでソートして取得
const q = query(
  collection(db, 'users', userId, 'pendingGoblins'),
  orderBy('id')
)
```

---

### parties コレクション

**パス**: `users/{userId}/parties/{partyId}`

パーティ編成情報を管理します。

#### ドキュメントID

- **形式**: `number` を `toString()` で変換した文字列
- **例**: `"1"`, `"2"`, `"3"`

#### フィールド定義

| フィールド名 | 型 | 必須 | 説明 |
|-------------|-----|-----|------|
| `id` | `number` | ✓ | パーティの一意ID |
| `name` | `string` | ✓ | パーティ名 |
| `memberIds` | `number[]` | ✓ | パーティメンバーのゴブリンIDリスト |
| `status` | `PartyStatus` | - | パーティのステータス（"idle" or "expedition"） |
| `dungeonId` | `string` | - | 最後に選択されたダンジョンID |
| `targetFloor` | `number \| null` | - | 目標階層（null = 最後まで進む） |
| `returnPolicy` | `ExpeditionRequest["returnPolicy"]` | - | 帰還ポリシー（詳細は下記） |

#### PartyStatus 型

```typescript
type PartyStatus = "idle" | "expedition"
```

- `idle`: 待機中
- `expedition`: 遠征中

#### returnPolicy 型

```typescript
type ReturnPolicy =
  | "until_floor2"    // 2階で帰還
  | "until_floor3"    // 3階で帰還
  | "if_any_ko"       // 誰か1人でも倒れたら帰還
  | "if_two_ko"       // 2人倒れたら帰還
  | "last_one"        // 最後の1人になったら帰還
  | "never"           // 最後まで探索
```

#### デフォルトデータ

初回アクセス時に以下の3つのデフォルトパーティが自動的に作成されます：

- PT1 (ID: 1)
- PT2 (ID: 2)
- PT3 (ID: 3)

すべて初期状態では `memberIds` は空配列、`status` は `"idle"` です。

#### 実装ファイル

- インターフェース: `src/core/repositories/IPartyRepository.ts`
- Firestore実装: `src/infrastructure/repositories/FirestorePartyRepositoryImpl.ts`

#### クエリ例

```typescript
// すべてのパーティをIDでソートして取得
const q = query(
  collection(db, 'users', userId, 'parties'),
  orderBy('id')
)
```

---

### items コレクション

**パス**: `users/{userId}/items/{itemId}`

アイテムデータを管理します。

#### ドキュメントID

- **形式**: `string` （アイテムの一意ID）
- **例**: `"wooden_stick"`, `"iron_sword"`

#### フィールド定義

| フィールド名 | 型 | 必須 | 説明 |
|-------------|-----|-----|------|
| `id` | `string` | ✓ | アイテムの一意ID |
| `name` | `string` | ✓ | アイテム名 |
| `description` | `string` | ✓ | アイテムの説明 |
| `effect` | `ItemEffect` | ✓ | アイテムの効果（詳細は下記） |
| `icon` | `string` | - | アイコン画像のパス |

#### ItemEffect 型

```typescript
{
  hp?: number,    // HP増加量
  atk?: number,   // 攻撃力増加量
  sp?: number,    // SP増加量
  spd?: number,   // 素早さ増加量
  def?: number    // 防御力増加量
}
```

すべてのフィールドはオプションで、装備時に対応するステータスが増加します。

#### デフォルトデータ

初回アクセス時に以下のデフォルトアイテムが自動的に作成されます：

- 木の棒 (ID: "wooden_stick", 攻撃力+2)

#### 実装ファイル

- インターフェース: `src/core/repositories/IItemRepository.ts`
- Firestore実装: `src/infrastructure/repositories/FirestoreItemRepositoryImpl.ts`

#### クエリ例

```typescript
// すべてのアイテムをIDでソートして取得
const q = query(
  collection(db, 'users', userId, 'items'),
  orderBy('id')
)
```

---

### expeditions コレクション

**パス**: `users/{userId}/expeditions/{expeditionId}`

遠征の記録データを管理します。

#### ドキュメントID

- **形式**: `"exp_" + timestamp + "_" + random_string`
- **例**: `"exp_1699123456789_abc123def"`
- **生成方法**: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

#### フィールド定義

| フィールド名 | 型 | 必須 | 説明 |
|-------------|-----|-----|------|
| `id` | `string` | ✓ | 遠征の一意ID |
| `userId` | `string` | ✓ | ユーザーID |
| `partyId` | `number` | ✓ | パーティID |
| `partyName` | `string` | ✓ | パーティ名 |
| `dungeonId` | `string` | ✓ | ダンジョンID |
| `dungeonName` | `string` | ✓ | ダンジョン名 |
| `startTime` | `Timestamp` | ✓ | 遠征開始時刻（TypeScriptでは`Date`） |
| `returnTime` | `Timestamp` | ✓ | 帰還予定時刻（TypeScriptでは`Date`） |
| `status` | `ExpeditionStatus` | ✓ | 遠征のステータス（詳細は下記） |
| `returnPolicy` | `ExpeditionRequest["returnPolicy"]` | ✓ | 帰還ポリシー |
| `replay` | `ExpeditionReplay` | - | 遠征のリプレイデータ（詳細は下記） |
| `createdAt` | `Timestamp` | ✓ | 作成日時（TypeScriptでは`Date`） |
| `updatedAt` | `Timestamp` | ✓ | 更新日時（TypeScriptでは`Date`） |

#### ExpeditionStatus 型

```typescript
type ExpeditionStatus = "ongoing" | "completed" | "failed"
```

- `ongoing`: 遠征中
- `completed`: 完了
- `failed`: 失敗

#### ExpeditionReplay 型

遠征のリプレイデータは、遠征が完了した後に追加されます。

```typescript
{
  meta: {
    expeditionId: string,
    areaId: string,
    areaName: string,
    floors: number,
    baseDurationSec: number,
    party: string[],
    returnPolicy: string,
    seed: number,
    serverCommitHash?: string
  },
  durationSec: number,
  events: TimelineEvent[],    // イベントのタイムライン
  summary: RewardSummary       // 報酬サマリー
}
```

##### TimelineEvent 型

遠征中のイベントを時系列で記録します：

```typescript
type TimelineEvent =
  | { type: "move_start"; at: number; floor: number }
  | { type: "floor_up"; at: number; from: number; to: number }
  | { type: "battle"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number; drops: Drop[] }
  | { type: "boss"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number; drops: Drop[] }
  | { type: "resource"; at: number; floor: number; loot: Drop[] }
  | { type: "exploring"; at: number; floor: number }
  | { type: "return"; at: number; reason: ExpeditionEndReason }
```

##### RewardSummary 型

```typescript
{
  success: boolean,              // 成功フラグ
  maxFloorReached: number,       // 到達した最大階層
  xpGained: number,              // 獲得経験値
  goldGained: number,            // 獲得ゴールド
  loot: Drop[],                  // 獲得したアイテム
  captures: Drop[],              // 捕獲したモンスター
  casualties: string[],          // 死亡したメンバー
  injuries: string[]             // 負傷したメンバー
}
```

#### Timestamp型の扱い

- **Firestore保存時**: `Date`オブジェクトは自動的に`Timestamp`型に変換されます
- **Firestore取得時**: `Timestamp`型は`.toDate()`メソッドで`Date`オブジェクトに変換されます

```typescript
// 保存時
await setDoc(docRef, {
  ...record,
  startTime: Timestamp.fromDate(record.startTime),
  returnTime: Timestamp.fromDate(record.returnTime),
  createdAt: Timestamp.fromDate(record.createdAt),
  updatedAt: Timestamp.fromDate(record.updatedAt)
})

// 取得時
const data = docSnap.data()
return {
  ...data,
  startTime: data.startTime.toDate(),
  returnTime: data.returnTime.toDate(),
  createdAt: data.createdAt.toDate(),
  updatedAt: data.updatedAt.toDate()
} as ExpeditionRecord
```

#### 実装ファイル

- Firestore実装: `src/infrastructure/repositories/FirestoreExpeditionRepositoryImpl.ts`

#### クエリ例

```typescript
// すべての遠征を開始時刻の降順で取得
const q = query(
  collection(db, 'users', userId, 'expeditions'),
  orderBy('startTime', 'desc')
)

// 特定のパーティの遠征を取得
const q = query(
  collection(db, 'users', userId, 'expeditions'),
  where('partyId', '==', partyId),
  orderBy('startTime', 'desc')
)

// 進行中の遠征のみを取得（アプリケーション側でフィルタ）
const q = query(
  collection(db, 'users', userId, 'expeditions'),
  orderBy('startTime', 'desc')
)
// returnTime > now のものをフィルタ
```

---

## セキュリティとアクセス制御

すべてのコレクションは `users/{userId}` 配下にあるため、Firestoreセキュリティルールで以下のように制御されています：

### セキュリティルールファイル

**ファイル**: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ユーザーが認証されているかをチェックするヘルパー関数
    function isAuthenticated() {
      return request.auth != null;
    }

    // リクエストしているユーザーが指定されたuserIdと一致するかをチェック
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // users コレクション配下のすべてのドキュメントとサブコレクション
    match /users/{userId}/{document=**} {
      // 認証されたユーザーが自分のデータのみ読み書き可能
      allow read, write: if isOwner(userId);
    }

    // その他のドキュメントへのアクセスは全て拒否
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### セキュリティルールの説明

- **認証チェック**: `isAuthenticated()` 関数でユーザーがログイン済みかを確認
- **所有者チェック**: `isOwner(userId)` 関数で、リクエストユーザーIDとパスのuserIdが一致するかを確認
- **アクセス制御**: 認証されたユーザーは自分の `users/{userId}` 配下のデータのみ読み書き可能
- **デフォルト拒否**: その他のパスへのアクセスは全て拒否

### デプロイ

セキュリティルールをFirebaseにデプロイするには：

```bash
# Firebase CLIをインストール（未インストールの場合）
npm install -g firebase-tools

# Firebaseにログイン
firebase login

# プロジェクトを初期化（初回のみ）
firebase init firestore

# セキュリティルールをデプロイ
firebase deploy --only firestore:rules
```

---

## リポジトリパターンの実装

このプロジェクトでは**リポジトリパターン**を採用しており、データアクセス層が抽象化されています：

### 実装ファイルの構成

```
src/
├── core/
│   └── repositories/          # リポジトリインターフェース
│       ├── IGoblinRepository.ts
│       ├── IPartyRepository.ts
│       ├── IItemRepository.ts
│       └── index.ts
└── infrastructure/
    └── repositories/          # リポジトリ実装
        ├── FirestoreGoblinRepositoryImpl.ts
        ├── FirestorePartyRepositoryImpl.ts
        ├── FirestoreItemRepositoryImpl.ts
        ├── FirestoreExpeditionRepositoryImpl.ts
        ├── JsonGoblinRepositoryImpl.ts    # 開発用
        └── JsonPartyRepositoryImpl.ts     # 開発用
```

### アダプターパターン

Firestoreは非同期APIですが、UIコンポーネントでは同期的なインターフェースを使用するため、各リポジトリには**アダプター**が実装されています：

- `FirestoreGoblinRepositoryAdapter`: キャッシュ機能を持つ同期版インターフェース
- `FirestorePartyRepositoryAdapter`: キャッシュ機能を持つ同期版インターフェース
- `FirestoreItemRepositoryAdapter`: キャッシュ機能を持つ同期版インターフェース
- `FirestoreExpeditionRepositoryAdapter`: キャッシュ機能を持つ遠征データ管理

アダプターは初回アクセス時にデータを非同期で取得してキャッシュし、以降は同期的にデータを返します。

---

## 型定義ファイル

主要な型定義は `src/shared/types/` ディレクトリに配置されています：

- `Goblin.ts`: ゴブリン関連の型
- `Party.ts`: パーティ関連の型
- `Item.ts`: アイテム関連の型
- `Expedition.ts`: 遠征関連の型
- `Enemy.ts`: 敵関連の型
- `Battle.ts`: 戦闘関連の型
- `Dungeon.ts`: ダンジョン関連の型

これらの型定義は、Firestoreのドキュメント構造と厳密に対応しており、型安全性を保証しています。

---

## 参考資料

- アーキテクチャドキュメント: `docs/architecture.md`
- Firebase設定: `src/config/firebase.ts`
- Firestoreセキュリティルール: `firestore.rules`
- Firebase設定ファイル: `firebase.json`
- 型定義: `src/shared/types/index.ts`
