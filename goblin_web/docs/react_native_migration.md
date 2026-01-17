# React Native 移行ガイド

このドキュメントは、goblin_webプロジェクトをReact Nativeに移行するために必要な情報を整理したものです。

## 目次

1. [現在のプロジェクト構成](#現在のプロジェクト構成)
2. [画面構成詳細](#画面構成詳細)
3. [コアロジック詳細](#コアロジック詳細)
4. [移行対象と非移行対象](#移行対象と非移行対象)
5. [React Native対応方針](#react-native対応方針)
6. [データ永続化の移行](#データ永続化の移行)
7. [スタイリングの移行](#スタイリングの移行)
8. [移行手順](#移行手順)

---

## 現在のプロジェクト構成

### 技術スタック

| 項目 | 現在 | React Native移行後 |
|------|------|-------------------|
| フレームワーク | React 19.1.1 | React Native + Expo |
| スタイリング | Tailwind CSS 3.4.17 | NativeWind または StyleSheet |
| バンドラー | Vite 7.1.7 | Metro (Expo) |
| データベース | Firebase Firestore | Firebase Firestore (RN対応SDK) |
| 認証 | Firebase Authentication | Firebase Authentication (RN対応SDK) |
| テスト | Vitest | Jest |

### ディレクトリ構成

```
goblin_web/src/
├── core/                    # 【完全移植可】プラットフォーム非依存
│   ├── domain/              # ドメインエンティティ
│   ├── usecases/            # ユースケース
│   ├── services/            # ゲームシステム
│   └── repositories/        # Repositoryインターフェース
├── infrastructure/          # 【部分移植】Repository実装
│   └── repositories/        # Firestore/JSON実装
├── presentation/            # 【再実装】UI層
│   ├── components/          # 画面コンポーネント
│   ├── contexts/            # React Context
│   └── hooks/               # カスタムフック
├── shared/                  # 【完全移植可】共通データ・型定義
│   ├── types/               # 型定義
│   ├── constants/           # 定数
│   └── data/                # JSONデータ
└── config/                  # 【再実装】環境設定
```

---

## 画面構成詳細

### ナビゲーション構造

```
App
├── AuthProvider (認証状態管理)
└── ExpeditionStateProvider (遠征状態管理)
    └── AppContent
        ├── TabMenu (タブナビゲーション)
        ├── GoblinListScreen (リストタブ)
        ├── FormationTabScreen (編成タブ)
        └── BaseManagementScreen (拠点タブ)
```

### タブ構成

| タブ名 | コンポーネント | 機能 |
|--------|---------------|------|
| リスト | GoblinListScreen | ゴブリン一覧表示・詳細モーダル |
| 編成 | FormationTabScreen | パーティ編成・遠征管理 |
| 拠点 | BaseManagementScreen | 拠点管理・新規ゴブリン受け入れ |

### 画面コンポーネント一覧

#### ゴブリン関連 (約300行)
| ファイル | 行数 | 機能 |
|----------|------|------|
| GoblinListScreen.tsx | 56 | ゴブリン一覧表示 |
| GoblinCard.tsx | 28 | ゴブリンカード表示 |
| GoblinDetailModal.tsx | ~200 | ゴブリン詳細・装備管理 |
| FactorBadge.tsx | ~50 | 因子バッジ表示 |

#### 編成・遠征関連 (約1,500行)
| ファイル | 行数 | 機能 |
|----------|------|------|
| FormationTabScreen.tsx | 383 | 編成タブメイン（ビューモード管理） |
| FormationScreen.tsx | ~200 | パーティ一覧・履歴表示 |
| PartyEditScreen.tsx | ~150 | パーティメンバー編集 |
| ExpeditionPreparationScreen.tsx | ~200 | 遠征準備画面 |
| ExpeditionPlaybackScreen.tsx | 417 | 遠征リアルタイム再生 |
| ExpeditionResultScreen.tsx | ~200 | 遠征結果表示 |
| ExpeditionLogScreen.tsx | ~150 | 遠征ログ詳細 |

#### モーダル類 (約500行)
| ファイル | 行数 | 機能 |
|----------|------|------|
| DungeonSelectionModal.tsx | ~100 | ダンジョン選択 |
| DungeonConfirmModal.tsx | ~80 | ダンジョン確認 |
| FloorTargetSelectionModal.tsx | ~100 | 目標階層選択 |
| ReturnPolicySelectionModal.tsx | ~100 | 帰還ポリシー選択 |
| ExpeditionConfirmModal.tsx | ~80 | 遠征確認 |

#### 拠点関連 (約300行)
| ファイル | 行数 | 機能 |
|----------|------|------|
| BaseManagementScreen.tsx | 301 | 拠点管理・ゴブリン受け入れ |

#### 共通コンポーネント
| ファイル | 行数 | 機能 |
|----------|------|------|
| TabMenu.tsx | 46 | タブナビゲーション |

### 画面遷移図

```
FormationTabScreen (ViewMode管理)
├── list → FormationScreen (パーティ一覧)
│   ├── onPartySelect → preparation
│   ├── onHistoryClick → result
│   └── onLogClick → log
├── preparation → ExpeditionPreparationScreen (遠征準備)
│   ├── onEditParty → edit
│   ├── onStartExpedition → (遠征開始 → list)
│   └── onBack → list
├── edit → PartyEditScreen (パーティ編集)
│   └── onBack → preparation
├── result → ExpeditionResultScreen (結果表示)
│   └── onBack → list
└── log → ExpeditionLogScreen (ログ詳細)
    └── onBack → list
```

---

## コアロジック詳細

### サービス層 (core/services/)

#### ExpeditionEngine.ts (479行)
**機能**: 遠征シミュレーション全体の制御

```typescript
class ExpeditionEngine {
  constructor(seed?: number, battleSystem?: BattleSystem)

  // シード値ベースの決定論的乱数生成
  private createSeededRandom(seed: number): () => number

  // 遠征シミュレーション実行
  async generateExpedition(request: ExpeditionRequest, party: Goblin[]): Promise<ExpeditionReplay>

  // フロアイベント生成
  private generateFloorEvents(area: AreaConfig, floor: number, totalDuration: number): number[]

  // 戦闘実行
  private resolveCombat(partyState: PartyState[], enemies: Enemy[], area: AreaConfig, isBoss?: boolean): CombatReplay

  // 帰還条件チェック
  private checkReturnConditions(partyState: PartyState[], returnPolicy: string, currentFloor: number): { shouldReturn: boolean; reason: string }
}
```

**移行ポイント**:
- `import.meta.env` → React Native環境変数
- 動的JSONインポート → require() または fetch

#### BattleSystem.ts (229行)
**機能**: ターン制戦闘ロジック

```typescript
class BattleSystem {
  executeBattle(
    allies: Goblin[],
    initialAllyHP: number[],
    enemies: Enemy[],
    rng: () => number,
    maxTurns?: number
  ): BattleResult

  private createAllyUnit(goblin: Goblin, initialHP: number, originalIndex: number): BattleUnit
  private createEnemyUnit(enemy: Enemy, originalIndex: number): BattleUnit
  private createBattleResult(...): BattleResult
}
```

**移行ポイント**: なし（純粋TypeScript）

#### DamageCalculator.ts (159行)
**機能**: ダメージ計算

```typescript
class DamageCalculator {
  calcDamage(
    races: RaceDict,
    attacker: Combatant,
    defender: Combatant,
    skill: Skill,
    opt?: DamageOptions,
    rng?: () => number
  ): number
}
```

**移行ポイント**: なし（純粋TypeScript）

#### GoblinBirthService.ts (169行)
**機能**: ゴブリン生成ロジック

```typescript
class GoblinBirthService {
  createNewGoblin(nextGoblinId: number, individualValue?: number, baseGoblins?: Goblin[]): Goblin
  private generateStats(): GoblinStats
  private selectRandomName(): string
}
```

**移行ポイント**: なし（純粋TypeScript）

#### ExperienceSystem.ts (141行)
**機能**: 経験値・レベルシステム

```typescript
function getExpForNextLevel(currentLevel: number): number
function addExperience(currentLevel: number, currentExp: number, expToAdd: number): LevelUpResult
function getExpProgress(currentLevel: number, currentExp: number): number
```

**移行ポイント**: なし（純粋TypeScript）

#### ModStatCalculator.ts
**機能**: Mod/因子によるステータス計算

**移行ポイント**: なし（純粋TypeScript）

#### FactorService.ts / FactorInheritanceService.ts
**機能**: 因子の獲得・継承ロジック

**移行ポイント**: なし（純粋TypeScript）

### UseCase層 (core/usecases/)

| UseCase | 機能 |
|---------|------|
| StartExpeditionUseCase | 遠征開始（パーティ検証→シミュレーション実行） |
| CompleteExpeditionUseCase | 遠征完了（経験値付与→因子獲得） |
| ExecuteBattleUseCase | 戦闘実行 |
| ManagePartyUseCase | パーティ管理（メンバー追加/削除/ステータス変更） |
| ConfigurePartyUseCase | パーティ設定（ダンジョン/目標階層/帰還ポリシー） |
| GetGoblinListUseCase | ゴブリン一覧取得 |
| GetGoblinByIdUseCase | ゴブリン個別取得 |
| CreatePartyUseCase | パーティ作成 |
| UpdatePartyMembersUseCase | パーティメンバー更新 |
| GetPartyListUseCase | パーティ一覧取得 |
| GetPartyByIdUseCase | パーティ個別取得 |

**移行ポイント**: すべて純粋TypeScriptで移行可能

### ドメイン層 (core/domain/)

| Entity | 機能 |
|--------|------|
| GoblinEntity.ts | ゴブリンの振る舞い（装備、経験値獲得、戦闘力計算） |
| PartyEntity.ts | パーティの振る舞い（遠征可否判定など） |
| EnemyEntity.ts | 敵の振る舞い |

**移行ポイント**: すべて純粋TypeScriptで移行可能

### Repository層

#### インターフェース (core/repositories/)

```typescript
interface IGoblinRepository {
  getGoblins(): Goblin[]
  getGoblin(id: number): Goblin | null
  saveGoblin(goblin: Goblin): void
  deleteGoblin(id: number): void
  updateGoblinStats(id: number, stats: GoblinStats): void
  updateGoblinLevel(id: number, level: number): void
}

interface IPartyRepository {
  getParties(): Party[]
  getParty(id: number): Party | null
  saveParty(party: Party): void
  deleteParty(id: number): void
  updatePartyStatus(id: number, status: PartyStatus): void
  getPartiesByStatus(status: PartyStatus): Party[]
  updateDungeonSettings(id: number, dungeonId: string): void
  updateFloorTarget(id: number, targetFloor: number | null): void
  updateReturnPolicy(id: number, returnPolicy: string): void
}

interface IPendingGoblinRepository { ... }
interface IBaseStateRepository { ... }
```

**移行ポイント**: インターフェースはそのまま移行可能

---

## 移行対象と非移行対象

### 完全移植可能（そのまま使用）

| カテゴリ | パス | 備考 |
|----------|------|------|
| 型定義 | shared/types/*.ts | すべての型定義 |
| ドメイン | core/domain/*.ts | エンティティクラス |
| ユースケース | core/usecases/*.ts | ビジネスロジック |
| サービス | core/services/*.ts | ゲームシステム（一部修正あり） |
| リポジトリIF | core/repositories/*.ts | インターフェース |
| 定数 | shared/constants/*.ts | 色定義など |
| データ | shared/data/*.ts, *.json | ゲームデータ |

### 部分的な修正が必要

| カテゴリ | 修正内容 |
|----------|----------|
| ExpeditionEngine.ts | `import.meta.env` → Config から取得、動的import → require() |
| infrastructure/repositories/ | Firestore SDK → @react-native-firebase/firestore |
| presentation/hooks/*.ts | useCallback/useMemo はそのまま使用可能 |

### 再実装が必要

| カテゴリ | 理由 |
|----------|------|
| presentation/components/*.tsx | React Native UIコンポーネントとして再実装 |
| presentation/contexts/*.tsx | React Native Contextとして再実装 |
| スタイリング | Tailwind → NativeWind または StyleSheet |
| ナビゲーション | TabMenu → @react-navigation |
| Firebase設定 | config/firebase.ts → @react-native-firebase |

---

## React Native対応方針

### ナビゲーション

現在のタブナビゲーションを `@react-navigation` で再実装:

```typescript
// 推奨構成
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// タブナビゲーション
<Tab.Navigator>
  <Tab.Screen name="List" component={GoblinListStack} />
  <Tab.Screen name="Formation" component={FormationStack} />
  <Tab.Screen name="Base" component={BaseManagementScreen} />
</Tab.Navigator>

// 編成タブ内のスタック
<Stack.Navigator>
  <Stack.Screen name="FormationList" component={FormationScreen} />
  <Stack.Screen name="ExpeditionPreparation" component={ExpeditionPreparationScreen} />
  <Stack.Screen name="PartyEdit" component={PartyEditScreen} />
  <Stack.Screen name="ExpeditionPlayback" component={ExpeditionPlaybackScreen} />
  <Stack.Screen name="ExpeditionResult" component={ExpeditionResultScreen} />
  <Stack.Screen name="ExpeditionLog" component={ExpeditionLogScreen} />
</Stack.Navigator>
```

### モーダル処理

現在の条件付きレンダリングによるモーダルを、React Navigation のモーダルまたは `react-native-modal` で再実装:

```typescript
// 現在
{selectedGoblin && <GoblinDetailModal ... />}

// React Native
<Modal visible={!!selectedGoblin} animationType="slide">
  <GoblinDetailView ... />
</Modal>
```

### アニメーション

ExpeditionPlaybackScreen のアニメーションを React Native Animated または Reanimated で再実装:

```typescript
// 現在: requestAnimationFrame
animationFrameRef.current = requestAnimationFrame(animate)

// React Native: Animated API または useAnimatedReaction (Reanimated)
import { useSharedValue, useAnimatedReaction, withTiming } from 'react-native-reanimated'
```

---

## データ永続化の移行

### Firebase SDK の変更

```typescript
// 現在 (Web)
import { db, auth } from '../../config/firebase'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'

// React Native
import firestore from '@react-native-firebase/firestore'
import auth from '@react-native-firebase/auth'

// Collection参照
const goblinsRef = firestore()
  .collection('users')
  .doc(userId)
  .collection('goblins')

// ドキュメント取得
const snapshot = await goblinsRef.get()
```

### Repository実装の変更例

```typescript
// React Native版 FirestoreGoblinRepositoryImpl
import firestore from '@react-native-firebase/firestore'
import auth from '@react-native-firebase/auth'

export class RNFirestoreGoblinRepositoryImpl implements IGoblinRepository {
  private getUserId(): string {
    const user = auth().currentUser
    if (!user) throw new Error('ユーザーが認証されていません')
    return user.uid
  }

  private getGoblinsRef() {
    return firestore()
      .collection('users')
      .doc(this.getUserId())
      .collection('goblins')
  }

  async getGoblins(): Promise<Goblin[]> {
    const snapshot = await this.getGoblinsRef().orderBy('id').get()
    return snapshot.docs.map(doc => doc.data() as Goblin)
  }

  // ... 他のメソッド
}
```

---

## スタイリングの移行

### オプション1: NativeWind (推奨)

Tailwind CSSをReact Nativeで使用可能にするライブラリ:

```bash
npm install nativewind
npm install --dev tailwindcss
```

```typescript
// 現在
<div className="bg-white border-2 border-gray-200 rounded-lg p-3">

// NativeWind
<View className="bg-white border-2 border-gray-200 rounded-lg p-3">
```

### オプション2: StyleSheet

従来のReact Native StyleSheet:

```typescript
// 現在
<div className="bg-white border-2 border-gray-200 rounded-lg p-3 flex items-center gap-3">

// StyleSheet
<View style={styles.card}>
  ...
</View>

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
})
```

### スタイル変換対応表

| Tailwind | React Native StyleSheet |
|----------|------------------------|
| flex-1 | { flex: 1 } |
| flex-col | { flexDirection: 'column' } |
| items-center | { alignItems: 'center' } |
| justify-between | { justifyContent: 'space-between' } |
| gap-3 | { gap: 12 } |
| p-3 | { padding: 12 } |
| mt-2 | { marginTop: 8 } |
| rounded-lg | { borderRadius: 8 } |
| text-sm | { fontSize: 14 } |
| font-bold | { fontWeight: 'bold' } |
| text-gray-800 | { color: '#1F2937' } |
| bg-white | { backgroundColor: 'white' } |
| border-2 | { borderWidth: 2 } |
| border-gray-200 | { borderColor: '#E5E7EB' } |
| shadow-sm | (react-native-shadow-2 等を使用) |
| overflow-y-auto | (ScrollView を使用) |

---

## 移行手順

### Phase 1: プロジェクトセットアップ

1. Expo プロジェクト作成
   ```bash
   npx create-expo-app goblin-native --template blank-typescript
   ```

2. 必要なパッケージインストール
   ```bash
   npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
   npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
   npm install nativewind
   npm install react-native-reanimated react-native-gesture-handler
   ```

### Phase 2: コアロジック移植 (約1-2日)

1. `core/` ディレクトリをそのままコピー
2. `shared/types/` をコピー
3. `shared/data/` をコピー
4. `shared/constants/` をコピー

5. `ExpeditionEngine.ts` の修正:
   ```typescript
   // 環境変数の読み込み方法を変更
   const isDebug = __DEV__  // または Config.DEBUG

   // 動的インポートの修正
   const areaData = require(`../shared/data/expeditionArea/${areaId}.json`)
   const enemyData = require(`../shared/data/enemy/${areaId}.json`)
   ```

### Phase 3: Repository実装 (約1日)

1. `infrastructure/repositories/` のFirestore実装をRN版に書き換え
2. `@react-native-firebase/firestore` を使用

### Phase 4: Context/Hooks移植 (約1日)

1. `AuthContext` を `@react-native-firebase/auth` で再実装
2. `ExpeditionStateContext` をそのまま移植
3. カスタムHooksはほぼそのまま使用可能

### Phase 5: 画面コンポーネント再実装 (約5-7日)

優先度順:

1. **ナビゲーション構築** (1日)
   - TabNavigator
   - StackNavigator

2. **基本画面** (2日)
   - GoblinListScreen
   - GoblinCard
   - TabMenu

3. **編成画面** (2日)
   - FormationScreen
   - PartyEditScreen
   - ExpeditionPreparationScreen

4. **遠征画面** (2日)
   - ExpeditionPlaybackScreen (アニメーション実装が複雑)
   - ExpeditionResultScreen
   - ExpeditionLogScreen

5. **拠点画面** (1日)
   - BaseManagementScreen

### Phase 6: テスト・調整 (約2-3日)

1. 各画面の動作確認
2. アニメーションの調整
3. パフォーマンス最適化

---

## 注意点

### アセット管理

```typescript
// 現在
<img src="/src/assets/goblin/goblin.png" />

// React Native
<Image source={require('../assets/goblin/goblin.png')} />
// または
<Image source={{ uri: 'https://...' }} />
```

### 環境変数

```typescript
// 現在
import.meta.env.VITE_USE_FIRESTORE

// React Native (react-native-config)
import Config from 'react-native-config'
Config.USE_FIRESTORE

// または __DEV__ フラグ
__DEV__ ? 'development' : 'production'
```

### 日付処理

FirestoreのTimestampからDateへの変換に注意:

```typescript
// Firestoreから取得したデータ
const data = doc.data()
const date = data.startTime.toDate() // Timestamp → Date
```

---

## 推定工数

| フェーズ | 作業内容 | 推定 |
|----------|----------|------|
| Phase 1 | プロジェクトセットアップ | 0.5日 |
| Phase 2 | コアロジック移植 | 1-2日 |
| Phase 3 | Repository実装 | 1日 |
| Phase 4 | Context/Hooks移植 | 1日 |
| Phase 5 | 画面コンポーネント再実装 | 5-7日 |
| Phase 6 | テスト・調整 | 2-3日 |
| **合計** | | **10-15日** |

---

## 関連ドキュメント

- [architecture.md](./architecture.md): アーキテクチャ設計
- [current_implementation.md](./current_implementation.md): 現在の実装状況
- [firestore_collections.md](./firestore_collections.md): Firestoreデータ構造
