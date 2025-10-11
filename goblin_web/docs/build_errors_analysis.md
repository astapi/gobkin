# ビルドエラー分析と修正計画

**作成日**: 2025-10-11
**ステータス**: 未修正
**総エラー数**: 55件

## エラー概要

goblin_webプロジェクトのビルドで55件のTypeScriptエラーが発生しています。これらは以下のカテゴリに分類されます：

### 1. 型定義の不整合（最も重大）

#### 1.1 TimelineEvent型に`trap`イベントが不足
**影響ファイル**:
- `src/components/ExpeditionLogScreen.tsx` (8件)
- `src/components/ExpeditionPlaybackScreen.tsx` (8件)

**エラー内容**:
```
error TS2678: Type '"trap"' is not comparable to type '"move_start" | "floor_up" | "battle" | "boss" | "resource" | "exploring" | "return"'.
```

**原因**: `src/shared/types/Expedition.ts`の`TimelineEvent`型に`trap`イベントタイプが定義されていないが、実装コードでは使用されている。

**修正方法**:
`TimelineEvent`型に以下を追加：
```typescript
| { type: "trap"; at: number; floor: number; trapId: string }
```

---

#### 1.2 ExpeditionRequest["returnPolicy"]型に終了理由が不足
**影響ファイル**:
- `src/components/ExpeditionLogScreen.tsx` (4件)
- `src/components/ExpeditionPlaybackScreen.tsx` (5件)

**エラー内容**:
```
error TS2678: Type '"boss_clear"' is not comparable to type '"until_floor2" | "until_floor3" | "if_any_ko" | "if_two_ko" | "last_one" | "never"'.
error TS2678: Type '"until_floorN"' is not comparable to type ...
error TS2678: Type '"lose"' is not comparable to type ...
error TS2678: Type '"abort"' is not comparable to type ...
```

**原因**: `returnPolicy`は遠征開始時の設定値であり、遠征終了理由（`boss_clear`, `lose`, `abort`等）とは別の概念。`TimelineEvent`の`return`イベントの`reason`フィールドで混同されている。

**修正方法**:
1. 新しい型`ExpeditionEndReason`を定義：
```typescript
export type ExpeditionEndReason =
  | "boss_clear"      // ボスクリア
  | "until_floor2"    // 2階到達
  | "until_floor3"    // 3階到達
  | "until_floorN"    // N階到達（汎用）
  | "if_any_ko"       // 1人でも倒れた
  | "if_two_ko"       // 2人倒れた
  | "last_one"        // 最後の1人
  | "lose"            // 全滅
  | "abort"           // 中断
  | "never"           // 最後まで探索
```

2. `TimelineEvent`の`return`イベントを修正：
```typescript
| { type: "return"; at: number; reason: ExpeditionEndReason }
```

---

#### 1.3 Dungeon型に`unlockNext`プロパティが不足
**影響ファイル**:
- `src/components/ExpeditionResultScreen.tsx` (2件)

**エラー内容**:
```
error TS2339: Property 'unlockNext' does not exist on type 'Dungeon'.
```

**原因**: `src/shared/types/Dungeon.ts`の`Dungeon`型に`unlockNext`フィールドがない。`AreaConfig`には存在するが、`Dungeon`とは別の型として扱われている。

**修正方法**:
`Dungeon`型に以下を追加：
```typescript
unlockNext?: string
```

---

### 2. 装備機能の実装不足（重大）

#### 2.1 JsonGoblinRepositoryImplに装備メソッドが未実装
**影響ファイル**:
- `src/repositories/JsonGoblinRepositoryImpl.ts` (1件 + 実装エラー7件)
- `src/hooks/useGoblinRepository.ts` (1件)
- `src/components/GoblinDetailModal.tsx` (2件)

**エラー内容**:
```
error TS2420: Class 'JsonGoblinRepositoryImpl' incorrectly implements interface 'GoblinRepository'.
  Type 'JsonGoblinRepositoryImpl' is missing the following properties from type 'GoblinRepository': equipItem, unequipItem
```

**原因**: `GoblinRepository`インターフェースに`equipItem`と`unequipItem`メソッドが追加されたが、`JsonGoblinRepositoryImpl`に実装されていない。

**修正方法**:
`JsonGoblinRepositoryImpl`に以下のメソッドを追加実装：
```typescript
equipItem(goblinId: number, slotIndex: number, itemId: string): void {
  // 実装
}

unequipItem(goblinId: number, slotIndex: number): void {
  // 実装
}
```

---

#### 2.2 Goblin型のequipmentフィールドが未初期化
**影響ファイル**:
- `src/repositories/JsonGoblinRepositoryImpl.ts` (5件)
- `src/core/ExpeditionEngine.ts` (1件)
- `src/services/ExpeditionEngine.test.ts` (2件)

**エラー内容**:
```
error TS2741: Property 'equipment' is missing in type '{ id: number; name: string; ... }' but required in type 'Goblin'.
```

**原因**: 既存のゴブリンデータオブジェクトに`equipment`フィールドが含まれていない。

**修正方法**:
1. `JsonGoblinRepositoryImpl.ts`のゴブリンデータに`equipment`フィールドを追加
2. `ExpeditionEngine.ts`のテストデータにも追加
3. デフォルト値として`[null, null, null]`を設定

---

#### 2.3 ItemRepositoryに存在しないメソッドを呼び出し
**影響ファイル**:
- `src/components/GoblinDetailModal.tsx` (2件)

**エラー内容**:
```
error TS2339: Property 'setOnDataChange' does not exist on type 'ItemRepository'.
error TS2339: Property 'setOnDataChange' does not exist on type 'GoblinRepository'.
```

**原因**: `setOnDataChange`メソッドが`ItemRepository`および`GoblinRepository`インターフェースに定義されていない。

**修正方法**:
1. 該当のコードを削除（不要な場合）
2. または、必要な場合はリポジトリインターフェースにメソッドを追加

---

### 3. TypeScriptの設定関連（中程度）

#### 3.1 verbatimModuleSyntax違反
**影響ファイル**:
- `src/contexts/AuthContext.tsx` (1件)

**エラー内容**:
```
error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```

**原因**: `ReactNode`は型として使用されているが、通常のimportで読み込まれている。

**修正方法**:
```typescript
// 修正前
import { ReactNode } from 'react'

// 修正後
import type { ReactNode } from 'react'
```

---

### 4. 未使用変数（軽微）

**影響ファイル**:
- `src/components/ExpeditionLogScreen.tsx` (1件: `processedEvents`)
- `src/core/battle.ts` (1件: `previousTargetHP`)
- `src/repositories/FirestoreExpeditionRepositoryImpl.ts` (1件: `isExpeditionOngoing`)

**エラー内容**:
```
error TS6133: 'xxx' is declared but its value is never read.
```

**修正方法**: 変数の削除、またはプレフィックス`_`を付けて未使用を明示

---

### 5. 型アサーションエラー（中程度）

#### 5.1 Party IDの型不一致
**影響ファイル**:
- `src/repositories/FirestorePartyRepositoryImpl.ts` (1件)
- `src/repositories/JsonPartyRepositoryImpl.ts` (1件)

**エラー内容**:
```
error TS2322: Type 'number' is not assignable to type 'string'.
```

**原因**: `partyId`の型が`number`と`string`で不一致。

**修正方法**: `Party`型の`id`フィールドの型を確認し、統一する。

---

#### 5.2 ExpeditionPreparationScreenの型エラー
**影響ファイル**:
- `src/components/ExpeditionPreparationScreen.tsx` (1件)

**エラー内容**: エラーメッセージが切れているため、ファイルを確認する必要あり。

---

### 6. テストコード関連（軽微）

**影響ファイル**:
- `src/services/ExpeditionEngine.test.ts` (7件)

**エラー内容**:
```
error TS2307: Cannot find module './ExpeditionEngine.ts' or its corresponding type declarations.
error TS7006: Parameter 'xxx' implicitly has an 'any' type.
```

**原因**:
1. ExpeditionEngineが`src/services/`から`src/core/`に移動された
2. 型注釈が不足

**修正方法**:
1. importパスを`'../core/ExpeditionEngine'`に修正
2. パラメータに適切な型注釈を追加

---

## 修正優先順位

### 最優先（ビルドを通すために必須）
1. ✅ TimelineEvent型に`trap`イベント追加
2. ✅ ExpeditionEndReason型の導入とTimelineEvent修正
3. ✅ Dungeon型に`unlockNext`追加
4. ✅ Goblin型の`equipment`フィールド初期化
5. ✅ JsonGoblinRepositoryImplに装備メソッド実装

### 高優先（機能動作に影響）
6. ✅ ItemRepository/GoblinRepositoryの`setOnDataChange`問題解決
7. ✅ Party IDの型統一
8. ✅ ExpeditionPreparationScreenの型エラー修正

### 中優先（品質向上）
9. ✅ verbatimModuleSyntax違反の修正（AuthContext）
10. ✅ テストコードのimportパス修正

### 低優先（コード品質）
11. ✅ 未使用変数の削除またはリネーム

---

## 修正作業の推定時間

- **最優先タスク（1-5）**: 約2-3時間
- **高優先タスク（6-8）**: 約1-2時間
- **中優先タスク（9-10）**: 約30分
- **低優先タスク（11）**: 約15分

**合計**: 約4-6時間

---

## 注意事項

### 設計上の課題
1. **returnPolicyと終了理由の混同**: 設計レベルで`returnPolicy`（事前設定）と`endReason`（結果）が混同されている。これは型システムだけでなく、ドメインモデルの再設計が必要かもしれない。

2. **DungeonとAreaConfigの重複**: `Dungeon`型と`AreaConfig`型が似た情報を持っているが、統合されていない。将来的に統一を検討すべき。

3. **Repository実装の分岐**: `JsonRepositoryImpl`と`FirestoreRepositoryImpl`の両方を常に同期させる必要があり、メンテナンスコストが高い。

### リファクタリング後の影響
最近のリファクタリング（Phase 1）で型定義が`shared/types/`に移動されたが、以下が未完了：
- テストコードのimportパス更新
- 装備機能の完全な実装
- イベント型の拡張

---

## 関連ドキュメント
- [アーキテクチャ設計](architecture.md)
- [リファクタリング計画](refactoring_plan.md)
