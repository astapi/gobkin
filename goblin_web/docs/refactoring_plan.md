# アーキテクチャリファクタリング計画

## 概要

このドキュメントは、`architecture.md` で定義されたアーキテクチャ設計に沿って、現在のプロジェクト構成をリファクタリングするための詳細な計画です。

## 目標

- プラットフォーム非依存なコアロジックの確立
- Unity等への移植を見据えた層分離の実現
- 依存関係の方向を明確化（外側→内側）
- テスタビリティと保守性の向上

## 現在の構成

```
goblin_web/src/
├── core/              # ゲームコアロジック
│   ├── ExpeditionEngine.ts
│   ├── battle.ts
│   ├── combatant.ts
│   ├── damage.ts
│   └── index.ts
├── types/             # 型定義
│   ├── index.ts
│   └── enemy.ts
├── data/              # ゲームデータ
│   ├── areas.ts
│   ├── races.ts
│   ├── skills.ts
│   ├── index.ts
│   ├── enemy/
│   └── expeditionArea/
├── repositories/      # データアクセス層
│   ├── GoblinRepository.ts
│   ├── PartyRepository.ts
│   ├── ItemRepository.ts
│   ├── FirestoreGoblinRepositoryImpl.ts
│   ├── FirestorePartyRepositoryImpl.ts
│   ├── FirestoreItemRepositoryImpl.ts
│   ├── FirestoreExpeditionRepositoryImpl.ts
│   ├── JsonGoblinRepositoryImpl.ts
│   └── JsonPartyRepositoryImpl.ts
├── services/          # サービス層（存在しない）
├── components/        # UI層
├── contexts/          # React Context
├── hooks/             # React Hooks
├── config/            # 環境設定
└── assets/            # 静的アセット
```

## 目標構成

```
goblin_web/src/
├── core/                          # 【移植対象】プラットフォーム非依存
│   ├── domain/                    # ドメインモデル
│   │   ├── Goblin.ts
│   │   ├── Party.ts
│   │   ├── Enemy.ts
│   │   ├── Item.ts
│   │   ├── Equipment.ts
│   │   └── ExpeditionReplay.ts
│   ├── usecases/                  # ユースケース
│   │   ├── StartExpeditionUseCase.ts
│   │   ├── ExecuteBattleUseCase.ts
│   │   ├── ManagePartyUseCase.ts
│   │   ├── EquipItemUseCase.ts
│   │   └── CaptureEnemyUseCase.ts
│   ├── services/                  # ゲームシステム
│   │   ├── ExpeditionEngine.ts
│   │   ├── BattleSystem.ts
│   │   ├── DamageCalculator.ts
│   │   ├── CombatantManager.ts
│   │   └── LootSystem.ts
│   └── repositories/              # Repositoryインターフェース
│       ├── IGoblinRepository.ts
│       ├── IPartyRepository.ts
│       ├── IItemRepository.ts
│       └── IExpeditionRepository.ts
├── infrastructure/                # 【部分移植】データ永続化実装
│   ├── repositories/
│   │   ├── FirestoreGoblinRepositoryImpl.ts
│   │   ├── FirestorePartyRepositoryImpl.ts
│   │   ├── FirestoreItemRepositoryImpl.ts
│   │   ├── FirestoreExpeditionRepositoryImpl.ts
│   │   ├── JsonGoblinRepositoryImpl.ts
│   │   └── JsonPartyRepositoryImpl.ts
│   └── adapters/
│       └── FirebaseAdapter.ts
├── presentation/                  # 【非移植】UI層
│   ├── components/
│   │   ├── GoblinListScreen.tsx
│   │   ├── DungeonScreen.tsx
│   │   ├── PartyEditScreen.tsx
│   │   ├── ExpeditionSetupScreen.tsx
│   │   ├── ExpeditionPlaybackScreen.tsx
│   │   ├── ExpeditionResultScreen.tsx
│   │   ├── FormationScreen.tsx
│   │   └── (その他のUIコンポーネント)
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── ExpeditionStateContext.tsx
│   └── hooks/
│       ├── useGoblinRepository.ts
│       ├── usePartyRepository.ts
│       └── useCurrentTime.ts
└── shared/                        # 【移植対象】共通ユーティリティ
    ├── types/                     # 型定義
    │   ├── Goblin.ts
    │   ├── Party.ts
    │   ├── Enemy.ts
    │   ├── Item.ts
    │   └── index.ts
    ├── constants/                 # 定数
    │   ├── gameConfig.ts
    │   └── index.ts
    ├── data/                      # ゲームデータ
    │   ├── areas.ts
    │   ├── races.ts
    │   ├── skills.ts
    │   ├── enemy/
    │   └── expeditionArea/
    └── utils/                     # 汎用関数
        └── random.ts
```

## リファクタリング手順

### Phase 1: 型定義の整理と移動

#### タスク 1.1: shared/types/ の作成

**目的**: 型定義を共通領域に移動し、ドメインモデルの基礎を確立

**作業内容**:
1. `src/shared/types/` ディレクトリを作成
2. `src/types/index.ts` の内容を分割:
   - `Goblin.ts`: Goblin関連の型
   - `Party.ts`: Party関連の型
   - `Enemy.ts`: Enemy関連の型（`src/types/enemy.ts` をマージ）
   - `Item.ts`: Item関連の型
   - `Equipment.ts`: Equipment関連の型
   - `Expedition.ts`: ExpeditionRequest, ExpeditionReplay, TimelineEvent等
   - `Battle.ts`: BattleLog, Combatant等
   - `index.ts`: 全てをre-export
3. 既存の import 文を更新

**影響範囲**:
- 全てのファイルで import パスを更新する必要がある
- `src/types/` からの import を `src/shared/types/` に変更

**移行順序**:
1. 新しい `shared/types/` にファイルを作成
2. 古い `types/` からのre-exportを追加（互換性維持）
3. 全ファイルの import を徐々に更新
4. 古い `types/` ディレクトリを削除

---

#### タスク 1.2: shared/data/ の作成

**目的**: ゲームデータを共通領域に移動

**作業内容**:
1. `src/shared/data/` ディレクトリを作成
2. 以下を移動:
   - `src/data/areas.ts` → `src/shared/data/areas.ts`
   - `src/data/races.ts` → `src/shared/data/races.ts`
   - `src/data/skills.ts` → `src/shared/data/skills.ts`
   - `src/data/enemy/` → `src/shared/data/enemy/`
   - `src/data/expeditionArea/` → `src/shared/data/expeditionArea/`
   - `src/data/index.ts` → `src/shared/data/index.ts`
3. import パスを更新

**影響範囲**:
- `core/` 内のファイル
- `components/` 内のファイル

---

### Phase 2: Repositoryインターフェースの移動

#### タスク 2.1: core/repositories/ の作成

**目的**: Repositoryインターフェースをコア層に配置し、依存関係を明確化

**作業内容**:
1. `src/core/repositories/` ディレクトリを作成
2. 既存のRepositoryインターフェースをリネームして移動:
   - `src/repositories/GoblinRepository.ts` → `src/core/repositories/IGoblinRepository.ts`
   - `src/repositories/PartyRepository.ts` → `src/core/repositories/IPartyRepository.ts`
   - `src/repositories/ItemRepository.ts` → `src/core/repositories/IItemRepository.ts`
3. インターフェース名を `IGoblinRepository` のように変更（オプション）
4. `src/core/repositories/index.ts` で全てをre-export

**影響範囲**:
- 実装クラス（`Firestore*RepositoryImpl`, `Json*RepositoryImpl`）
- UseCaseやService層
- hooks（`useGoblinRepository`, `usePartyRepository`）

---

#### タスク 2.2: infrastructure/repositories/ の作成

**目的**: Repository実装をインフラ層に移動

**作業内容**:
1. `src/infrastructure/repositories/` ディレクトリを作成
2. 実装クラスを移動:
   - `src/repositories/FirestoreGoblinRepositoryImpl.ts` → `src/infrastructure/repositories/FirestoreGoblinRepositoryImpl.ts`
   - `src/repositories/FirestorePartyRepositoryImpl.ts` → `src/infrastructure/repositories/FirestorePartyRepositoryImpl.ts`
   - `src/repositories/FirestoreItemRepositoryImpl.ts` → `src/infrastructure/repositories/FirestoreItemRepositoryImpl.ts`
   - `src/repositories/FirestoreExpeditionRepositoryImpl.ts` → `src/infrastructure/repositories/FirestoreExpeditionRepositoryImpl.ts`
   - `src/repositories/JsonGoblinRepositoryImpl.ts` → `src/infrastructure/repositories/JsonGoblinRepositoryImpl.ts`
   - `src/repositories/JsonPartyRepositoryImpl.ts` → `src/infrastructure/repositories/JsonPartyRepositoryImpl.ts`
3. インターフェースの import パスを更新（`core/repositories/` から）

**影響範囲**:
- hooks 内でのインポート
- DI設定

---

### Phase 3: コアロジックの整理

#### タスク 3.1: core/services/ の作成

**目的**: 既存のコアロジックをサービス層として整理

**作業内容**:
1. `src/core/services/` ディレクトリを作成
2. 既存ファイルをリネームして移動:
   - `src/core/ExpeditionEngine.ts` → `src/core/services/ExpeditionEngine.ts`
   - `src/core/battle.ts` → `src/core/services/BattleSystem.ts`
   - `src/core/combatant.ts` → `src/core/services/CombatantManager.ts`
   - `src/core/damage.ts` → `src/core/services/DamageCalculator.ts`
3. クラス名を変更（必要に応じて）:
   - `battle.ts` の関数群 → `BattleSystem` クラス
   - `combatant.ts` → `CombatantManager` クラス
4. React依存を完全に排除
5. `src/core/services/index.ts` で全てをre-export

**影響範囲**:
- `components/` 内で直接 `core/` を使用している箇所
- UseCase層（未作成）

**リファクタリングポイント**:
- 関数ベースのロジックをクラスベースに変換
- 依存性注入を可能にする設計に変更

---

#### タスク 3.2: core/domain/ の作成

**目的**: ドメインエンティティクラスを作成し、ビジネスロジックをカプセル化

**作業内容**:
1. `src/core/domain/` ディレクトリを作成
2. ドメインエンティティクラスを作成:
   - `GoblinEntity.ts`: Goblinのビジネスロジック
     - `calculateCombatPower()`: 戦闘力計算
     - `canEquip(item: Item)`: 装備可否判定
     - `equipItem(item: Item)`: アイテム装備
     - `takeDamage(damage: number)`: ダメージ処理
   - `PartyEntity.ts`: Partyのビジネスロジック
     - `addMember(goblinId: string)`: メンバー追加
     - `removeMember(goblinId: string)`: メンバー削除
     - `canStartExpedition()`: 遠征可能判定
   - `EnemyEntity.ts`: Enemyのビジネスロジック
     - `canBeCaptured()`: 捕獲可否判定
   - `ItemEntity.ts`: Itemのビジネスロジック
     - `calculateBonus()`: ボーナス計算

**影響範囲**:
- UseCase層での使用
- サービス層での使用

**リファクタリングポイント**:
- 既存の型定義をクラスに変換
- ビジネスロジックをエンティティに移動

---

#### タスク 3.3: core/usecases/ の作成

**目的**: アプリケーション固有のビジネスロジックをUseCaseとして抽出

**作業内容**:
1. `src/core/usecases/` ディレクトリを作成
2. UseCaseクラスを作成:
   - `StartExpeditionUseCase.ts`: 遠征開始
   - `ExecuteBattleUseCase.ts`: 戦闘実行（現在は不要かもしれない）
   - `ManagePartyUseCase.ts`: パーティ管理
   - `EquipItemUseCase.ts`: アイテム装備
   - `GetGoblinListUseCase.ts`: ゴブリン一覧取得
   - `CreatePartyUseCase.ts`: パーティ作成
   - `UpdatePartyMembersUseCase.ts`: パーティメンバー更新

**UseCase実装例**:

```typescript
// core/usecases/StartExpeditionUseCase.ts
export class StartExpeditionUseCase {
  constructor(
    private partyRepository: IPartyRepository,
    private goblinRepository: IGoblinRepository,
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

**影響範囲**:
- UIコンポーネントから直接Repository/Serviceを呼んでいる箇所
- hooks の実装

**リファクタリングポイント**:
- コンポーネントから複雑なロジックを抽出
- 依存性注入を活用

---

### Phase 4: プレゼンテーション層の整理

#### タスク 4.1: presentation/ の作成

**目的**: UI層を明確に分離し、React固有の実装を集約

**作業内容**:
1. `src/presentation/` ディレクトリを作成
2. 既存のファイルを移動:
   - `src/components/` → `src/presentation/components/`
   - `src/contexts/` → `src/presentation/contexts/`
   - `src/hooks/` → `src/presentation/hooks/`
3. hooks の実装を見直し、UseCaseを使用するように変更
4. コンポーネントから直接Repository/Serviceを使用している箇所をUseCaseに置き換え

**影響範囲**:
- `src/App.tsx`
- `src/main.tsx`
- 全てのimport文

---

#### タスク 4.2: UIコンポーネントのリファクタリング

**目的**: コンポーネントからビジネスロジックを排除

**作業内容**:
1. 各コンポーネントを見直し、ビジネスロジックをUseCaseに移動
2. hooks を通じてUseCaseを使用するパターンに統一
3. コンポーネントは純粋にUIとユーザーインタラクションのみを担当

**例**:

```typescript
// presentation/components/ExpeditionSetupScreen.tsx (改善前)
const handleStartExpedition = async () => {
  const party = await partyRepository.getById(partyId);
  const goblins = await goblinRepository.getByIds(party.memberIds);
  const replay = expeditionEngine.simulate({...});
  await partyRepository.update(party.id, {...});
};

// presentation/components/ExpeditionSetupScreen.tsx (改善後)
const startExpeditionUseCase = useStartExpeditionUseCase();

const handleStartExpedition = async () => {
  const replay = await startExpeditionUseCase.execute({
    partyId,
    areaId,
    returnPolicy
  });
};
```

---

### Phase 5: インフラ層の整理

#### タスク 5.1: infrastructure/adapters/ の作成

**目的**: Firebase固有のロジックを抽出し、Repository実装をシンプルに保つ

**作業内容**:
1. `src/infrastructure/adapters/` ディレクトリを作成
2. `FirebaseAdapter.ts` を作成し、Firebase固有の処理を集約:
   - Firestore接続管理
   - データ変換（Firestore ↔ Domain Entity）
   - エラーハンドリング
3. Repository実装からFirebase固有の処理を抽出

**影響範囲**:
- `infrastructure/repositories/Firestore*RepositoryImpl.ts`

---

#### タスク 5.2: config/ の移動

**目的**: 環境設定をインフラ層に統合

**作業内容**:
1. `src/config/` を `src/infrastructure/config/` に移動
2. Firebase設定の管理を明確化

**影響範囲**:
- `infrastructure/repositories/` 内での import
- `presentation/contexts/AuthContext.tsx`

---

### Phase 6: 共通ユーティリティの整理

#### タスク 6.1: shared/constants/ の作成

**目的**: 定数を一箇所に集約

**作業内容**:
1. `src/shared/constants/` ディレクトリを作成
2. 定数を集約:
   - `gameConfig.ts`: ゲーム設定（レベル上限、経験値テーブル等）
   - `uiConfig.ts`: UI設定（アニメーション速度等）
3. 既存のマジックナンバーを定数化

---

#### タスク 6.2: shared/utils/ の作成

**目的**: 汎用関数を集約

**作業内容**:
1. `src/shared/utils/` ディレクトリを作成
2. 汎用関数を作成:
   - `random.ts`: シード値ベースの乱数生成
   - `calculation.ts`: 汎用計算関数
3. コア層から汎用的な関数を抽出

---

### Phase 7: テストの追加

#### タスク 7.1: core/ のユニットテスト

**目的**: コアロジックの品質を担保

**作業内容**:
1. 各UseCase のテストを作成
2. 各Service のテストを作成
3. DomainEntity のテストを作成

**例**:
- `core/usecases/__tests__/StartExpeditionUseCase.test.ts`
- `core/services/__tests__/BattleSystem.test.ts`
- `core/domain/__tests__/GoblinEntity.test.ts`

---

#### タスク 7.2: Repository のモック実装

**目的**: テスト用のモック実装を提供

**作業内容**:
1. `src/infrastructure/repositories/__mocks__/` ディレクトリを作成
2. 各Repositoryのモック実装を作成
3. テストで使用

---

### Phase 8: クリーンアップ

#### タスク 8.1: 旧ディレクトリの削除

**目的**: 不要なディレクトリを削除し、構成をクリーンに保つ

**作業内容**:
1. `src/types/` を削除
2. `src/data/` を削除
3. `src/repositories/` を削除
4. `src/components/` を削除
5. `src/contexts/` を削除
6. `src/hooks/` を削除
7. `src/config/` を削除

**前提条件**:
- 全てのファイルが新しい場所に移動済み
- 全ての import が更新済み
- ビルドとテストが通ること

---

#### タスク 8.2: ドキュメントの更新

**目的**: 新しい構成をドキュメントに反映

**作業内容**:
1. `CLAUDE.md` を更新
2. `README.md` を更新（存在する場合）
3. 各層の責務をコメントで記載

---

## 優先順位と段階的な移行

### 最優先（Phase 1-2）
- 型定義とデータの移動
- Repositoryインターフェースの移動

この段階では破壊的変更が少なく、既存機能に影響を与えにくい。

### 次の優先度（Phase 3）
- コアロジックの整理
- UseCaseの作成

この段階でアーキテクチャの恩恵が見え始める。

### 最後（Phase 4-8）
- UI層の整理
- テストの追加
- クリーンアップ

この段階で全体が完成し、移植可能な状態になる。

---

## リスク管理

### 既存機能への影響

**リスク**: リファクタリング中に既存機能が壊れる

**対策**:
1. 各Phase後に動作確認を実施
2. Git で細かくコミット
3. 段階的にリファクタリング（re-exportで互換性を保つ）

### 開発速度の低下

**リスク**: リファクタリングに時間がかかり、新機能開発が遅れる

**対策**:
1. 優先度の高いPhaseから実施
2. 各Phaseを独立して完了できるように設計
3. 必要に応じて新機能開発と並行実施

### 複雑性の増加

**リスク**: 層分離により複雑性が増す

**対策**:
1. 各層の責務を明確にドキュメント化
2. DIコンテナやファクトリパターンでインスタンス生成を簡素化
3. サンプルコードを提供

---

## 完了基準

### Phase 1-2完了
- [ ] 全ての型定義が `shared/types/` に移動
- [ ] 全てのゲームデータが `shared/data/` に移動
- [ ] Repositoryインターフェースが `core/repositories/` に移動
- [ ] Repository実装が `infrastructure/repositories/` に移動
- [ ] 全ての import が更新され、ビルドが通る

### Phase 3完了
- [ ] `core/services/` にサービス層が構築
- [ ] `core/domain/` にドメインエンティティが作成
- [ ] `core/usecases/` に主要なUseCaseが実装
- [ ] React依存が完全に排除
- [ ] ビルドとテストが通る

### Phase 4完了
- [ ] 全てのUIコンポーネントが `presentation/` に移動
- [ ] UIコンポーネントからビジネスロジックが排除
- [ ] UseCaseを通じたロジック実行パターンが確立
- [ ] ビルドとテストが通る

### Phase 5-6完了
- [ ] インフラ層が整理され、Firebase固有の処理が分離
- [ ] 共通ユーティリティが `shared/` に集約
- [ ] ビルドとテストが通る

### Phase 7完了
- [ ] 主要なUseCaseとServiceにテストが追加
- [ ] テストカバレッジが一定水準以上（目標: 70%以上）
- [ ] 全てのテストが通る

### Phase 8完了
- [ ] 旧ディレクトリが全て削除
- [ ] ドキュメントが更新
- [ ] 最終的な動作確認が完了
- [ ] ビルドとテストが通る

---

## まとめ

このリファクタリング計画により、以下が実現されます：

1. **プラットフォーム非依存**: `core/` と `shared/` は Unity等に移植可能
2. **テスタビリティ**: 各層が独立してテスト可能
3. **保守性**: 責務が明確で変更の影響範囲が限定的
4. **拡張性**: 新機能の追加が容易

段階的に実施することで、既存機能への影響を最小限に抑えながら、将来を見据えたアーキテクチャに移行できます。
