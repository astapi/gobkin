# AIエージェント プレイ手順書

Codexなどの新しいセッションが、AIエージェントAPIを使って既存セーブを継続プレイするための運用手順です。APIの型や同期方式の詳細は [`ai_agent_api.md`](./ai_agent_api.md) を参照してください。

## 重要事項

- API操作はシミュレーション専用のコピーではなく、起動中アプリのSQLiteセーブデータを実際に更新します。
- ユーザーから初期化の指示がない限り、設定画面の「データをリセット」は実行しません。
- HTTP APIだけを起動しても操作できません。AIブリッジと、ブリッジに接続したゲームアプリの両方が必要です。
- API操作は通常UI、SQLite、Zustand Storeへ同期されるため、ユーザーはアプリ画面から進行を観戦できます。
- アプリを終了するとAPIから操作できません。プレイ中はアプリを起動したままにします。

## 最短の再開手順

### 1. AIブリッジを起動する

リポジトリルートで、継続実行できるターミナルセッションを使います。

```bash
npm run ai:bridge
```

既定のHTTP URLは `http://127.0.0.1:8787`、アプリ用WebSocket URLは `ws://127.0.0.1:8787/v1/game` です。

### 2. iOS Simulatorでアプリを起動する

接続URLを組み込んだアプリが既にインストールされている場合:

```bash
xcrun simctl launch booted com.astapi.gobkin
```

未インストール、またはコード変更後に再ビルドする場合は、別ターミナルで次を実行します。

```bash
npm run ios
```

DebugビルドはURL未設定でも `127.0.0.1:8787` へ接続します。ReleaseビルドではURLを明示してビルドする必要があります。

```bash
EXPO_PUBLIC_GOBLIN_AI_BRIDGE_URL=ws://127.0.0.1:8787/v1/game \
  npx expo run:ios --configuration Release
```

環境変数はJavaScriptバンドルへ組み込まれるため、Releaseアプリの起動時に後から設定するだけでは反映されません。

### 3. 接続を確認する

```bash
curl -sS http://127.0.0.1:8787/v1/health
```

操作可能な状態:

```json
{
  "ok": true,
  "gameConnected": true,
  "hasObservation": true
}
```

`gameConnected` または `hasObservation` が `false` の間は操作を送らず、「トラブル対応」を確認します。アプリ側では、設定タブの「AIエージェント」画面から接続状態と操作ログを確認できます。

### 4. 現在状態と可能な操作を読む

新しいセッションでは、以前の会話に書かれたIDや進行状況を信用せず、必ず最新状態から判断します。

```bash
curl -sS http://127.0.0.1:8787/v1/observation
curl -sS http://127.0.0.1:8787/v1/legal-actions
```

最低限、次を確認します。

- `tutorial.step` と `tutorial.requiredExpedition`
- `base.gold`、`base.rank`、`base.capturedDungeons`
- `goblins` のID、レベル、HP
- `parties` のID、メンバー、状態、遠征設定
- `dungeons` の `unlocked`、`cleared`、`areaLevel`
- `expeditions[0]` の最新結果
- `actionCatalog` の現在利用可能な操作

## 1秒デバッグモード

設定タブの「デバッグ設定」→「探索時間を1秒にする」をONにします。この設定はAsyncStorageへ保存されるため、通常のアプリ再起動後も維持されます。アプリのデータ消去やアンインストールでは失われます。

AI APIにはこの設定を切り替える操作がありません。必要な場合はユーザーがUIで切り替えるか、端末操作ツールで設定画面のSwitchを操作します。ONの間も戦闘内容は本来の探索時間相当で計算され、表示上の帰還時間だけが1秒になります。

チュートリアル最初のスライム遠征は進行保護のため3秒固定です。チュートリアル完了後の遠征から1秒になります。

## 基本の操作ループ

操作は必ず1件ずつ送り、HTTP応答を受けてから次へ進みます。

### 1. 編成する

`/v1/observation` で確認した実在するゴブリンIDを指定します。最大6体です。

```bash
curl -sS -X POST http://127.0.0.1:8787/v1/actions \
  -H 'Content-Type: application/json' \
  -d '{
    "actionId": "party-001",
    "reason": "待機中の戦力上位6体で編成する",
    "type": "set_party_members",
    "partyId": 1,
    "memberIds": [0, 1, 2, 3, 4, 5]
  }'
```

### 2. 遠征条件を設定する

`dungeonId` は解放済みのものだけを指定します。`targetFloor: null` は最下層まで、`tier: 0` は通常難易度です。

```bash
curl -sS -X POST http://127.0.0.1:8787/v1/actions \
  -H 'Content-Type: application/json' \
  -d '{
    "actionId": "configure-001",
    "reason": "育成済みダンジョンを安全条件で周回する",
    "type": "configure_expedition",
    "partyId": 1,
    "dungeonId": "slime_cave",
    "tier": 0,
    "targetFloor": null,
    "returnPolicy": "if_two_ko"
  }'
```

帰還条件:

- `if_any_ko`: 1体でも戦闘不能で帰還
- `if_two_ko`: 2体戦闘不能で帰還
- `last_one`: 最後の1体になるまで継続
- `never`: 全滅するか踏破するまで継続

### 3. 出撃する

```bash
curl -sS -X POST http://127.0.0.1:8787/v1/actions \
  -H 'Content-Type: application/json' \
  -d '{
    "actionId": "start-001",
    "reason": "編成と遠征条件を確認済み",
    "type": "start_expedition",
    "partyId": 1
  }'
```

このHTTP応答は「出撃処理の完了」であり、「遠征の帰還完了」ではありません。1秒モードなら約2秒待ってから再観測します。通常モードでは、観測データの遠征レコードにある `returnTime` を基準に待ちます。

```bash
sleep 2
curl -sS http://127.0.0.1:8787/v1/observation
```

最新の `expeditions[0].status` が `completed` または `failed`、対象パーティの `status` が `idle` になれば帰還済みです。結果に応じて、安全なダンジョンで育成する、編成を変える、次エリアを偵察する、の順で判断します。

### 4. 操作ログを確認する

```bash
curl -sS http://127.0.0.1:8787/v1/action-log
```

`actionId` は操作ごとに一意にします。同じブリッジ起動中に同じIDを再送すると、完了済み結果が返り、二重実行を避けられます。ブリッジを再起動するとログと重複判定は消えるため、新しい接頭辞や時刻を含むIDを使います。

## チュートリアル中の制約

`tutorial.requiredExpedition` が `null` でない間は、その値をそのまま遠征設定へ使用します。現在の初回遠征条件は次のとおりです。

```json
{
  "dungeonId": "slime_cave",
  "tier": 0,
  "targetFloor": null,
  "returnPolicy": "never"
}
```

異なる設定はAPI側で拒否されます。出撃・帰還後も、チュートリアルUIで因子確認、エリア解放、ゴブリン追加などが必要な場合があります。これらはAPIの対象外なので、通常UIまたは端末操作ツールで進めます。

## APIでできること・できないこと

利用可能な操作の正本は常に `GET /v1/legal-actions` です。現在の主な操作:

- パーティ編成
- 遠征条件の設定
- 出撃、緊急帰還
- クリア済みダンジョンの自動周回切り替え
- 条件達成後の拠点ランクアップ

現在APIに含まれない主な操作:

- 産まれたゴブリンの追加・解雇
- 装備変更、売却
- チュートリアルのボタン操作
- 1秒デバッグモードの切り替え
- セーブデータの初期化、インポート、エクスポート

対象外の操作が進行に必要な場合は、アプリの通常UIを操作します。APIで無理に代替せず、UI操作後に `/v1/observation` を再取得して同期を確認します。

## 安全なプレイ方針

- 未踏破エリアは、まず低い `targetFloor` と保守的な帰還条件で偵察します。
- 全滅を避けたい場合は `if_any_ko` または `if_two_ko` を使います。
- 全滅後もゴブリンは失われませんが、次の遠征前に観測データのHPを確認します。
- 編成変更前にパーティが `idle` であることを確認します。
- ユーザーが画面を見ている場合、判断理由を `reason` に書くとAI観戦ログにも表示されます。
- 長時間の自動周回を開始する場合は、回数や終了条件を先に決めます。

## トラブル対応

### `gameConnected: false`

1. アプリが起動しているか確認する。
2. Releaseビルドなら、接続URLを設定してビルドしたか確認する。
3. アプリの設定→「AIエージェント」で再接続を実行する。
4. ブリッジ起動後、アプリは2秒間隔で再接続するため少し待って再確認する。

### `hasObservation: false`

接続直後は最初のスナップショットを待ちます。数秒経っても変わらなければ、アプリを前面に戻し、AIエージェント画面で接続状態を確認します。

### ポート8787が使用中

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
```

既存のAIブリッジなら再利用できます。別プロセスの場合は、用途を確認せず終了させないでください。別ポートを使う場合は `GOBLIN_AI_BRIDGE_PORT` とアプリ側URLの両方を揃えます。

### 操作が422で拒否される

レスポンスの `summary` を読み、最新の `/v1/observation` と `/v1/legal-actions` を再取得します。よくある原因はチュートリアル固定条件、未解放ダンジョン、遠征中パーティ、存在しないID、未解放tierです。

### 遠征時間を過ぎても `ongoing`

アプリを前面に戻して数秒待ち、再観測します。それでも完了しない場合は、UI上の遠征状態と `/v1/action-log` を確認します。進行中レコードが実在する場合だけ `abort_expedition` を検討します。

## セッション終了時

1. 最後の `/v1/observation` を取得し、進行状況と未完了遠征の有無を確認する。
2. ユーザーへ、踏破エリア、編成、主要レベル、所持金、失敗した挑戦を報告する。
3. 証跡が必要な場合は `artifacts/` 配下へレポートとスクリーンショットを保存する。
4. AIブリッジを `Ctrl+C` で終了する。
5. 端末操作ツールのセッションを使用した場合は、そのセッションも終了する。

SQLiteとAsyncStorageに保存された進行状況は、アプリをアンインストールまたはデータ消去しない限り次のセッションへ引き継がれます。

## 実装の主要ファイル

- `scripts/ai-bridge.mjs`: HTTP/WebSocketブリッジ
- `src/presentation/components/GameAgentSyncHost.tsx`: アプリ常駐接続と状態同期
- `src/presentation/agent/executeGameAgentAction.ts`: API操作の実行
- `src/core/agent/types.ts`: プロトコル型
- `src/core/agent/buildGameAgentObservation.ts`: 公開観測データの構築
- `app/ai-agent.tsx`: アプリ内の接続・観戦ログ画面
