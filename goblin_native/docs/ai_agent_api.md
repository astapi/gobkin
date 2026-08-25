# AIエージェントAPI

外部AIからゲームを操作し、Expoアプリの通常UIとAI観戦画面へ操作結果を同期する開発用APIです。

Codexなどから実際にゲームを継続プレイする際は、先に [`ai_agent_playbook.md`](./ai_agent_playbook.md) の起動確認・操作ループ・終了手順を参照してください。この文書はAPIの仕様リファレンスです。

## 起動

```bash
npm run ai:bridge
npm start
```

開発時のアプリは、既定で `ws://127.0.0.1:8787/v1/game` へ接続します。設定画面の「AIエージェント」から接続状態と操作ログを確認できます。

Androidエミュレーターや実機から接続する場合は、アプリ側へブリッジURLを設定してください。

```bash
EXPO_PUBLIC_GOBLIN_AI_BRIDGE_URL=ws://10.0.2.2:8787/v1/game
```

LANへ公開する場合は、必ず共通トークンを設定します。

```bash
GOBLIN_AI_BRIDGE_HOST=0.0.0.0 \
GOBLIN_AI_BRIDGE_TOKEN=replace-with-random-token \
npm run ai:bridge

EXPO_PUBLIC_GOBLIN_AI_BRIDGE_URL=ws://192.168.1.10:8787/v1/game
EXPO_PUBLIC_GOBLIN_AI_BRIDGE_TOKEN=replace-with-random-token
```

## エンドポイント

- `GET /v1/health`: アプリ接続状態
- `GET /v1/observation`: AIへ公開可能な現在状態
- `GET /v1/legal-actions`: 操作カタログ
- `POST /v1/actions`: 操作実行。アプリ側の完了まで待って結果を返す
- `GET /v1/action-log`: 直近200件の操作結果

遠征のseedと未公開replayは `/v1/observation` に含めません。

観測データの `tutorial.step` には現在のチュートリアル段階が入り、初回遠征で
固定条件が必要な間は `tutorial.requiredExpedition` に次の設定が入ります。

```json
{
  "dungeonId": "slime_cave",
  "tier": 0,
  "targetFloor": null,
  "returnPolicy": "never"
}
```

この期間は、初回チュートリアルを完了不能にしないため、途中階帰還などの異なる
遠征設定をAPI側で拒否します。

## 操作例

### 遠征設定

```bash
curl -X POST http://127.0.0.1:8787/v1/actions \
  -H 'Content-Type: application/json' \
  -d '{
    "actionId": "configure-001",
    "reason": "現在の戦力で安全に攻略可能なため",
    "type": "configure_expedition",
    "partyId": 1,
    "dungeonId": "slime_cave",
    "tier": 0,
    "targetFloor": 10,
    "returnPolicy": "if_two_ko"
  }'
```

### 出撃

```bash
curl -X POST http://127.0.0.1:8787/v1/actions \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "遠征設定と編成を確認済み",
    "type": "start_expedition",
    "partyId": 1
  }'
```

### 編成変更

```bash
curl -X POST http://127.0.0.1:8787/v1/actions \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "set_party_members",
    "partyId": 1,
    "memberIds": [1, 2, 3, 4]
  }'
```

トークン設定時は、HTTPリクエストへ `Authorization: Bearer <token>` を追加してください。

## 同期方式

1. AIがHTTP APIへ操作を送信する
2. ブリッジがWebSocketでExpoアプリへ転送する
3. アプリが既存UseCase経由でSQLiteを更新する
4. 影響するZustand Storeを再取得する
5. 通常UIが再描画され、最新の公開状態がブリッジへ返る

同時操作はアプリ側で直列化されます。AIはHTTPレスポンスを受け取ってから次の操作を送ることを推奨します。
