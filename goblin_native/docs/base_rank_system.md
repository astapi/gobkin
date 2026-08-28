# 拠点ランクシステム設計

## 概要

ゴブリンが勢力を拡大し、敵の拠点を制圧することで拠点ランクを上げるシステム。
拠点ランクの上昇により、パーティ編成数、ゴブリン収容数、「群れを増やす」の同時稼働枠数が増加する。

## 拠点ランクの進行

### ランクアップ条件

| ランク | 制圧対象ダンジョン | クリア回数 | 解放される機能 |
|--------|-------------------|-----------|---------------|
| 1 (初期) | - | - | 基本機能 |
| 2 | ゴブリン集落 | 1回 | 2PT編成、ゴブリン20体収容 |
| 3 | 盗賊のアジト（山道の洞窟） | 1回 | 3PT編成、ゴブリン35体収容 |
| 4 | 交易路の関所 / オークキャンプ / ハーフリングの農村 | 1回 | 4PT編成、ゴブリン50体収容 |
| 5 | ドワーフ坑道 / リザードマンの湿地集落 / ミノタウロス迷宮 | 1回 | 5PT編成、ゴブリン70体収容 |
| 6 | 人間の辺境の街塞 / 吸血鬼の古城 | 1回 | 6PT編成、ゴブリン100体収容 |
| 7 (最終) | 王都防衛戦 | 1回 | 8PT編成、ゴブリン150体収容 |

### ランク4以降の選択肢

ランク4以降は複数のダンジョンから選択可能。プレイヤーの戦略に応じてルートを選べる。

**ランク3→4の選択肢**：
- **交易路の関所**: 経済ルート（将来的に資金ボーナスなど）
- **オークキャンプ**: 軍事ルート（戦闘力強化）
- **ハーフリングの農村**: 生産ルート（食料・素材生産）

**ランク4→5の選択肢**：
- **ドワーフ坑道**: 工業ルート（装備製作）
- **リザードマンの湿地集落**: 種族多様化ルート（特殊遺伝子）
- **ミノタウロス迷宮**: 軍事強化ルート

**ランク5→6の選択肢**：
- **人間の辺境の街塞**: 正攻法ルート
- **吸血鬼の古城**: 闇ルート（特殊能力）

## 拠点ランクによる効果

### 基本効果

```typescript
const BASE_RANK_CONFIGS = [
  {
    rank: 1,
    maxParties: 1,        // 編成可能なパーティ数
    maxGoblins: 10,       // 収容可能なゴブリン数
  },
  {
    rank: 2,
    maxParties: 2,
    maxGoblins: 20,
  },
  {
    rank: 3,
    maxParties: 3,
    maxGoblins: 35,
  },
  {
    rank: 4,
    maxParties: 4,
    maxGoblins: 50,
  },
  {
    rank: 5,
    maxParties: 5,
    maxGoblins: 70,
  },
  {
    rank: 6,
    maxParties: 6,
    maxGoblins: 100,
  },
  {
    rank: 7,
    maxParties: 8,
    maxGoblins: 150,
  },
];
```

## ＋値と最大レベル

### 基本ロジック

```
子の＋値 = max(継承元の＋値, ランダム選出個体の＋値) + 1
```

拠点にマルクしかいない場合は、マルク単独で `マルクの＋値 + 1` とする。

純ゴブリンの最大レベルは `min(200, 50 + ＋値×3)`。亜種と始祖ゴブリンは＋値による最大レベル変化がなく、Lv200まで成長できる。既存個体が移行時点で計算上限を超えている場合は現在レベルを下げない。

### ゲームプレイへの影響

**メリット**：
1. **世代更新**: 高い＋値を持つ個体を使うほど次世代の＋値が上がる
2. **拠点成長の価値**: 拠点ランクを上げるほど同時稼働枠が増える
3. **選択肢の多様性**: レベルと因子の組み合わせを見て設定個体を選ぶ

**プレイヤーの戦略**：
- **序盤**: マルク単独から最初の＋1を誕生させる
- **中盤**: 高い＋値と狙った因子を持つ個体を継承元にする
- **終盤**: 亜種ごとの最低＋値を満たして希少亜種を狙う

## データ構造

### BaseState（拠点状態）

```typescript
interface BaseState {
  rank: number;                    // 現在の拠点ランク（1-7）
  capturedDungeons: string[];      // 制圧済みダンジョンIDのリスト
  currentMaxParties: number;       // 現在の最大パーティ数
  currentMaxGoblins: number;       // 現在の最大ゴブリン数
}
```

### DungeonArea（ダンジョンエリア）

```typescript
interface DungeonArea {
  id: string;                      // ダンジョンID
  name: string;                    // ダンジョン名
  areaLevel: number;               // エリアレベル（1-8）
  isBaseCapture: boolean;          // 拠点化可能か
  requiredRank?: number;           // 挑戦に必要な拠点ランク
  rankUpTarget?: number;           // このダンジョン制圧で到達するランク
  // ... その他のプロパティ
}
```

### BaseRankConfig（ランク設定）

```typescript
interface BaseRankConfig {
  rank: number;
  maxParties: number;
  maxGoblins: number;
  unlockCondition: {
    dungeonId: string;             // 制圧する必要のあるダンジョンID
    clearCount?: number;           // 必要なクリア回数（デフォルト1）
  };
}
```

## 実装ロジック

### ＋値計算関数

```typescript
function calculateBirthPlusValue(plusValues: number[]): number {
  return Math.max(...plusValues) + 1;
}
```

### ランクアップ可否チェック

```typescript
function checkRankUpAvailable(baseState: BaseState): {
  canRankUp: boolean;
  requirement?: string;
  nextRank?: number;
} {
  const nextConfig = BASE_RANK_CONFIGS.find(c => c.rank === baseState.rank + 1);
  if (!nextConfig) {
    return { canRankUp: false };
  }

  const hasCaptured = baseState.capturedDungeons.includes(
    nextConfig.unlockCondition.dungeonId
  );

  if (!hasCaptured) {
    return {
      canRankUp: false,
      requirement: `${nextConfig.unlockCondition.dungeonId}を制圧する必要があります`,
      nextRank: nextConfig.rank
    };
  }

  return { canRankUp: true, nextRank: nextConfig.rank };
}
```

### ダンジョン制圧処理

```typescript
async function captureDungeon(
  dungeonId: string,
  baseState: BaseState
): Promise<BaseState> {
  // 制圧済みリストに追加
  if (!baseState.capturedDungeons.includes(dungeonId)) {
    baseState.capturedDungeons.push(dungeonId);
  }

  // ランクアップ可能かチェック
  const { canRankUp, nextRank } = checkRankUpAvailable(baseState);

  if (canRankUp && nextRank) {
    const nextConfig = BASE_RANK_CONFIGS.find(c => c.rank === nextRank);
    if (nextConfig) {
      baseState.rank = nextRank;
      baseState.currentMaxParties = nextConfig.maxParties;
      baseState.currentMaxGoblins = nextConfig.maxGoblins;
    }
  }

  return baseState;
}
```

## 将来的な拡張

### 拠点ごとの特殊効果

制圧したダンジョンに応じて、追加の効果を付与する可能性：

```typescript
interface CapturedDungeonBonus {
  dungeonId: string;
  bonusType: 'genetic' | 'economic' | 'military' | 'production';
  effects: {
    goldBonus?: number;              // 資金ボーナス%
    materialBonus?: string[];        // 獲得しやすい素材
    geneticBonus?: string[];         // 獲得しやすい種族遺伝子
    expeditionCostReduction?: number; // 遠征コスト削減%
    goblinBirthRate?: number;        // ゴブリン生成速度%
  };
}
```

**例**：
- **交易路の関所**: 資金+30%
- **ドワーフ坑道**: 鉱物素材獲得率UP、ドワーフ遺伝子ボーナス
- **ハーフリング農村**: 遠征コスト-15%、食料生産

### 防衛システム

拠点ごとに防衛力を設定し、定期的に人間軍の反撃イベントが発生：

```typescript
interface BaseDefense {
  level: number;                   // 防衛レベル
  lastAttackTime: number | null;   // 最後の攻撃時刻
  isUnderAttack: boolean;          // 攻撃中フラグ
}
```

## 実装優先順位

### Phase 1: 基本システム
1. BaseStateデータ構造の実装
2. ＋値計算ロジックの実装
3. ランクアップ判定ロジックの実装
4. GoblinBirthServiceへの統合

### Phase 2: UI実装
1. 拠点ランク表示画面
2. ランクアップ通知
3. ダンジョン制圧状況の表示
4. 次のランクアップ条件の表示

### Phase 3: ゲームバランス調整
1. エリアレベルの設定
2. 純ゴブリンの最大レベルと亜種最低＋値の調整
3. ランクアップ条件の調整

### Phase 4: 拡張機能
1. 拠点ごとの特殊効果
2. 防衛システム
3. 複数拠点管理

## 関連ドキュメント

- [dungen_idea.md](./dungen_idea.md): 遠征先のアイデアとランクアップ候補
- [project_structure.md](./project_structure.md): プロジェクト構成
- [game_design_overview.md](./game_design_overview.md): ゲーム仕様総合ドキュメント
