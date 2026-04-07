# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

ゴブリンキングダムRPG — ゴブリンを管理しダンジョンへの遠征を行うモバイルゲーム。
React Native (Expo SDK 54) + TypeScript で実装。データ永続化は SQLite (expo-sqlite)。

## よく使うコマンド

```bash
# 開発サーバー起動
npm start              # expo start --port 8082

# iOS / Android 実行
npm run ios
npm run android

# テスト (Jest + ts-jest)
npm test                                          # 全テスト
npx jest src/core/services/__tests__/XxxTest.ts   # 単一テスト

# TypeScript 型チェック
npx tsc --noEmit
```

## アーキテクチャ

クリーンアーキテクチャ。`core/` はプラットフォーム非依存で将来的なUnity等への移植を想定。

```
src/
├── core/                # プラットフォーム非依存
│   ├── domain/          # エンティティ (GoblinEntity, PartyEntity, EnemyEntity)
│   ├── repositories/    # リポジトリIF (IGoblinRepository等)
│   ├── services/        # ゲームロジック (BattleSystem, ExpeditionEngine等)
│   └── usecases/        # ユースケース (StartExpeditionUseCase等)
├── infrastructure/      # データ永続化
│   ├── database/        # SQLiteスキーマ・マイグレーション
│   └── repositories/    # SQLiteリポジトリ実装 (シングルトン, getInstance())
├── presentation/        # React Native UI層
│   ├── contexts/        # AuthContext, ExpeditionStateContext, ResetContext
│   └── hooks/           # useGoblinService, usePartyService, useExpeditionFlow等
├── shared/              # 共通
│   ├── types/           # 型定義 (Goblin, Party, Expedition, Battle, Equipment, Mod, Factor等)
│   ├── data/            # マスターデータ (敵, エリア, 因子, Mod, 装備)
│   ├── constants/       # colors.ts
│   └── utils/           # 画像マッピング, ステータス計算
└── config/              # firebase.ts
```

### パスエイリアス

`@/*` → `src/*` (tsconfig.json で設定、jest.config.js でも対応済み)

### ルーティング (Expo Router, ファイルベース)

```
app/
├── _layout.tsx            # ルート: Provider初期化, DB初期化
├── (tabs)/
│   ├── _layout.tsx        # 4タブ: index(一覧), formation, base, settings
│   ├── index.tsx          # ゴブリン一覧
│   ├── base.tsx           # 拠点管理
│   ├── settings.tsx       # 設定
│   └── formation/         # 遠征フロー (ネストStack)
│       ├── index.tsx      # パーティ一覧
│       ├── preparation.tsx # ダンジョン選択
│       ├── edit.tsx       # パーティ編成
│       ├── playback.tsx   # 遠征再生
│       ├── result.tsx     # 遠征結果
│       ├── log.tsx        # 遠征ログ
│       └── battle-log.tsx # 戦闘ログ詳細
└── goblin/                # ゴブリン詳細 (ネストStack)
    ├── detail.tsx         # ゴブリン詳細
    └── equipment.tsx      # 装備変更 (モーダル)
```

### データフロー

```
画面(app/) → hooks → UseCases → Domain Entities → Repositories(IF) → SQLite実装
```

- リポジトリは全てシングルトン (`getInstance()`)、`app/_layout.tsx` で初期化
- hooks が UseCase を組成し画面にデータを提供

### コアゲームシステム

- **ExpeditionEngine**: シード値ベースの決定論的遠征シミュレーション。TimelineEvent配列を生成
- **BattleSystem**: ターン制戦闘。DamageCalculator / CombatantManager と連携
- **ModStatCalculator**: 因子・Modによる実効ステータス計算
- **ExperienceSystem**: 経験値・レベルアップ処理
- **GoblinBirthService**: ゴブリン生成・種族決定・因子継承
- **BaseRankSystem**: 拠点ランク・容量管理
- **EquipmentService / EquipmentTitleService**: 装備・称号システム

### 帰還ポリシー

遠征の帰還条件: `never`, `until_floor2`, `until_floor3`, `if_any_ko`, `if_two_ko`, `last_one`

### SQLite マイグレーション

- `infrastructure/database/migrations/` にバージョン別ファイル (v1.ts, v2.ts)
- `app_metadata` テーブルでスキーマバージョン管理
- `getDatabase()` 呼び出し時に自動マイグレーション

## 設計上の注意

- `core/` 内のコードは React Native / Expo に依存させない
- SVGファイルは `react-native-svg-transformer` 経由でコンポーネントとしてインポート可能 (metro.config.js)
- Firebase設定は `.env.local` から環境変数 `EXPO_PUBLIC_FIREBASE_*` で読み込み
- 遠征システムはシード値ベースのため、同じシードで同じ結果を再現可能

## React Native 実装ガイド（react-native-best-practices）

### 基本方針

- パフォーマンス問題は必ず **計測 → 改善 → 再計測** の順で進める。体感だけで最適化しない
- `presentation/` の改善でも、まず「再レンダー過多」「長いJS処理」「リスト描画」「入力遅延」のどれかを切り分ける
- 新しい抽象化や共通化は、可読性だけでなく起動時間・再レンダー範囲・依存サイズへの影響も見る

### UI / 再レンダー

- `ScrollView` に大量の要素を直接 `map()` する実装は避け、件数が増える一覧は `FlatList` か `FlashList` を優先する
- 固定高の行は `getItemLayout`、`FlashList` では `estimatedItemSize` を設定してレイアウト計算コストを下げる
- 画面全体の state をむやみに持ち上げず、変更頻度の高い state はできるだけ局所化する
- 重い計算やフィルタは render 中に毎回実行せず、`useMemo` や事前計算で render コストを抑える
- 入力値や選択状態の変更で一覧全体が再描画されないよう、`renderItem`・`keyExtractor`・props の安定性を保つ

### TextInput / フォーム

- `TextInput` は必要以上に完全制御しない。単純入力は `value` より `defaultValue` ベースの非制御運用を検討する
- 1文字ごとのバリデーションや整形が必要な場合だけ制御コンポーネントにする
- 検索入力などで重い処理を即時実行しない。絞り込み・検索・集計は debounce や遅延実行を挟む

### バンドル / 起動時間

- バレル export (`index.ts` でまとめて export) の乱用は避け、内部実装では直接 import を優先する
- 依存追加時は「便利か」だけでなく「bundle size / 起動時間 / ネイティブ依存の重さ」を確認する
- Android の起動速度改善のための Hermes / `noCompress` などの設定は、Expo / React Native のバージョン差異を確認してから適用する

### Native / Expo 境界

- ネイティブモジュールや重いネイティブSDK導入は最後の手段にし、まず既存の Expo / React Native 標準機能で解決できるか確認する
- ネイティブ側の重い同期処理は UI スレッドを詰まらせるため避ける。同期APIより非同期APIを優先する
- Expo managed workflow で永続化したいネイティブ設定変更は、手作業の `prebuild` 差分放置ではなく、必要なら config plugin 化も検討する

### このリポジトリで特に意識する点

- `core/` のシミュレーションや計算処理は UI スレッド体感に直結するため、画面描画中に大きな同期処理を走らせない
- 遠征ログ、戦闘ログ、ゴブリン一覧など件数が伸びる画面は、まず仮想化リスト前提で設計する
- Context は便利だが更新範囲が広がりやすい。高頻度更新データを `presentation/contexts/` に集約しすぎない
- 画像・SVG・マスターデータは「読み込みやすさ」だけでなく、初回描画コストとメモリ使用量も考慮して扱う
