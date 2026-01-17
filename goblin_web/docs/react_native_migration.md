# React Native (Expo) 移行ガイド

このドキュメントは、goblin_webプロジェクトをReact Native (Expo) に移行するために必要な情報を整理したものです。

## 目次

1. [現在のプロジェクト構成](#現在のプロジェクト構成)
2. [画面構成詳細](#画面構成詳細)
3. [コアロジック詳細](#コアロジック詳細)
4. [移行対象と非移行対象](#移行対象と非移行対象)
5. [Expo対応方針](#expo対応方針)
6. [データ永続化の移行](#データ永続化の移行)
7. [スタイリングの移行](#スタイリングの移行)
8. [移行手順](#移行手順)

---

## 現在のプロジェクト構成

### 技術スタック

| 項目 | 現在 | Expo移行後 |
|------|------|-----------|
| フレームワーク | React 19.1.1 | Expo SDK 52+ |
| ルーティング | 状態管理ベース | Expo Router |
| スタイリング | Tailwind CSS 3.4.17 | StyleSheet |
| バンドラー | Vite 7.1.7 | Metro (Expo) |
| データベース | Firebase Firestore | Firebase Firestore (JS SDK) |
| 認証 | Firebase Authentication | Firebase Authentication (JS SDK) |
| ストレージ | localStorage | AsyncStorage |
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
- `import.meta.env` → `process.env.EXPO_PUBLIC_*`
- 動的JSONインポート → require() または静的インポート

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
| ExpeditionEngine.ts | `import.meta.env` → `process.env.EXPO_PUBLIC_*` |
| infrastructure/repositories/ | localStorage → AsyncStorage |
| presentation/hooks/*.ts | useCallback/useMemo はそのまま使用可能 |

### 再実装が必要

| カテゴリ | 理由 |
|----------|------|
| presentation/components/*.tsx | React Native UIコンポーネントとして再実装 |
| presentation/contexts/*.tsx | React Native Contextとして再実装 |
| スタイリング | Tailwind → StyleSheet |
| ナビゲーション | TabMenu → Expo Router |
| Firebase設定 | config/firebase.ts → Firebase JS SDK (Expo対応) |

---

## Expo対応方針

### Expo Router ナビゲーション

現在の状態管理ベースのナビゲーションを Expo Router で再実装:

#### ファイル構造

```
app/
├── _layout.tsx              # Root Layout (AuthProvider, ExpeditionStateProvider)
├── (tabs)/
│   ├── _layout.tsx          # Tab Layout (3タブ)
│   ├── index.tsx            # リストタブ (GoblinListScreen)
│   ├── formation/
│   │   ├── _layout.tsx      # Stack Layout
│   │   ├── index.tsx        # FormationScreen (パーティ一覧)
│   │   ├── preparation.tsx  # ExpeditionPreparationScreen
│   │   ├── edit.tsx         # PartyEditScreen
│   │   ├── playback.tsx     # ExpeditionPlaybackScreen
│   │   ├── result.tsx       # ExpeditionResultScreen
│   │   └── log.tsx          # ExpeditionLogScreen
│   └── base.tsx             # 拠点タブ (BaseManagementScreen)
└── +not-found.tsx
```

#### Root Layout

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router'
import { AuthProvider } from '@/presentation/contexts/AuthContext'
import { ExpeditionStateProvider } from '@/presentation/contexts/ExpeditionStateContext'

export default function RootLayout() {
  return (
    <AuthProvider>
      <ExpeditionStateProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ExpeditionStateProvider>
    </AuthProvider>
  )
}
```

#### Tab Layout

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: 'リスト', tabBarIcon: ({ color }) => <ListIcon color={color} /> }}
      />
      <Tabs.Screen
        name="formation"
        options={{ title: '編成', tabBarIcon: ({ color }) => <FormationIcon color={color} /> }}
      />
      <Tabs.Screen
        name="base"
        options={{ title: '拠点', tabBarIcon: ({ color }) => <BaseIcon color={color} /> }}
      />
    </Tabs>
  )
}
```

#### Formation Stack Layout

```typescript
// app/(tabs)/formation/_layout.tsx
import { Stack } from 'expo-router'

export default function FormationLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '編成' }} />
      <Stack.Screen name="preparation" options={{ title: '遠征準備' }} />
      <Stack.Screen name="edit" options={{ title: 'パーティ編集' }} />
      <Stack.Screen name="playback" options={{ title: '遠征中' }} />
      <Stack.Screen name="result" options={{ title: '遠征結果' }} />
      <Stack.Screen name="log" options={{ title: '遠征ログ' }} />
    </Stack>
  )
}
```

#### 画面遷移例

```typescript
import { router, useLocalSearchParams } from 'expo-router'

// 遷移
router.push('/formation/preparation')
router.back()

// パラメータ付き遷移
router.push({
  pathname: '/formation/result',
  params: { partyId: '123' }
})

// パラメータ取得
const { partyId } = useLocalSearchParams<{ partyId: string }>()
```

### モーダル処理

現在の条件付きレンダリングによるモーダルを、React Native の Modal で再実装:

```typescript
// 現在
{selectedGoblin && <GoblinDetailModal ... />}

// React Native
import { Modal } from 'react-native'

<Modal
  visible={!!selectedGoblin}
  animationType="slide"
  presentationStyle="pageSheet"
>
  <GoblinDetailView ... />
</Modal>
```

### アニメーション

ExpeditionPlaybackScreen のアニメーションを React Native Animated または Reanimated で再実装:

```typescript
// 現在: requestAnimationFrame
animationFrameRef.current = requestAnimationFrame(animate)

// React Native: Animated API
import { Animated } from 'react-native'

const progress = useRef(new Animated.Value(0)).current

Animated.timing(progress, {
  toValue: 1,
  duration: totalDuration,
  useNativeDriver: true,
}).start()

// または Reanimated (より高性能)
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'

const progress = useSharedValue(0)
progress.value = withTiming(1, { duration: totalDuration })
```

---

## データ永続化の移行

### Firebase SDK の変更

Expo では Firebase JS SDK を使用します（`@react-native-firebase/*` ではなく）:

```typescript
// src/config/firebase.ts
import { initializeApp } from 'firebase/app'
import { initializeAuth, getReactNativePersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// Auth (AsyncStorage で永続化)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
})

// Firestore
export const db = getFirestore(app)
```

### 環境変数

```bash
# .env
EXPO_PUBLIC_FIREBASE_API_KEY=xxx
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
EXPO_PUBLIC_FIREBASE_APP_ID=xxx
```

### localStorage → AsyncStorage

```typescript
// 現在 (Web)
localStorage.getItem('goblins')
localStorage.setItem('goblins', JSON.stringify(data))

// Expo
import AsyncStorage from '@react-native-async-storage/async-storage'

// 取得 (非同期)
const data = await AsyncStorage.getItem('goblins')
const goblins = data ? JSON.parse(data) : []

// 保存 (非同期)
await AsyncStorage.setItem('goblins', JSON.stringify(data))
```

### Repository実装の変更例

```typescript
// Expo版 AsyncStorageGoblinRepositoryImpl
import AsyncStorage from '@react-native-async-storage/async-storage'
import { IGoblinRepository } from '@/core/repositories/IGoblinRepository'
import { Goblin } from '@/shared/types'

const STORAGE_KEY = 'goblins'

export class AsyncStorageGoblinRepositoryImpl implements IGoblinRepository {
  private goblins: Goblin[] = []
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    const data = await AsyncStorage.getItem(STORAGE_KEY)
    this.goblins = data ? JSON.parse(data) : []
    this.initialized = true
  }

  getGoblins(): Goblin[] {
    return [...this.goblins]
  }

  getGoblin(id: number): Goblin | null {
    return this.goblins.find(g => g.id === id) ?? null
  }

  async saveGoblin(goblin: Goblin): Promise<void> {
    const index = this.goblins.findIndex(g => g.id === goblin.id)
    if (index >= 0) {
      this.goblins[index] = goblin
    } else {
      this.goblins.push(goblin)
    }
    await this.persist()
  }

  async deleteGoblin(id: number): Promise<void> {
    this.goblins = this.goblins.filter(g => g.id !== id)
    await this.persist()
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.goblins))
  }
}
```

---

## スタイリングの移行

### StyleSheet

React Native 標準の StyleSheet を使用:

```typescript
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'

const GoblinCard = ({ goblin, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    <View style={styles.iconContainer}>
      <Image source={require('@/assets/goblin.png')} style={styles.icon} />
    </View>
    <View style={styles.info}>
      <Text style={styles.name}>{goblin.name}</Text>
      <Text style={styles.level}>Lv.{goblin.level}</Text>
    </View>
  </TouchableOpacity>
)

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
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 32,
    height: 32,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  level: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
})
```

### スタイル変換対応表

| Tailwind | React Native StyleSheet |
|----------|------------------------|
| flex-1 | { flex: 1 } |
| flex-col | { flexDirection: 'column' } |
| flex-row | { flexDirection: 'row' } |
| items-center | { alignItems: 'center' } |
| justify-center | { justifyContent: 'center' } |
| justify-between | { justifyContent: 'space-between' } |
| gap-3 | { gap: 12 } |
| p-3 | { padding: 12 } |
| px-4 | { paddingHorizontal: 16 } |
| py-2 | { paddingVertical: 8 } |
| m-2 | { margin: 8 } |
| mt-2 | { marginTop: 8 } |
| rounded-lg | { borderRadius: 8 } |
| rounded-full | { borderRadius: 9999 } |
| text-sm | { fontSize: 14 } |
| text-lg | { fontSize: 18 } |
| font-bold | { fontWeight: 'bold' } |
| text-gray-800 | { color: '#1F2937' } |
| text-gray-500 | { color: '#6B7280' } |
| bg-white | { backgroundColor: 'white' } |
| bg-gray-100 | { backgroundColor: '#F3F4F6' } |
| border-2 | { borderWidth: 2 } |
| border-gray-200 | { borderColor: '#E5E7EB' } |
| shadow-sm | 別途ライブラリ or elevation |
| overflow-y-auto | ScrollView を使用 |
| w-full | { width: '100%' } |
| h-12 | { height: 48 } |

### 色定数の移行

```typescript
// src/shared/constants/colors.ts
export const colors = {
  // Gray scale
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Primary
  primary: '#3B82F6',
  primaryDark: '#2563EB',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',

  // Background
  background: '#F9FAFB',
  cardBackground: '#FFFFFF',
}
```

### レスポンシブ対応 (react-native-size-matters)

様々な端末サイズに対応するため、`react-native-size-matters` を使用します。

#### インストール

```bash
npm install react-native-size-matters
```

#### 基本的な使い方

```typescript
import { scale, verticalScale, moderateScale } from 'react-native-size-matters'

// scale(size): 幅に基づいてスケーリング
// verticalScale(size): 高さに基づいてスケーリング
// moderateScale(size, factor?): 緩やかなスケーリング（factor のデフォルトは 0.5）

const styles = StyleSheet.create({
  card: {
    padding: scale(12),           // 幅ベースのスケーリング
    marginVertical: verticalScale(8), // 高さベースのスケーリング
    borderRadius: moderateScale(8),   // 緩やかなスケーリング
  },
  title: {
    fontSize: moderateScale(16),  // フォントサイズは moderateScale 推奨
  },
})
```

#### スケーリング関数の使い分け

| 関数 | 用途 | 例 |
|------|------|-----|
| `scale(size)` | 横幅に依存する要素 | 横方向のpadding、margin、width |
| `verticalScale(size)` | 縦幅に依存する要素 | 縦方向のpadding、margin、height |
| `moderateScale(size, factor?)` | 緩やかなスケーリングが必要な要素 | fontSize、borderRadius、アイコンサイズ |

#### 実装例: GoblinCard

```typescript
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native'
import { scale, verticalScale, moderateScale } from 'react-native-size-matters'

const GoblinCard = ({ goblin, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    <View style={styles.iconContainer}>
      <Image source={require('@/assets/goblin.png')} style={styles.icon} />
    </View>
    <View style={styles.info}>
      <Text style={styles.name}>{goblin.name}</Text>
      <Text style={styles.level}>Lv.{goblin.level}</Text>
    </View>
  </TouchableOpacity>
)

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderWidth: moderateScale(2),
    borderColor: '#E5E7EB',
    borderRadius: moderateScale(8),
    padding: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  iconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: moderateScale(32),
    height: moderateScale(32),
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#1F2937',
  },
  level: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    marginTop: verticalScale(4),
  },
})
```

#### ユーティリティ関数の作成

プロジェクト全体で一貫したスケーリングを行うため、ユーティリティを作成:

```typescript
// src/shared/utils/scaling.ts
import { scale, verticalScale, moderateScale } from 'react-native-size-matters'

// エイリアス（短縮形）
export const s = scale
export const vs = verticalScale
export const ms = moderateScale

// フォントサイズ専用（factor を調整）
export const fs = (size: number) => moderateScale(size, 0.3)

// スペーシング専用
export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(24),
  xxl: scale(32),
}

// フォントサイズ定義
export const fontSize = {
  xs: fs(12),
  sm: fs(14),
  md: fs(16),
  lg: fs(18),
  xl: fs(20),
  xxl: fs(24),
  title: fs(28),
}

// アイコンサイズ定義
export const iconSize = {
  sm: moderateScale(16),
  md: moderateScale(24),
  lg: moderateScale(32),
  xl: moderateScale(48),
}
```

#### 使用例

```typescript
import { StyleSheet } from 'react-native'
import { s, vs, ms, spacing, fontSize, iconSize } from '@/shared/utils/scaling'

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    marginVertical: vs(8),
  },
  title: {
    fontSize: fontSize.lg,
    marginBottom: spacing.sm,
  },
  icon: {
    width: iconSize.lg,
    height: iconSize.lg,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: ms(8),
  },
})
```

#### 基準サイズ

`react-native-size-matters` は以下の基準サイズを使用:
- **幅**: 350dp (iPhone 8 相当)
- **高さ**: 680dp

異なる端末での表示例:
| 端末 | 画面幅 | scale(10) の結果 |
|------|--------|-----------------|
| iPhone SE | 320dp | 9.1 |
| iPhone 8 | 375dp | 10.7 |
| iPhone 14 | 390dp | 11.1 |
| iPhone 14 Pro Max | 430dp | 12.3 |
| iPad | 768dp | 21.9 |

---

## 移行手順

### Phase 1: プロジェクトセットアップ

1. Expo プロジェクト作成
   ```bash
   npx create-expo-app@latest goblin-native
   cd goblin-native
   ```

2. 必要なパッケージインストール
   ```bash
   # Expo Router
   npx expo install expo-router

   # Firebase
   npx expo install firebase @react-native-async-storage/async-storage

   # ナビゲーション依存
   npx expo install react-native-screens react-native-safe-area-context

   # アニメーション
   npx expo install react-native-reanimated react-native-gesture-handler

   # レスポンシブ対応
   npm install react-native-size-matters
   ```

3. app.json 設定
   ```json
   {
     "expo": {
       "scheme": "goblin-native",
       "plugins": [
         "expo-router"
       ],
       "experiments": {
         "typedRoutes": true
       }
     }
   }
   ```

4. package.json の main を更新
   ```json
   {
     "main": "expo-router/entry"
   }
   ```

### Phase 2: コアロジック移植

1. `src/core/` ディレクトリをそのままコピー
2. `src/shared/types/` をコピー
3. `src/shared/data/` をコピー
4. `src/shared/constants/` をコピー（色定数を純粋な16進数に修正）

5. `ExpeditionEngine.ts` の修正:
   ```typescript
   // 環境変数の読み込み方法を変更
   const isDebug = __DEV__  // または process.env.EXPO_PUBLIC_DEBUG

   // 動的インポートの修正（静的インポートに変更）
   import slimeCaveArea from '@/shared/data/expeditionArea/slime_cave.json'
   import forestOutskirtsArea from '@/shared/data/expeditionArea/forest_outskirts.json'
   // ...
   ```

### Phase 3: Firebase設定

1. `src/config/firebase.ts` を作成（上記参照）
2. `.env` ファイルを作成
3. `app.json` に環境変数の読み込み設定を追加

### Phase 4: Repository実装

1. `src/infrastructure/repositories/` を作成
2. AsyncStorage版のRepository実装を作成
3. Firestore版のRepository実装を作成（Firebase JS SDK使用）

### Phase 5: Context/Hooks移植

1. `AuthContext` を Firebase JS SDK で再実装
2. `ExpeditionStateContext` をそのまま移植
3. カスタムHooksを移植（大部分はそのまま使用可能）

### Phase 6: Expo Router設定・画面実装

1. `app/` ディレクトリ構造を作成
2. レイアウトファイルを作成
3. 画面コンポーネントを実装

優先度順:
1. **ナビゲーション構築**
   - Root Layout, Tab Layout, Stack Layout

2. **基本画面**
   - GoblinListScreen
   - GoblinCard
   - GoblinDetailModal

3. **編成画面**
   - FormationScreen
   - PartyEditScreen
   - ExpeditionPreparationScreen

4. **遠征画面**
   - ExpeditionPlaybackScreen (アニメーション実装が複雑)
   - ExpeditionResultScreen
   - ExpeditionLogScreen

5. **拠点画面**
   - BaseManagementScreen

### Phase 7: テスト・調整

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
<Image source={require('@/assets/goblin/goblin.png')} />
// または
<Image source={{ uri: 'https://...' }} />
```

### 環境変数

```typescript
// 現在
import.meta.env.VITE_USE_FIRESTORE

// Expo
process.env.EXPO_PUBLIC_USE_FIRESTORE

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

### テキスト表示

React Nativeではテキストは必ず`<Text>`コンポーネント内に:

```typescript
// Web
<div>{name}</div>

// React Native
<Text>{name}</Text>
```

### スクロール

```typescript
// Web
<div className="overflow-y-auto">...</div>

// React Native
<ScrollView>...</ScrollView>

// FlatList（大量データの場合）
<FlatList
  data={goblins}
  renderItem={({ item }) => <GoblinCard goblin={item} />}
  keyExtractor={item => String(item.id)}
/>
```

---

## ディレクトリ構成（移行後）

```
goblin_native/
├── app/                      # Expo Router ページ
│   ├── _layout.tsx           # Root Layout
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab Layout
│   │   ├── index.tsx         # リストタブ
│   │   ├── formation/
│   │   │   ├── _layout.tsx   # Stack Layout
│   │   │   ├── index.tsx
│   │   │   ├── preparation.tsx
│   │   │   ├── edit.tsx
│   │   │   ├── playback.tsx
│   │   │   ├── result.tsx
│   │   │   └── log.tsx
│   │   └── base.tsx          # 拠点タブ
│   └── +not-found.tsx
├── src/
│   ├── core/                 # 【そのまま移植】
│   │   ├── domain/
│   │   ├── services/
│   │   ├── usecases/
│   │   └── repositories/
│   ├── shared/               # 【そのまま移植】
│   │   ├── types/
│   │   ├── data/
│   │   ├── constants/
│   │   └── utils/
│   │       └── scaling.ts    # レスポンシブ対応ユーティリティ
│   ├── infrastructure/       # 【Expo対応版】
│   │   └── repositories/
│   │       ├── AsyncStorageGoblinRepositoryImpl.ts
│   │       ├── AsyncStoragePartyRepositoryImpl.ts
│   │       ├── FirestoreGoblinRepositoryImpl.ts
│   │       └── FirestorePartyRepositoryImpl.ts
│   ├── presentation/
│   │   ├── components/       # UI部品
│   │   │   ├── GoblinCard.tsx
│   │   │   ├── GoblinDetailModal.tsx
│   │   │   ├── PartyCard.tsx
│   │   │   └── ...
│   │   ├── contexts/         # Context
│   │   │   ├── AuthContext.tsx
│   │   │   └── ExpeditionStateContext.tsx
│   │   └── hooks/            # Hooks
│   │       ├── useGoblinService.ts
│   │       ├── usePartyService.ts
│   │       └── useExpeditionFlow.ts
│   └── config/
│       └── firebase.ts
├── assets/                   # 画像・フォント
│   ├── goblin/
│   └── icons/
├── .env                      # 環境変数
├── app.json                  # Expo設定
├── babel.config.js
├── metro.config.js
├── package.json
└── tsconfig.json
```

---

## 関連ドキュメント

- [architecture.md](./architecture.md): アーキテクチャ設計
- [current_implementation.md](./current_implementation.md): 現在の実装状況
- [firestore_collections.md](./firestore_collections.md): Firestoreデータ構造
