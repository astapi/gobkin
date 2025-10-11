# ビルドエラー分析と修正計画

**作成日**: 2025-10-11
**最終更新**: 2025-10-11
**ステータス**: 修正中（12件残存）
**総エラー数**: 55件 → 29件 → 17件 → 12件

## エラー概要

goblin_webプロジェクトのビルドで当初55件のTypeScriptエラーが発生していました。
一部修正済みで、現在29件のエラーが残存しています。

### 現在の残存エラー（12件）
1. ✅ ~~装備システム未実装~~ → 修正完了
2. ✅ ~~equipmentフィールド未初期化~~ → 修正完了
3. ✅ ~~**Repository問題**: 2件（setOnDataChangeメソッド）~~ → 修正完了（エラーなし）
4. ✅ ~~**型不整合**: 3件（Party ID、ExpeditionPreparationScreen）~~ → 修正完了
5. **テストコード**: 7件（importパスと型注釈）
6. **未使用変数**: 3件
7. **verbatimModuleSyntax違反**: 1件（AuthContext）
8. **ExpeditionEndReason型**: 1件（ExpeditionEngine.ts）← カテゴリ4に含まれていたが未修正

以下、エラーの詳細をカテゴリ別に説明します：

### 1. 型定義の不整合（最も重大）

#### 1.1 TimelineEvent型のtrapイベント（✅ 修正済み）
**修正内容**: `trap`イベントは型定義から削除され、実装コードからも除去されました。

---

#### 1.2 ExpeditionEndReason型の定義問題（⚠️ 一部残存）
**影響ファイル**:
- `src/core/ExpeditionEngine.ts` (1件) ← **残存**

**エラー内容**:
```
error TS2322: Type '"until_floor2" | "until_floor3" | "if_any_ko" | "if_two_ko" | "last_one" | "never"'
  is not assignable to type 'ExpeditionEndReason'.
```

**原因**: `ExpeditionEndReason`型は定義されているが、`returnPolicy`の値を直接`ExpeditionEndReason`として代入しようとしている箇所がある。

**修正方法**:
`ExpeditionEngine.ts:233`付近で、returnPolicyを適切にExpeditionEndReasonに変換するロジックを追加する必要がある。

---

#### 1.3 Dungeon型のunlockNextプロパティ（✅ 修正済み）
**修正内容**: `Dungeon`型に`unlockNext?: string`フィールドが追加されました。

---

### 2. 装備機能の実装不足（重大）

#### 2.1 JsonGoblinRepositoryImplに装備メソッドが未実装（✅ 修正済み）
**修正内容**:
`JsonGoblinRepositoryImpl`に`equipItem`と`unequipItem`メソッドを実装しました：
```typescript
equipItem(goblinId: number, slotIndex: number, itemId: string): void {
  const goblin = this.getGoblin(goblinId)
  if (goblin) {
    goblin.equipment[slotIndex] = { slotIndex, itemId }
    this.saveGoblin(goblin)
  }
}

unequipItem(goblinId: number, slotIndex: number): void {
  const goblin = this.getGoblin(goblinId)
  if (goblin) {
    goblin.equipment[slotIndex] = { slotIndex, itemId: null }
    this.saveGoblin(goblin)
  }
}
```

**注**: `GoblinDetailModal.tsx`の`setOnDataChange`エラーは別途対応が必要（2.3参照）

---

#### 2.2 Goblin型のequipmentフィールドが未初期化（✅ 修正済み）
**修正内容**:
全てのゴブリンデータに`equipment`フィールドを追加しました：
```typescript
equipment: [
  { slotIndex: 0, itemId: null },
  { slotIndex: 1, itemId: null },
  { slotIndex: 2, itemId: null }
]
```

**修正ファイル**:
- `src/repositories/JsonGoblinRepositoryImpl.ts` (5体のゴブリン)
- `src/core/ExpeditionEngine.ts` (戦闘時の一時ゴブリン)
- `src/services/ExpeditionEngine.test.ts` (テスト用ゴブリン2体)

---

#### 2.3 ItemRepositoryに存在しないメソッドを呼び出し（✅ 修正済み）
**修正内容**: 実際にはこのエラーは発生していませんでした。`GoblinDetailModal.tsx`には`setOnDataChange`の呼び出しは存在しません。

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

### 5. 型アサーションエラー（中程度）（✅ 修正済み）

#### 5.1 Party IDの型不一致（✅ 修正済み）
**修正内容**:
`PartyRepository.updateDungeonSettings`メソッドの引数`dungeonId`の型を`number`から`string`に変更しました。
- `PartyRepository.ts`: `updateDungeonSettings(id: number, dungeonId: string)`
- `FirestorePartyRepositoryImpl.ts`: 同様に修正
- `JsonPartyRepositoryImpl.ts`: 同様に修正

**原因**: `Dungeon.id`と`Party.dungeonId`は`string`型でしたが、メソッドは`number`を受け取っていました。

---

#### 5.2 ExpeditionPreparationScreenの型エラー（✅ 修正済み）
**修正内容**: 上記5.1の修正により、`ExpeditionPreparationScreen.tsx:36`の`dungeon.id`（`string`型）を`updateDungeonSettings`に渡す際のエラーも解消されました。

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
4. ✅ Goblin型の`equipment`フィールド初期化
   - 全てのゴブリンデータに`equipment`フィールドを追加完了
5. ✅ JsonGoblinRepositoryImplに装備メソッド実装
   - `equipItem`と`unequipItem`メソッドを実装完了

### 高優先（機能動作に影響）
6. ✅ ItemRepository/GoblinRepositoryの`setOnDataChange`問題解決 → エラーなし
7. ✅ Party IDの型統一 → 修正完了
   - `PartyRepository.updateDungeonSettings`の引数型を`string`に変更
   - `src/repositories/FirestorePartyRepositoryImpl.ts` 修正完了
   - `src/repositories/JsonPartyRepositoryImpl.ts` 修正完了
8. ✅ ExpeditionPreparationScreenの型エラー修正 → 修正完了
   - `dungeon.id`（string）を`updateDungeonSettings`に渡す際のエラーを解消

### 中優先（品質向上）
9. ❌ verbatimModuleSyntax違反の修正（AuthContext）（1件残存）
10. ❌ テストコードのimportパス修正（7件残存）
    - `src/services/ExpeditionEngine.test.ts`
    - importパス変更 + 型注釈追加が必要

### 低優先（コード品質）
11. ❌ 未使用変数の削除またはリネーム（3件残存）
    - `processedEvents` (ExpeditionLogScreen.tsx)
    - `previousTargetHP` (battle.ts)
    - `isExpeditionOngoing` (FirestoreExpeditionRepositoryImpl.ts)

---

## 修正作業の推定時間

### 完了済み
- TimelineEvent型の修正（trap削除）
- ExpeditionEndReason型の導入
- Dungeon型へのunlockNext追加

### 残作業の推定時間
- **最優先タスク（4-5）**: 約1-2時間
  - equipmentフィールド初期化（機械的作業）
  - 装備メソッド実装（ロジック実装）
- **高優先タスク（6-8）**: 約1-2時間
  - setOnDataChange削除または実装
  - Party ID型統一
  - ExpeditionPreparationScreen修正
- **中優先タスク（9-10）**: 約30分
  - import文修正（機械的作業）
  - テストコード修正
- **低優先タスク（11）**: 約15分
  - 未使用変数削除

**残作業合計**: 約3-4時間

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
