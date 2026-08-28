# agent-device UI操作ガイド

agent-deviceでゴブリンレガシーの既存UIを、座標タップや表示言語に依存せず操作するための手順です。AI APIで扱えない装備変更、ゴブリン追加、チュートリアル、設定変更などに使用します。

## 安全上の注意

- UI操作は実際のSQLiteセーブデータを更新します。ユーザーから指示がない限り、初期化、追放、解雇、売却、遠征中止、セーブデータ読込は実行しません。
- 既存セーブを維持するため、確認目的でアプリをアンインストールまたは再インストールしません。
- `@e1`のような参照は画面更新で変わります。継続操作には固定`testID`を使い、画面遷移後は再度スナップショットを取得します。
- スクリーンショットは見た目、`snapshot`はアクセシビリティツリーの確認に使います。表示されているのにツリーにない要素はアクセシビリティ不備として扱います。

## 最新コードで起動する

アプリのBundle IDは`com.astapi.gobkin`です。端末名は固定せず、最初に利用可能な端末を確認します。

```bash
agent-device devices
```

コード変更後は、インストール済みアプリの古い埋め込みJSを誤って確認しないようMetroを起動し、Debugビルドを開きます。

```bash
npx expo start --dev-client --localhost
```

別のターミナルで次を実行します。端末名は`agent-device devices`の結果に合わせます。

```bash
npm run ios -- --device 'iPhone 17 Pro'
```

Metroに`iOS Bundled`が出たことを確認してから、名前付きセッションを開始します。

```bash
agent-device open com.astapi.gobkin \
  --platform ios \
  --device 'iPhone 17 Pro' \
  --session goblin-ui
```

以後のコマンドには同じ`--session goblin-ui`を付けます。終了時は必ずセッションを閉じます。

```bash
agent-device close --session goblin-ui
```

## 基本操作ループ

最初は読み取り専用のスナップショットで画面を確認します。操作対象のIDや状態が必要な場合だけ`-i --raw`を使います。

```bash
agent-device snapshot --session goblin-ui
agent-device snapshot -i -c --raw --session goblin-ui
agent-device find id start-game-button click --session goblin-ui
agent-device wait 500 --session goblin-ui
agent-device snapshot -i -c --raw --session goblin-ui
```

操作後の古い`@eN`は再利用しません。`find id`を優先し、IDが不明なときだけ最新スナップショットの`@eN`を使います。

## タブと主要導線

| 目的 | testID |
| --- | --- |
| ゲーム開始 | `start-game-button` |
| 物語タブ | `tab-story` |
| ゴブリン一覧タブ | `tab-goblin-list` |
| 遠征タブ | `tab-formation` |
| 拠点タブ | `tab-base` |
| 図鑑タブ | `tab-encyclopedia` |
| 設定タブ | `tab-settings` |

例:

```bash
agent-device find id tab-base click --session goblin-ui
agent-device find id base-menu-warehouse click --session goblin-ui
```

## 主要IDの規則

動的な行は、表示順ではなくドメインIDを末尾に付けています。実在するIDは最新の`snapshot -i -c --raw`で確認してください。

| 画面 | testIDまたはパターン |
| --- | --- |
| ゴブリン一覧 | `goblin-card-{goblinId}` |
| 一覧フィルター | `goblin-filter-open`、`goblin-filter-race-{raceId}`、`goblin-filter-job-{job}`、`goblin-filter-apply` |
| 拠点メニュー | `base-menu-grow-group`、`base-menu-warehouse`、`base-menu-healing`、`base-menu-upgrade`、`base-menu-training`、`base-menu-equipment-shop` |
| 倉庫のベース装備 | `warehouse-equipment-group-{templateId}` |
| 倉庫の装備個体 | `warehouse-equipment-variant-{equipmentId}` |
| 倉庫の装備売却 | `warehouse-equipment-detail-sell` |
| 倉庫の絞り込み結果を一括売却 | `warehouse-bulk-sell` |
| 装備商店の売却グループ | `shop-sell-equipment-group-{templateId}` |
| 装備変更のベース装備 | `equipment-group-{templateId}` |
| 所持／装備中の個体 | `inventory-equipment-{equipmentId}`、`equipped-item-{equipmentId}` |
| 共通装備フィルター | `equipment-inventory-filter-button`、`equipment-filter-*` |
| 遠征パーティ | `party-card-{partyId}` |
| 遠征準備 | `preparation-*` |
| 訓練 | `training-goblin-{goblinId}`、`training-job-{jobId}`、`training-confirm` |
| 治療 | `heal-all-button`、`heal-goblin-{goblinId}` |
| 設定 | `settings-language-{language}`、`settings-instant-exploration`、`settings-ai-agent` |

コード上の全IDを調べる場合:

```bash
rg -n 'testID=' app src/presentation --glob '*.tsx'
```

## 装備の折り畳みと称号の複数選択

ベース装備行は`expanded`状態をアクセシビリティツリーへ公開します。押した後に再スナップショットし、`value`に`expanded`が含まれることを確認します。

```bash
agent-device find id warehouse-equipment-group-sword_long click --session goblin-ui
agent-device snapshot -i -c --raw --session goblin-ui
```

装備商店の売却タブも同じ二段表示です。

```bash
agent-device find id shop-mode-sell click --session goblin-ui
agent-device find id shop-sell-equipment-group-sword_long click --session goblin-ui
agent-device snapshot -i -c --raw --session goblin-ui
```

称号はチェックボックスです。複数のIDを順番に押してから適用します。選択肢は現在の在庫に存在する称号だけ表示されます。

```bash
agent-device find id equipment-inventory-filter-button click --session goblin-ui
agent-device find id equipment-filter-title-masterwork click --session goblin-ui
agent-device find id equipment-filter-title-imbued click --session goblin-ui
agent-device snapshot -i -c --raw --session goblin-ui
agent-device find id equipment-filter-apply click --session goblin-ui
```

適用前のスナップショットで、両方の`value`が`checkbox, checked`になっていることを確認します。対象在庫に称号がなくIDが見つからない場合は、エラーを回避するためその操作を飛ばします。

## よく使う操作例

ゴブリンの装備画面を開く:

```bash
agent-device find id tab-goblin-list click --session goblin-ui
agent-device snapshot -i -c --raw --session goblin-ui
agent-device find id goblin-card-0 click --session goblin-ui
agent-device find id goblin-change-equipment click --session goblin-ui
```

遠征準備を開く:

```bash
agent-device find id tab-formation click --session goblin-ui
agent-device snapshot -i -c --raw --session goblin-ui
agent-device find id party-card-1 click --session goblin-ui
agent-device find id preparation-select-dungeon click --session goblin-ui
```

1秒探索設定の状態を確認する:

```bash
agent-device find id tab-settings click --session goblin-ui
agent-device find id settings-instant-exploration get attrs --session goblin-ui
```

状態確認だけならクリックしません。変更を依頼された場合に限り、`find id settings-instant-exploration click`を実行します。

## 破壊的なID

次のIDとパターンは確認なしに押しません。

- `root-reset-database`
- `settings-reset-data`
- `settings-backup-import`
- `goblin-banish`、`banish-goblin-{goblinId}`
- `pending-goblin-dismiss-{goblinId}`、`pending-goblins-dismiss-all`
- `expedition-abort-{partyId}`
- 売却・課金・自動売却ルール保存に関する操作

## UI実装を追加・変更するとき

- `Pressable`、`TouchableOpacity`には`accessibilityRole`、意味の分かる`accessibilityLabel`、固定`testID`を付けます。
- 選択状態は`checked`または`selected`、折り畳みは`expanded`、処理中は`busy`、操作不能は`disabled`で公開します。
- 動的IDには永続的なドメインIDを使います。翻訳文、配列の表示順、ランダム値は使いません。
- モーダル本体に`accessibilityViewIsModal`を付け、背景の閉じる領域や装飾は`accessible={false}`にします。
- モーダル本体が`Pressable`の場合も`accessible={false}`を指定し、子要素が1つの汎用要素へ統合されるのを防ぎます。
- 変更後はスクリーンショットと`agent-device snapshot -i -c --raw`を比較し、見えている操作がツリーにも個別に出ることを確認します。
