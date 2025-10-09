# アーキテクチャ設計ガイド

## 概要

このドキュメントでは、ゴブリンキングダムの設計思想と、将来的なUnity等への移植を見据えたアーキテクチャについて説明します。

## 設計原則

### 1. プラットフォーム非依存なコアロジック

ゲームのコアロジックは特定のUI技術（React、Unity等）に依存しない形で実装します。これにより：

- **移植性**: 異なるプラットフォームへの移植が容易
- **テスタビリティ**: UIと切り離してロジックのテストが可能
- **再利用性**: 同じロジックを複数の環境で使用可能

### 2. 依存関係の方向

```
Presentation Layer (UI)
        ↓
   Use Cases Layer (ビジネスロジック)
        ↓
    Domain Layer (コアドメインモデル)
        ↑
Infrastructure Layer (データ永続化)
```

**重要**: コアロジックは外部技術（React、Firebase等）に依存してはいけません。依存の方向は常に外側から内側です。

## ディレクトリ構成

### 現在の構成

```
goblin_web/src/
├── core/              # ゲームコアロジック（移植対象）
│   ├── ExpeditionEngine.ts  # 遠征シミュレーション
│   ├── battle.ts            # 戦闘システム
│   ├── combatant.ts         # 戦闘ユニット管理
│   └── damage.ts            # ダメージ計算
├── types/             # 型定義（移植対象）
│   ├── index.ts       # 主要な型定義
│   └── enemy.ts       # 敵関連の型
├── data/              # ゲームデータ（移植対象）
│   ├── areas.ts       # エリアデータ
│   ├── races.ts       # 種族データ
│   ├── skills.ts      # スキルデータ
│   └── enemy/         # 敵データ
├── repositories/      # データアクセス層（インターフェースのみ移植）
│   ├── GoblinRepository.ts  # インターフェース
│   ├── PartyRepository.ts
│   └── ItemRepository.ts
├── infrastructure/    # 実装層（環境固有）
│   ├── FirestoreGoblinRepositoryImpl.ts
│   ├── JsonGoblinRepositoryImpl.ts
│   └── ...
├── components/        # UI層（環境固有・非移植）
├── contexts/          # React Context（環境固有・非移植）
├── hooks/             # React Hooks（環境固有・非移植）
└── config/            # 環境設定（環境固有・非移植）
```

### 推奨する改善後の構成

```
goblin_web/src/
├── core/                    # 【移植対象】プラットフォーム非依存
│   ├── domain/              # ドメインモデル（エンティティ）
│   │   ├── Goblin.ts
│   │   ├── Party.ts
│   │   ├── Enemy.ts
│   │   └── Item.ts
│   ├── usecases/            # ユースケース（ビジネスロジック）
│   │   ├── StartExpeditionUseCase.ts
│   │   ├── ExecuteBattleUseCase.ts
│   │   └── ManagePartyUseCase.ts
│   └── services/            # ゲームシステム
│       ├── ExpeditionEngine.ts
│       ├── BattleSystem.ts
│       ├── DamageCalculator.ts
│       └── CombatantManager.ts
├── infrastructure/          # 【部分移植】データ永続化実装
│   ├── repositories/
│   │   ├── FirestoreGoblinRepositoryImpl.ts  # Web用
│   │   ├── JsonGoblinRepositoryImpl.ts       # 開発用
│   │   └── (Unity移植時: PlayerPrefsGoblinRepositoryImpl.cs)
│   └── adapters/
│       └── FirebaseAdapter.ts  # Firebase固有の処理
├── presentation/            # 【非移植】UI層（環境固有）
│   ├── components/          # Reactコンポーネント
│   ├── contexts/            # React Context
│   ├── hooks/               # React Hooks
│   └── screens/             # 画面コンポーネント
└── shared/                  # 【移植対象】共通ユーティリティ
    ├── types/               # 型定義
    ├── constants/           # 定数
    └── utils/               # 汎用関数
```

## 層の詳細

### Core Layer (コア層) - 移植対象

#### Domain (ドメイン層)

**目的**: ゲームの中心となるエンティティとビジネスルールを定義

```typescript
// core/domain/Goblin.ts
export class GoblinEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public race: Race,
    public level: number,
    public stats: Stats,
    public equipment?: Equipment
  ) {}

  // ビジネスロジック
  calculateCombatPower(): number {
    const basePower = this.stats.attack + this.stats.defense;
    const equipmentBonus = this.equipment?.calculateBonus() ?? 0;
    return basePower + equipmentBonus;
  }

  canEquip(item: Item): boolean {
    return this.race.allowedItemTypes.includes(item.type);
  }
}
```

**特徴**:
- 外部ライブラリに一切依存しない純粋なTypeScript
- ビジネスルールをメソッドとして実装
- 不変性を重視（readonly、immutableな操作）

#### Use Cases (ユースケース層)

**目的**: アプリケーション固有のビジネスロジックを実装

```typescript
// core/usecases/StartExpeditionUseCase.ts
export class StartExpeditionUseCase {
  constructor(
    private partyRepository: PartyRepository,
    private goblinRepository: GoblinRepository,
    private expeditionEngine: ExpeditionEngine
  ) {}

  async execute(request: ExpeditionRequest): Promise<ExpeditionReplay> {
    // 1. パーティの取得と検証
    const party = await this.partyRepository.getById(request.partyId);
    if (!party) throw new Error('Party not found');
    if (party.status !== 'idle') throw new Error('Party is not idle');

    // 2. ゴブリンの取得
    const goblins = await this.goblinRepository.getByIds(party.memberIds);
    if (goblins.some(g => g.hp <= 0)) {
      throw new Error('Some goblins are defeated');
    }

    // 3. 遠征の実行
    const replay = this.expeditionEngine.simulate({
      party,
      goblins,
      area: request.areaId,
      returnPolicy: request.returnPolicy
    });

    // 4. 結果の保存
    await this.partyRepository.update(party.id, {
      status: 'on_expedition',
      currentExpeditionId: replay.id
    });

    return replay;
  }
}
```

**特徴**:
- Repositoryインターフェースに依存（実装には依存しない）
- 複雑なビジネスロジックをカプセル化
- トランザクション的な操作を管理

#### Services (サービス層)

**目的**: ゲームシステムのコアロジックを実装

```typescript
// core/services/ExpeditionEngine.ts
export class ExpeditionEngine {
  constructor(
    private battleSystem: BattleSystem,
    private random: SeededRandom
  ) {}

  simulate(params: ExpeditionParams): ExpeditionReplay {
    const timeline: TimelineEvent[] = [];
    let currentFloor = 1;
    let party = [...params.goblins];

    while (this.shouldContinue(party, currentFloor, params.returnPolicy)) {
      const event = this.generateFloorEvent(party, currentFloor);
      timeline.push(event);

      if (event.type === 'battle') {
        const result = this.battleSystem.execute(party, event.enemies);
        party = result.survivors;
        timeline.push(...result.events);
      }

      currentFloor++;
    }

    return { timeline, summary: this.createSummary(timeline) };
  }

  private shouldContinue(/* ... */): boolean {
    // 帰還ポリシーに基づく判定ロジック
  }
}
```

**特徴**:
- 決定論的（シード値による再現性）
- 副作用なし（純粋関数的）
- ゲームルールの実装

### Infrastructure Layer (インフラ層) - 部分移植

**目的**: データ永続化の具体的な実装を提供

```typescript
// infrastructure/repositories/FirestoreGoblinRepositoryImpl.ts
export class FirestoreGoblinRepositoryImpl implements GoblinRepository {
  constructor(private firestore: Firestore) {}

  async getById(id: string): Promise<Goblin | null> {
    const doc = await this.firestore.collection('goblins').doc(id).get();
    return doc.exists ? this.toEntity(doc.data()) : null;
  }

  // その他のメソッド実装...
}
```

Unity移植時には、同じインターフェースで別実装を用意：

```csharp
// Unity版 (C#)
public class PlayerPrefsGoblinRepository : IGoblinRepository {
    public async Task<Goblin> GetById(string id) {
        var json = PlayerPrefs.GetString($"goblin_{id}", null);
        return json != null ? JsonUtility.FromJson<Goblin>(json) : null;
    }
}
```

### Presentation Layer (プレゼンテーション層) - 非移植

**目的**: ユーザーインターフェースとユーザー操作の処理

```typescript
// presentation/screens/ExpeditionPlaybackScreen.tsx
export const ExpeditionPlaybackScreen: React.FC = () => {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const { replay } = useExpeditionState();

  // UseCase を利用
  const useCase = useMemo(() =>
    new StartExpeditionUseCase(
      partyRepository,
      goblinRepository,
      expeditionEngine
    ), []
  );

  const handleStart = async () => {
    const result = await useCase.execute(expeditionRequest);
    setReplay(result);
  };

  return (
    <div>
      {/* UI要素 */}
    </div>
  );
};
```

Unity移植時には、同等の機能を持つUnity UIコンポーネントを作成：

```csharp
// Unity版 (C#)
public class ExpeditionPlaybackScreen : MonoBehaviour {
    private StartExpeditionUseCase useCase;

    void Start() {
        useCase = new StartExpeditionUseCase(
            partyRepository,
            goblinRepository,
            expeditionEngine
        );
    }

    public async void OnStartButtonClick() {
        var result = await useCase.Execute(expeditionRequest);
        UpdateUI(result);
    }
}
```

## Unity移植時の作業イメージ

### Phase 1: コアロジックの移植

1. **型定義の変換** (`/core/domain`)
   - TypeScript → C#
   - インターフェースとクラスは1:1で対応

2. **ユースケースの移植** (`/core/usecases`)
   - ロジックはほぼそのまま移植可能
   - async/awaitも同様に使用可能

3. **サービスの移植** (`/core/services`)
   - `ExpeditionEngine` や `BattleSystem` をC#に変換

### Phase 2: インフラ層の実装

4. **Repository実装の作成** (`/infrastructure`)
   - `PlayerPrefsRepositoryImpl` または `SQLiteRepositoryImpl`
   - インターフェースは同一、実装のみ変更

### Phase 3: UI層の新規作成

5. **Unity UIの実装** (完全新規)
   - uGUI または Unity UI Toolkit で画面を作成
   - UseCaseを呼び出してロジックを実行

## 実装ガイドライン

### DO (推奨)

✅ コアロジックは純粋なTypeScriptで実装
✅ 依存性注入を活用（コンストラクタインジェクション）
✅ インターフェースで抽象化
✅ ユニットテストを書く（特にコア層）
✅ 不変性を意識（readonlyを活用）

### DON'T (非推奨)

❌ コア層でReact固有の機能を使用（hooks、context等）
❌ コア層でFirebase SDKを直接使用
❌ ビジネスロジックをUIコンポーネントに記述
❌ グローバル状態に依存
❌ 副作用の多い関数（純粋関数を優先）

## 移行ステップ（既存コードのリファクタリング）

既存のコードを段階的に改善する場合：

### Step 1: 型定義の整理

- `types/index.ts` を `core/domain/` に移動
- インターフェースとクラスを分離

### Step 2: UseCaseの抽出

- コンポーネントから複雑なロジックを抽出
- `core/usecases/` に配置

### Step 3: Repositoryの整理

- 既存のRepositoryを `infrastructure/repositories/` に移動
- インターフェースは `core/domain/` に配置

### Step 4: UI層の整理

- `components/` を `presentation/` にリネーム
- ロジックをUseCaseに移譲

## まとめ

この設計により：

- **Web版**: React + Firebaseで快適に開発
- **Unity版**: コアロジックを再利用し、UI層のみ実装
- **CLI版**: 既存の `goblin_ink` のようにコアロジック再利用

同じゲームルールを複数のプラットフォームで展開できます。
