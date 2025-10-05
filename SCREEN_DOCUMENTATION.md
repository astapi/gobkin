# 画面（Screen）コンポーネント ドキュメント

## 概要
このプロジェクトには、WebアプリケーションとCLIアプリケーションの両方で使用される画面コンポーネントが含まれています。

## goblin_web - Webアプリケーション画面

### 1. GoblinListScreen
**ファイル**: `/goblin_web/src/components/GoblinListScreen.tsx`

**概要**: ゴブリン一覧表示画面

**主な機能**:
- 王国のゴブリン一覧を表示
- 各ゴブリンをカード形式で表示
- ゴブリンクリック時のイベント処理

**Props**:
- `goblins`: ゴブリンの配列
- `onGoblinClick`: ゴブリンクリック時のコールバック

---

### 2. DungeonScreen
**ファイル**: `/goblin_web/src/components/DungeonScreen.tsx`

**概要**: ダンジョン選択画面

**主な機能**:
- 利用可能なダンジョン一覧の表示
- 各ダンジョンの詳細情報（階層数、探索時間、攻略状況）を表示
- ダンジョン選択による探索開始機能
- 探索時間のフォーマット表示（秒/分単位）

**Props**:
- `dungeons`: ダンジョンの配列
- `onStartExplore`: 探索開始時のコールバック

---

### 3. PartySelectScreen
**ファイル**: `/goblin_web/src/components/PartySelectScreen.tsx`

**概要**: パーティ選択画面

**主な機能**:
- 編成済みパーティの一覧表示
- 各パーティのメンバー表示
- ダンジョン情報の表示
- パーティ選択による探索開始

**Props**:
- `parties`: パーティの配列
- `goblins`: ゴブリンの配列
- `dungeon`: 選択中のダンジョン
- `onSelectParty`: パーティ選択時のコールバック
- `onBack`: 戻るボタンのコールバック

---

### 4. ExpeditionResultScreen
**ファイル**: `/goblin_web/src/components/ExpeditionResultScreen.tsx`

**概要**: 遠征結果表示画面

**主な機能**:
- 遠征の成功/失敗表示
- 獲得経験値のアニメーション表示
- 戦利品の順次表示アニメーション
- 捕獲成功情報の表示
- パーティメンバーの状態表示（無事/負傷/戦闘不能）
- 新エリア解放通知

**Props**:
- `expeditionReplay`: 遠征リプレイデータ
- `goblins`: ゴブリンの配列
- `onBackToMenu`: メニューに戻るコールバック

**アニメーション機能**:
- 経験値カウントアップ（1秒）
- アイテム順次表示（0.2秒間隔）
- 捕獲エフェクト（パルスアニメーション）

---

### 5. ExpeditionPlaybackScreen
**ファイル**: `/goblin_web/src/components/ExpeditionPlaybackScreen.tsx`

**概要**: 遠征リプレイ再生画面

**主な機能**:
- 遠征のリアルタイム再生
- 再生速度調整（1x, 2x, 4x）
- イベントログのリアルタイム表示
- パーティメンバーのHP表示
- 進行状況バー
- スキップ機能
- 緊急帰還機能

**Props**:
- `expeditionReplay`: 遠征リプレイデータ
- `goblins`: ゴブリンの配列
- `onComplete`: 再生完了時のコールバック

**イベントタイプ**:
- `move_start`: 階層探索開始
- `floor_up`: 階層移動
- `battle`/`boss`: 戦闘イベント
- `resource`: 資源発見
- `trap`: 罠
- `return`: 帰還

---

### 6. PartyEditScreen
**ファイル**: `/goblin_web/src/components/PartyEditScreen.tsx`

**概要**: パーティ編成画面

**主な機能**:
- パーティメンバーの編成（最大6人）
- メンバーの追加/削除
- 遠征中パーティの編成制限
- 利用可能なゴブリン一覧表示
- スロット選択による直感的な編成

**Props**:
- `partyId`: パーティID
- `goblins`: ゴブリンの配列
- `partyRepository`: パーティリポジトリ
- `onBack`: 戻るボタンのコールバック

**編成制限**:
- 遠征中のパーティは編成不可
- 既にパーティに所属しているゴブリンは選択不可

---

### 7. ExpeditionSetupScreen
**ファイル**: `/goblin_web/src/components/ExpeditionSetupScreen.tsx`

**概要**: 遠征設定画面

**主な機能**:
- パーティ選択
- 帰還条件の設定
- 探索予測情報の表示
- 推定探索時間の計算
- パーティ戦力の計算と難易度表示

**Props**:
- `parties`: パーティの配列
- `goblins`: ゴブリンの配列
- `dungeon`: 選択中のダンジョン
- `onStartExpedition`: 遠征開始時のコールバック
- `onBack`: 戻るボタンのコールバック

**帰還条件オプション**:
- `never`: 最後まで探索
- `until_floor2`: 2階で帰還
- `until_floor3`: 3階で帰還
- `if_any_ko`: 誰か倒れたら帰還
- `last_one`: 最後の1人になったら帰還

---

### 8. FormationScreen
**ファイル**: `/goblin_web/src/components/FormationScreen.tsx`

**概要**: パーティ管理総合画面

**主な機能**:
- 全パーティの一覧表示
- パーティメンバーの詳細表示（レベル、HP）
- 遠征履歴の表示
- 進行中の遠征状態表示
- 履歴からのリプレイ再生

**Props**:
- `partyRepository`: パーティリポジトリ
- `goblins`: ゴブリンの配列
- `onPartySelect`: パーティ選択時のコールバック
- `onExpeditionPartyClick`: 遠征中パーティクリック時のコールバック
- `onHistoryClick`: 履歴クリック時のコールバック
- `isLoading`: ローディング状態
- `isPartyInExpedition`: パーティ遠征中判定関数

**履歴管理**:
- 各パーティごとの遠征履歴
- 進行中/完了済みの区別
- リプレイ可能な履歴の識別

---

## goblin_ink - CLIアプリケーション画面

### 1. BattleScreen
**ファイル**: `/goblin_ink/src/components/BattleScreen.tsx`

**概要**: ターン制バトル画面（CLI）

**主な機能**:
- ターン制コマンドバトル
- コマンド選択フェーズ
- アクション実行フェーズ
- バトル結果判定
- 逃走コマンド対応

**コンポーネント構成**:
- `StatusPanel`: HP/ステータス表示
- `CommandMenu`: コマンド選択メニュー
- `BattleLog`: 戦闘ログ表示
- `ResultScreen`: 結果画面への遷移

**ゲームフェーズ**:
- `command_selection`: コマンド選択中
- `action_execution`: アクション実行中
- `battle_result`: バトル終了

---

### 2. ResultScreen
**ファイル**: `/goblin_ink/src/components/ResultScreen.tsx`

**概要**: バトル結果表示画面（CLI）

**主な機能**:
- 勝利/敗北/逃走の結果表示
- 報酬表示（EXP、ゴールド、アイテム）
- 最終ターン数の表示
- 結果に応じたメッセージ表示

**Props**:
- `battleState`: バトル状態
- `onExit`: 終了時のコールバック

**結果タイプ**:
- 勝利: 報酬獲得、励ましメッセージ
- 敗北: 再挑戦を促すメッセージ
- 逃走: 撤退の意義を説明

---

## 共通パターンと設計思想

### UI/UXパターン
1. **階層型ナビゲーション**: 戻るボタンによる画面遷移
2. **プログレッシブディスクロージャー**: 段階的な情報表示
3. **視覚的フィードバック**: ホバー効果、選択状態の明確化
4. **アニメーション**: ユーザー体験向上のための適切なアニメーション

### 状態管理
1. **ローカル状態**: 各画面で独立した状態管理
2. **Props駆動**: 親コンポーネントからのデータ受け渡し
3. **イベントハンドリング**: コールバックによる親への通知

### レスポンシブデザイン
- グリッドレイアウトによる柔軟な配置
- オーバーフロー制御によるスクロール対応
- 画面サイズに応じた適切なコンポーネント配置

### アクセシビリティ
- 明確な視覚的階層
- 適切な色コントラスト
- 状態変化の明確な表示

## 技術スタック

### Web (goblin_web)
- **Framework**: React with TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: React Hooks (useState, useEffect)
- **アニメーション**: CSS Transitions, RequestAnimationFrame

### CLI (goblin_ink)
- **Framework**: React with Ink (Terminal UI)
- **インタラクション**: useInput Hook
- **レイアウト**: Flexbox (Ink Box component)
- **スタイリング**: Ink内蔵スタイルプロパティ

## まとめ
このプロジェクトの画面コンポーネントは、ゴブリンの管理、ダンジョン探索、パーティ編成、遠征実行という主要機能を提供しています。Web版とCLI版で異なるユーザーインターフェースを提供しながら、同様のゲームロジックを実装している点が特徴的です。