# 遠征システム 仕様書 v0.9

最終更新: 2025-08-13
作成者: ChatGPT（GPT-5 Thinking）

---

## 0. 目的と背景

本仕様は、ゴブリン集落を題材にしたゲームにおける**遠征（Expedition）**機能の振る舞い・データ構造・UI/UX・API・テレメトリを定義する。遠征は**出発時に結果を完全に決定**し、クライアント側では**タイムラインを再生**して表示する（プリコンピュート方式）。

---

## 1. スコープ

* 遠征の作成/再生/結果確定までの一連の体験。
* PT（パーティ）編成・帰還条件・遠征先（エリア）選択。
* イベント抽選（戦闘/資源/罠/NPC/階層遷移/ボス/帰還）の決定ロジック。
* 自動戦闘の簡易解決式。
* 報酬/捕獲/負傷の確定。
* UI/HUD・ログの再生仕様。
* APIとデータモデル、永続化、テレメトリ、テスト方針。

### 非スコープ

* 詳細なバトル演出・アニメーションの仕様。
* 拠点内の経営/建築/繁殖の個別UI。
* 課金/広告/ソーシャル連携。

---

## 2. 用語定義

* **PT（Party）**: 遠征に出る最大6体のユニット。
* **エリア（Area/Dungeon）**: 遠征先。複数の階層（Floor）を持つ。
* **イベント**: 遭遇（戦闘/資源/罠/NPC）、階層上昇、ボス戦、帰還等。
* **タイムライン**: `at`（相対秒）つきイベントの配列。クライアントはこれを再生。
* **プリコンピュート**: 出発リクエスト時にサーバで全結果を決め、`ExpeditionReplay` を返す方式。

---

## 3. ユースケース

1. プレイヤーがPTを編成し、エリアと帰還条件を選択して出発。
2. クライアントが`ExpeditionReplay`を受け取り、30〜150秒等の進行バーとログを再生。
3. 途中で手動中断（Abort）すると、その時点までのイベントで結果確定。
4. 速度変更（×1/×2/スキップ）しても結果は不変。

---

## 4. UI/UX 仕様

### 4.1 遠征設定画面

* **入力**: PT選択（最大6）、エリア選択、帰還条件（下記）、推奨戦力/所要時間表示。
* **帰還条件**:

  * `until_floorN`（例: 2Fまで）
  * `if_any_ko`（1人でも戦闘不能）
  * `last_one`（最後の1人になったら）
  * `never`（帰還しない）
* **バリデーション**: PT空/重複/死者含む/捕獲枠過少 等。

### 4.2 遠征中HUD（再生）

* 進行バー: `elapsed / durationSec`。
* 現在F、イベントアイコン（戦/資/罠/NPC/ボス）。
* PT HP/状態異常のサマリ、残人数、捕獲枠、積載枠（任意）。
* ログ: タイムラインのイベントごとに1行以上出力。
* 操作: **速度×1/×2/×4**, **スキップ**, **緊急帰還（Abort）**。

### 4.3 結果画面

* 成功/失敗、到達F、撃破/捕獲/戦利品/経験値、負傷/死亡、次の解放情報。

---

## 5. システム動作概要

* 出発時、サーバは以下を**一度だけ**実行：

  1. 乱数シード確定（ユーザーID・PT・エリア・サーバ秘密・時刻で導出）。
  2. フロアとイベントの**時刻スロット**を生成（ピティタイマーあり）。
  3. 各イベントを**重み抽選**し、戦闘・戦利品・捕獲・負傷・帰還挿入まで**完全確定**。
  4. `ExpeditionReplay` を返す。
* クライアントはタイムラインを**再生**。オフラインでも再生可能。

### 5.1 ステートマシン

```
Idle → Preparing → Playing (Traveling/Encounter 再生)
  Playing ── skip/完走 → Result
  Playing ── abort       → Result (部分集計)
```

---

## 6. データモデル（型定義）

```ts
// リクエスト
export interface ExpeditionRequest {
  partyId: string;
  areaId: string;
  returnPolicy: "until_floor2" | "if_any_ko" | "last_one" | "never";
  clientVersion: string;
}

// 応答（再生用）
export interface ExpeditionReplay {
  meta: {
    expeditionId: string;
    areaId: string;
    areaName: string;
    floors: number;
    baseDurationSec: number;
    party: string[]; // メンバーID
    returnPolicy: ExpeditionRequest["returnPolicy"];
    seed: number;
    serverCommitHash?: string; // 公平性コミット
  };
  durationSec: number;
  events: TimelineEvent[]; // 0 <= at <= durationSec
  summary: RewardSummary;  // 完走時サマリ
}

type TimelineEvent =
  | { type: "move_start"; at: number; floor: number }
  | { type: "floor_up"; at: number; from: number; to: number }
  | { type: "battle"; at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number; drops: Drop[] }
  | { type: "boss";   at: number; floor: number; enemy: EnemySnap; combat: CombatReplay; xp: number; drops: Drop[] }
  | { type: "resource"; at: number; floor: number; loot: Drop[] }
  | { type: "trap"; at: number; floor: number; trapId: string; effect: Record<string, unknown> }
  | { type: "return"; at: number; reason: "until_floorN"|"if_any_ko"|"last_one"|"boss_clear"|"abort"|"lose" };

export interface EnemySnap { id: string; name: string; lvl: number; count: number }
export interface Drop { id: string; qty: number }
export interface CombatReplay {
  rounds: number;                    // 表示用
  outcome: "win" | "lose" | "escape";
  allyHPDelta: number[];             // 各メンバーの被ダメ合計（負号）
  enemyDefeated: number;
  capture?: { eligible: boolean; success?: boolean; rate?: number; captured?: Drop };
}

export interface RewardSummary {
  success: boolean;
  maxFloorReached: number;
  xpGained: number;
  loot: Drop[];
  captures: Drop[];
  casualties: string[];              // 死亡ID
  injuries: string[];                // 負傷ID
}
```

### 6.1 エリア定義

```ts
export interface AreaConfig {
  id: string;
  name: string;
  floors: number;              // 例: 3
  baseDurationSec: number;     // 例: 30
  encounter: {
    perFloorEvents: number;    // 例: 2（各階のイベント数）
    eventWeights: { battle: number; resource: number; trap: number; npc: number };
  };
  enemyTable: { id: string; weight: number; lvl: number }[];
  boss: { id: string; lvl: number };
  rewards: {
    xpFloor: number[];         // 各階のベースXP
    xpBoss: number;            // ボスXP
    lootPool: { id: string; w: number }[]; // 重み抽選
    captureBonus: number;      // 捕獲ベース補正
  };
  unlockNext?: string;         // クリアで解放
}
```

### 6.2 PT補正

```ts
export interface PartySnapshot {
  members: string[];                // ユニットID
  returnPolicy: ExpeditionRequest["returnPolicy"];
  foodSupply: number;               // 消耗係数 1.0=基準
  speedMod: number;                 // 移動速度補正（短縮）
  luckMod: number;                  // ドロップ/捕獲補正
  captureSlots: number;             // 捕獲枠
  carryWeight: number;              // 積載枠（任意）
  powerRating: number;              // 総戦力P（事前計算）
}
```

---

## 7. 乱数・公平性

* **シード**: `seed = HMAC(serverSecret, userId|partyHash|areaId|timestamp)`
* **コミット**: `serverCommitHash = sha256(seed + expeditionId + serverSecret)` をメタに保存。トラブル時の検証に使用。
* **リロール対策**: 出発にスタミナ/時間コスト、同一パラメータへのクールダウン、日単位の最大リプレイ生成数など。

---

## 8. イベント生成

1. 総時間 `T = baseDurationSec / party.speedMod`。
2. 階層ごとに `perFloorEvents` 個のスロットを等分し `±jit` でジッター配置。
3. 各スロットで `eventWeights` から種別抽選。`battle` の場合は `enemyTable` から重み抽選。階層F補正 `w' = w * (1 + 0.1*F)`。
4. 戦闘は**自動解決**（下記）。結果によりHP損耗・KO・捕獲・ドロップ・XPを確定。
5. 帰還条件判定：成立時点で `return` を挿入し、その後のイベント生成を停止。
6. 最深部では**必ずボス戦**→勝敗確定→`return` 追加。

---

## 9. 自動戦闘の簡易解決式（推奨初期値）

* PT総戦力 `P`、敵戦力 `E`、難易度スケール `σ = 15`。
* **勝率**: `WinProb = 1 / (1 + exp(-(P - E) / σ))`
* 乱数 `r∈[0,1)` を引き、`r < WinProb` で勝利。
* **被害率**: 勝利時 `d = clamp(E/P * U(0.6,1.0), 0.1, 0.8)`、敗北時は全滅 or 大損害。
* 被ダメ配分: 前衛>後衛の重みで分配。`allyHPDelta[i] = -⌈d * hpBase[i] * w[i]⌉`。
* **KO/死亡**: HP≤0でKO。敵が「止め」特性なら `p_death` で死亡。
* **捕獲率**: 勝利かつ捕獲可能時のみ、`p = base + party.luckMod*bonus - enemyResist` を `[0.01..0.5]` にクランプ。
* **ドロップ**: `lootPool` を重み抽選、`luckMod` で上位品に補正。
* **XP**: `xp_floor[F]` を戦闘/イベントごとに付与、ボス勝利で `xpBoss` 追加。KO中は50%。

> これらは**調整ノブ**としてパラメータ化（§14）。

---

## 10. 帰還条件

* `until_floorN`: 指定Fのイベント解決後、`return(reason: "until_floorN")` を挿入。
* `if_any_ko`: いずれかKO発生直後に `return("if_any_ko")`。
* `last_one`: 生存者が1体になった瞬間に `return("last_one")`。
* `never`: ボス決着または全滅まで継続。敗北時 `return("lose")`。

**優先順位**: `abort`（手動） > `last_one` > `if_any_ko` > `until_floorN` > `boss_clear/lose`。

---

## 11. 報酬・捕獲・負傷

* **報酬**: `summary.loot`, `summary.xpGained` に集計。積載枠超過時は低レアから自動破棄（任意）。
* **捕獲**: `captureSlots` 上限。枠が尽きると以降の捕獲成功は自動棄却。
* **負傷**: `summary.injuries` にIDを格納し、所定の治療時間を付与。
* **死亡**: `summary.casualties`。蘇生手段がない限りPTから除籍。

---

## 12. 再生・速度・スキップ

* `durationSec` は表示上の総時間。速度×1/×2/×4に対応。
* **スキップ**はイベントをサイレント適用し、即座に結果画面へ。
* **バックグラウンド復帰**時は `elapsed` を計算し、残りを一気にキャッチアップ再生。

---

## 13. 永続化（RDB想定）

* `expeditions`: `id(PK)`, `user_id`, `area_id`, `party_snapshot(json)`, `seed`, `duration_sec`, `summary(json)`, `created_at`。
* `expedition_events`: `expedition_id(FK)`, `seq`, `at`, `type`, `payload(json)`。
* `indexes`: `user_id+created_at`, `expedition_id+seq`。
* 保存期間: 30〜90日（テレメトリ要件に応じ調整）。

---

## 14. API 設計

### 14.1 POST /expeditions

**説明**: 遠征を作成し、リプレイを返す。

**Request**: `ExpeditionRequest`

**Response**: `ExpeditionReplay`

**エラー**:

* 400: 無効PT/無効エリア/帰還条件不正
* 409: クールダウン中
* 422: リソース不足（スタミナ等）

### 14.2 GET /expeditions/{id}

**説明**: 既存リプレイを取得（再生用）。

**Response**: `ExpeditionReplay`

### 14.3 POST /expeditions/{id}/abort

**説明**: 再生中に手動中断。サーバ側で**部分集計**したResultを返す。

**Response**:

```json
{ "expeditionId": "...", "result": RewardSummary }
```

---

## 15. テレメトリ / A/B

* 計測: 成功率、平均到達F、平均所要時間、KO率、捕獲率、アイテム獲得分布、スキップ率、速度別利用率。
* A/B: `σ`・`eventWeights`・`captureBonus` などの調整ノブをバリアント管理。

---

## 16. 調整ノブ（Balancing Knobs）

| パラメータ            |        既定 | 影響         |
| ---------------- | --------: | ---------- |
| `σ`(勝率スケール)      |        15 | 勝敗の鋭さ/難度曲線 |
| `perFloorEvents` |       2〜3 | 遭遇密度とテンポ   |
| `captureBonus`   | 0.05〜0.10 | 捕獲の体感頻度    |
| `luckMod` 範囲     |   0.8〜1.2 | ドロップと捕獲の上下 |
| `speedMod` 範囲    |   0.8〜1.3 | 所要時間の短縮/延長 |
| KO→死亡 `p_death`  |    0〜0.15 | リスクと緊張感    |

---

## 17. テスト計画

* **決定性テスト**: 同シード/同入力→完全一致か。
* **境界値**: PT1体/6体、運極端、帰還条件各種。
* **統計**: 大量試行で勝率・捕獲率が理論値±許容範囲に入るか。
* **回帰**: `AreaConfig` 更新時の破壊検知（スナップショット）。
* **リプレイ整合**: `events`適用→`summary`が一致するか。

---

## 18. セキュリティ/不正対策

* 乱数シードの**サーバ側生成**とコミット記録。
* クライアントからのリプレイ改ざんは無視。公式APIから**サーバ真値のみ**使用。
* 出発/中断のAPIをレート制限。

---

## 19. 既知の課題 / 将来拡張

* NPCイベント（取引/救出/情報）を別テーブル化して再来時の影響を持続させる。
* 移動演出の可変（ショート/フル）。
* オフライン完走時の通知UX。

---

## 20. 付録: サンプル `ExpeditionReplay`（抜粋）

```json
{
  "meta": { "expeditionId": "exp_demo_0001", "areaId": "forest_outskirts", "areaName": "集落周辺の森", "floors": 3, "baseDurationSec": 30, "party": ["gob_001","gob_017","gob_102","hob_003","shaman_001","scrapper_006"], "returnPolicy": "never", "seed": 123456789 },
  "durationSec": 30,
  "events": [
    {"type":"move_start","at":0.5,"floor":1},
    {"type":"battle","at":3.2,"floor":1,"enemy":{"id":"slime","name":"スライム","lvl":1,"count":2},"combat":{"rounds":2,"outcome":"win","allyHPDelta":[-2,0,0,0,-1,0],"enemyDefeated":2,"capture":{"eligible":true,"success":false,"rate":0.25}},"xp":8,"drops":[{"id":"meat_small","qty":1}]},
    {"type":"resource","at":7.8,"floor":1,"loot":[{"id":"healing_herb","qty":1}]},
    {"type":"trap","at":10.9,"floor":1,"trapId":"thorn_patch","effect":{"hpLoss":[0,1,0,0,0,0]}},
    {"type":"floor_up","at":12.2,"from":1,"to":2},
    {"type":"battle","at":15.2,"floor":2,"enemy":{"id":"trainee","name":"見習い冒険者","lvl":2,"count":1},"combat":{"rounds":3,"outcome":"win","allyHPDelta":[0,-2,0,-1,0,0],"enemyDefeated":1,"capture":{"eligible":true,"success":false,"rate":0.15}},"xp":10,"drops":[{"id":"twig_spear","qty":1}]},
    {"type":"floor_up","at":21.0,"from":2,"to":3},
    {"type":"battle","at":26.1,"floor":3,"enemy":{"id":"slime_pack","name":"スライム群れ","lvl":1,"count":3},"combat":{"rounds":2,"outcome":"win","allyHPDelta":[-1,0,0,0,0,0],"enemyDefeated":3,"capture":{"eligible":true,"success":true,"rate":0.20,"captured":{"id":"slime","qty":1}}},"xp":12,"drops":[{"id":"meat_small","qty":1}]},
    {"type":"boss","at":28.3,"floor":3,"enemy":{"id":"trainee_captain","name":"見習い隊長","lvl":3,"count":1},"combat":{"rounds":4,"outcome":"win","allyHPDelta":[0,-3,0,-2,0,0],"enemyDefeated":1,"capture":{"eligible":false}},"xp":30,"drops":[{"id":"healing_herb","qty":2}]},
    {"type":"return","at":30.0,"reason":"boss_clear"}
  ],
  "summary": {"success": true, "maxFloorReached": 3, "xpGained": 60, "loot": [{"id":"meat_small","qty":3},{"id":"healing_herb","qty":2},{"id":"twig_spear","qty":1}], "captures": [{"id":"slime","qty":1}], "casualties": [], "injuries": ["gob_017","hob_003"]}
}
```

---

以上。必要に応じて、**実装用のTSユーティリティ（再生ヘルパー/抽選器/決定式）**も別紙として追加可能。
