# 拠点ランクシステム設計

## 概要

ゴブリンが勢力を拡大し、敵の拠点を制圧することで拠点ランクを上げるシステム。
拠点ランクの上昇により、パーティ編成数、ゴブリン収容数、個体値ボーナスが増加する。

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
    ivBonus: 0,           // 個体値ボーナス
  },
  {
    rank: 2,
    maxParties: 2,
    maxGoblins: 20,
    ivBonus: 2,           // +2
  },
  {
    rank: 3,
    maxParties: 3,
    maxGoblins: 35,
    ivBonus: 4,           // +4
  },
  {
    rank: 4,
    maxParties: 4,
    maxGoblins: 50,
    ivBonus: 6,           // +6
  },
  {
    rank: 5,
    maxParties: 5,
    maxGoblins: 70,
    ivBonus: 8,           // +8
  },
  {
    rank: 6,
    maxParties: 6,
    maxGoblins: 100,
    ivBonus: 10,          // +10
  },
  {
    rank: 7,
    maxParties: 8,
    maxGoblins: 150,
    ivBonus: 12,          // +12
  },
];
```

## 個体値計算システム

### 基本ロジック

```
最終個体値 = エリアレベルベース個体値 + 拠点ランクボーナス
→ 1-64の範囲にクランプ
```

### エリアレベルごとのベース個体値範囲

各ダンジョンエリアには「エリアレベル」（1-8）が設定されており、これがゴブリン生成時のベース個体値を決定する。

```typescript
const AREA_LEVEL_IV_RANGES: Record<number, [number, number]> = {
  1: [1, 8],      // 序盤（スライム洞窟、周辺の森）
  2: [6, 14],     // 初期中盤（ゴブリン集落、盗賊のアジト、ハーフリング農村）
  3: [12, 20],    // 中盤（交易路の関所、小さな鉱山、沼地の見張り小屋）
  4: [18, 28],    // 中盤後期（ドワーフ坑道、オークキャンプ、アンデッド墳墓）
  5: [26, 36],    // 上級（リザードマン集落、ハーピーの崖巣、トロルの峡谷）
  6: [34, 44],    // 終盤（ミノタウロス迷宮、吸血鬼の古城、ドラゴンの火山巣）
  7: [42, 52],    // 最終盤（人間の街塞、騎士団本部、学術都市）
  8: [50, 60],    // 最終決戦（王都防衛戦）
};
```

### 計算例

**例1: ランク1拠点でエリアレベル1のダンジョンをクリア**
```
ベース個体値: 1-8（ランダム） → 仮に5
拠点ランクボーナス: +0
最終個体値: 5
```

**例2: ランク3拠点でエリアレベル3のダンジョンをクリア**
```
ベース個体値: 12-20（ランダム） → 仮に16
拠点ランクボーナス: +4
最終個体値: 20
```

**例3: ランク7拠点でエリアレベル8のダンジョンをクリア**
```
ベース個体値: 50-60（ランダム） → 仮に55
拠点ランクボーナス: +12
最終個体値: 67 → 64にクランプ
```

**例4: ランク7拠点でエリアレベル1のダンジョンを周回**
```
ベース個体値: 1-8（ランダム） → 仮に6
拠点ランクボーナス: +12
最終個体値: 18
```

### ゲームプレイへの影響

**メリット**：
1. **難易度と報酬の相関**: 難しいダンジョンほど高個体値のゴブリンが得られる
2. **拠点成長の価値**: 拠点ランクを上げれば、すべての遠征でゴブリンの質が底上げされる
3. **選択肢の多様性**:
   - 高難易度に挑戦して高個体値狙い
   - 低難易度を周回してゴブリン数を集める（個体値は低め）
   - バランスを取って中難易度を攻略

**プレイヤーの戦略**：
- **序盤**: エリアレベル1-2を周回して戦力を整える
- **中盤**: 拠点ランクを上げつつ、エリアレベル3-5に挑戦
- **終盤**: 高ランク拠点 + 高レベルエリアで最強ゴブリンを量産

## データ構造

### BaseState（拠点状態）

```typescript
interface BaseState {
  rank: number;                    // 現在の拠点ランク（1-7）
  capturedDungeons: string[];      // 制圧済みダンジョンIDのリスト
  currentMaxParties: number;       // 現在の最大パーティ数
  currentMaxGoblins: number;       // 現在の最大ゴブリン数
  currentIVBonus: number;          // 現在の個体値ボーナス
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
  ivBonus: number;
  unlockCondition: {
    dungeonId: string;             // 制圧する必要のあるダンジョンID
    clearCount?: number;           // 必要なクリア回数（デフォルト1）
  };
}
```

## 実装ロジック

### 個体値計算関数

```typescript
function calculateIndividualValue(
  areaLevel: number,
  baseRank: number,
  random: () => number
): number {
  // エリアレベルのベース範囲を取得
  const [min, max] = AREA_LEVEL_IV_RANGES[areaLevel] || [1, 8];
  const baseIV = Math.floor(min + (max - min) * random());

  // 拠点ランクボーナスを加算
  const bonus = BASE_RANK_BONUS[baseRank] || 0;
  const finalIV = baseIV + bonus;

  // 1-64にクランプ
  return Math.max(1, Math.min(64, finalIV));
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
      baseState.currentIVBonus = nextConfig.ivBonus;
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
2. 個体値計算ロジックの実装
3. ランクアップ判定ロジックの実装
4. GoblinBirthServiceへの統合

### Phase 2: UI実装
1. 拠点ランク表示画面
2. ランクアップ通知
3. ダンジョン制圧状況の表示
4. 次のランクアップ条件の表示

### Phase 3: ゲームバランス調整
1. エリアレベルの設定
2. 個体値範囲の微調整
3. ランクアップ条件の調整

### Phase 4: 拡張機能
1. 拠点ごとの特殊効果
2. 防衛システム
3. 複数拠点管理

## 関連ドキュメント

- [dungen_idea.md](./dungen_idea.md): 遠征先のアイデアとランクアップ候補
- [project_structure.md](./project_structure.md): プロジェクト構成
- [implementation_guide.md](./implementation_guide.md): 実装ガイド
