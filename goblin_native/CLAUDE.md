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
