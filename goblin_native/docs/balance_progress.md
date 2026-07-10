# バランス調整 進捗ログ(セッション間の再開用)

このドキュメントは、バランス調整作業を**セッションをまたいで続きから再開する**ための進捗記録です。方法論・前提は [`balance_simulation.md`](./balance_simulation.md)、算出基準は同 5.5 を参照。

> 次セッションはまず「4. 次にやること」から着手できます。

---

## 1. これまでの流れ(サマリ)

### 第1期(基盤整備・初回診断 / commit 58d6dd8 以前)
- ヘッドレス・バランスシミュレータを構築(ペルソナ floor/median/ceiling/strategist、実 ExpeditionEngine 使用の決定論シミュレーション)。
- `analyzeThresholds.js` / `strategyPremium.js` と整合性テスト(masterDataIntegrity)を整備。
- 初回診断: 過剰調整の「レベルの壁」は無し / 戦略プレミアムほぼ全域90〜100% / 中盤の壁は「戦略の壁」/ areaLevel ラベル破綻 / 終盤 空洞 / 亜種の存在意義が薄い。詳細は `balance_simulation.md`。

### 第2期(本セッション: 敵データ再設計 + Tier計測)
「フロアごとにエンカウント敵を変えて難易度を上げる」再設計が**街道(road_1)で止まっていた**問題に着手。

1. **逆転の発見**: オーク野営地(floor40)・辺境の村(floor50)が街道(70)より簡単な進行逆転。原因=敵が壊れた areaLevel スケールのまま/ロスターが薄い(2〜4種)。
2. **オーク野営地 再設計**: 「オークが配下ゴブリンを従える」設定。配下ゴブリン兵/メイジ/クレリックを追加、F3でメイジ・F5でクレリック登場、F6ボス=オーク遠征隊長+配下。※一度追加した親衛隊長/呪術師/祈祷師は「オークの頭に呪術師はいない」との指摘で削除済み。
3. **辺境の村 再設計**: 顔ぶれ(民兵/守備兵/猟師/防衛砲台)維持、ステータス底上げ+エンカウント表再構成。
4. **敵ステータス算出基準の確立**: HP/ATK/DEF/EVA を `enemyStats.ts` の算出式×標準倍率で導出する運用に(命中/多段/魔法系は例外)。→ `balance_simulation.md` 5.5。
5. **ウルフ草原 再設計**: 狼2種→5種パック。**前半フロア=軽い混成、後半フロア=元の高密度パック**にして「フロア変化を足しつつ必要Lvは維持」(floor ~95、元100とほぼ同じ)。
6. **沼砦・討伐隊は現状維持**: 既に完成度の高い戦略壁(物理軽減/回避/多段/グラスキャノン)なので触らない判断。
7. **studio サーバー復旧**: 監査で誤削除された `src/shared/utils/enemyStats.ts` を復元(未参照に見えても studio が使う。削除禁止コメント付き)+ studio に `__DEV__` 型宣言追加。
8. **全ダンジョン Tier別計測**(討伐隊まで14エリア × Tier0-4)。結果は `scripts/balance/out/tierSweep.csv`。
9. **高Tierゲートは意図的**と確認・記録(下記)。

---

## 2. 現在の難易度カーブ(Tier0)

**floor(裸)必要Lv — 単調増加 OK:**
```
森外れ50 < 古井戸60 < アンデッド/山賊/街道/オーク野営地70 < 辺境の村80 < ウルフ草原95 < 沼砦/討伐隊180 / オークの砦150
```
逆転は討伐隊までで解消済み。

**Tier別の詳細**は `scripts/balance/out/tierSweep.csv`(floor と strategist、Tier0-4)。要点:
- floor(裸)は Tier1(魔性)以降ほぼ全て >300(裸お断り)。実用指標は strategist。
- 選択可能な「伝説(Tier3)」が strategist でも攻略不能(>300)なエリア: オーク野営地・オークの砦・討伐隊。→ **意図的**(下記3)。
- オーク野営地の高Tierカーブが急(通常16→伝説>300)。ゴブリンメイジの魔法/B_ORCボスの高Tierスケールが要因の可能性。要調査候補。

---

## 3. 設計方針(重要・誤修正しないこと)

- **高Tier(伝説/恐ろしい/壊れた)が最適構成でも攻略不能なのは意図的**。バグ扱いして敵を弱体化しない。
  - 今後、**高Tierに敵スキルを追加**して「対策必須の凶悪な敵」にする(単なる数値上げから脱却)。
  - **プレイヤー側もストーリー進行で強い亜種・ジョブ・スキル・レアアイテムを解放**し、高Tierを攻略可能にする。
  - = 両側の未実装コンテンツで後から埋める前提の進行ゲート。
- 調整対象は当面「**Tier0 の進行順の単調増加**」と「**低Tierの明確な逆転**」まで。

---

## 4. 次にやること(未着手)

1. **蜘蛛の森(spider_forest_1)以降の大逆転**: 討伐隊(floor180)の後、spider_forest_1 が floor25 に急落(180→25)。ここが次の明確な逆転。**最優先候補**。
2. **討伐隊より先の空洞エリア群**を順に再設計: spider_forest_1 / dead_grave_1 / harpy_cliff_1 / human_fortress_1 / vampire_castle_1 / royal_capital_1〜3 / dragon_volcano_1。多くが「空洞」(floor必要Lvが低い)。
3. **areaLevel ラベルの振り直し**: 王都系(表示160-180)が実測 strategist 8-10 と乖離。表示・報酬・出産個体値に波及。
4. **オークの砦の寄り道ゲート測定**: 祖先モデルが rider・リザードマン因子を数え落とし strategist を過小評価。寄り道込みで測る仕組み(`balance_simulation.md` 6.2)。
5. (将来)高Tier敵スキル追加 + プレイヤー側コンテンツ — これは balance-sim ではなくコンテンツ実装作業。

---

## 5. 変更ファイル / ツールの場所

**本セッションの変更(コミット時の対象)**:
- 敵データ: `src/shared/data/enemy/{orc_camp_1,human_village,wolf_grassland_1}.json`
- 復元: `src/shared/utils/enemyStats.ts`(削除禁止)
- i18n: `src/shared/i18n/resources/{ja,en,ko}.ts`(オーク野営地の説明文)
- studio: `tools/studio/src/globals.d.ts`(`__DEV__` 宣言)
- ドキュメント: `docs/balance_simulation.md`(5.5 算出基準)、本ファイル

**計測ツール(`scripts/balance/`)**:
| ツール | 用途 |
|---|---|
| `measureArea.js <area...>` | 単エリアの floor/strategist 必要Lv |
| `probeArea.js "<levels>" <area...>` | 指定レベルの floor 成功率(細粒度) |
| `measureTiers.js "<tiers>" <area...>` | Tier別 floor/strategist 必要Lv |
| `calcOne.js "<name Lv vit pow agi luck sp [boss]>"` | 単体の算出式×倍率スタッツ |
| `deriveStats.js <area...>` | エリア内全敵の導出値(現在値との差分) |
| `statFormula.js <area...>` | 現在値 vs 算出式出力の比較 |
| `statMultipliers.js <area...>` | 実データからの実効倍率(中央値) |

出力: `scripts/balance/out/`(tierSweep.csv 等)。

---

## 6. 再開手順(次セッション)

1. このファイルと `balance_simulation.md`(特に 5.5 と 6.2)を読む。
2. `scripts/balance/out/tierSweep.csv` で現状の数値を確認。
3. 「4. 次にやること」の 1(蜘蛛の森以降の逆転)から着手。手順は `balance_simulation.md` 6.1 の基本ループ + 算出基準(5.5)。
