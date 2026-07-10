# レアアイテム設計 進捗ログ

参考ゲームの設計思想(複合効果＋トレードオフ／同一効果の段階ID差し替えでレア度スケール)を参考に、レアアイテムのステータス・スキルを **ドロップ元ダンジョンの Tier と floor難易度に応じて** 設計する作業の記録。方法論の土台は [`balance_simulation.md`](./balance_simulation.md)、エリア難易度は `scripts/balance/out/tierSweep.csv`。

---

## 1. 背景 / 問題

- レア総数 **247件**。うち **118件(48%)がコピペ**(名前だけ違い、ステータス・スキルが完全一致)。これが「能力は仮」の実体。
  - 例: ローブ8種が全て `魔防28 + magic_reduction_14 + magic_resistant_4_5 + hp_multiplier_7` で同一。
- Tier別floorを考慮しないと、低floorエリアから強すぎるレアが出る不整合があった。

## 2. 設計フレームワーク(確定)

**レア性能 = 「そのfloor帯・Tierの通常最上位ランク +α の素ステータス」＋「テーマに沿った固有スキル(floor帯で解禁段階を制限)」**

- **ドロップ枠の役割**: T0=主ステ装備(武器/杖) / T1=防御・補助(鎧/ローブ/盾) / T3=装飾品(素ステ小＋強スキル=伝説クリア報酬)。
- **有効floor = ドロップ元エリア×そのTierのfloor の最小値**(複数敵が落とす場合は最も簡単な入手経路で判定)。`tierSweep.csv` 参照。
- **複合効果＋トレードオフ**を採用(参考ゲーム流)。上位レアは「尖った強み＋明確な弱点」。
- **Tier差を明確化**(T0 < T1 < T3)。
- **種族特効(slayer)は低floorでもカジュアルに解禁OK** — 各ダンジョン攻略の"対策装備"の初歩という位置づけ(ユーザー方針)。

### floor帯 → 防御スキル段の上限(単調増加の基準)

| band | 有効floor | ローブ魔法軽減% | 鎧物理軽減% | hp_multiplier | 追加ダメージ | 種族特効 |
|---|---|---|---|---|---|---|
| A | ≤16 | 5-6 | ≤7 | ≤6 | ≤3 | 1.2-1.5 |
| B | 17-70 | 10-14 | ≤9 | ≤8 | 4-6 | 1.5-2.0 |
| C | 71-100 | 15-18 | ≤11 | ≤10 | 6-8 | 2.0 |
| D | 101-180 | 20-24 | ≤13 | ≤12 | 8-10 | 2.0 |
| E | 181+ | 26-30 | ≤16 | ≤13 | ≤13 | 2.0 |

## 3. 進捗

### band A〜E(有効floor確定の148件)— 完了

- **band A(≤16, 16件)**: 手設計。ドロップ元テーマ・トレードオフを個別付与(下記詳細)。
- **band B〜E(126件)**: ルールベース生成器で再設計。ステータスは維持(floorスケール済)、**スキルを band上限キャップ＋ドロップ元種族の特効(slayer)＋ボス署名＋(band×カテゴリ)連番の個性base能力**で再構成。
  - **コピペ解体**: floor確定148件中 **147件がユニーク設計**(重複含有 118→2件)。例: かつて8種同一だったローブ群は floor帯で魔法軽減14/18/22、base能力、術者echoで全て別物に。
  - **floorスケール整合**: 同名グループでも有効floorで段が変わる(例 廃村の喪服f50=魔法軽減14 vs 黒羽の外套f100=18)。
  - **Tier差**: effFloorが area×tierのfloorなので、T3ドロップ(伝説クリア報酬)は自動的に上位bandに入り強化される(例 ゴブリンT3=f150=band D)。
- **検証(全体)**: スキル過剰違反 band A〜E すべて **0件** / `tsc` clean / 全32スイート536テスト合格。

#### band A 個別設計の要点
コピペ状態を解体し、ドロップ元の敵に紐づく固有テーマ・floor準拠強度・トレードオフを付与。
- スティレット=精密速攻(行動順1.5)、吸血針=吸血(HP持続回復)、トゲ手裏剣=棘の回避型 に差別化。
- ファングサーベル(獣特効1.5攻剣) vs グレイファング(頑強タンク剣) を差別化。
- 夜羽の外套 魔法軽減14→6＋回避、ウルフ/灰狼の鎧 物理軽減8→7で差別化。
- ファルシオン=手数-0.4のトレードオフ+物理%20の重い一撃型。
- **検証**: band A スキル過剰 8→0 / `tsc` clean / masterDataIntegrity 13件合格。
- **バランス保留メモ**: `physical_damage_20`(物理+20%)は序盤に強め。要後日調整(ユーザー了承済み)。

### 高Tierドロップ55件(floor>300ゲート)— 完了
- forest_edge/old_well/undead_ruins/road/subjugation 等の **T3(伝説)ドロップ**(floor>300 = 意図的な高Tierゲート)。最強band(E)相当で設計。「蜘蛛の森以降の未計測エリア」ではなく**計測済みエリアの高Tier枠**だった(未計測エリアにはレアドロップ自体が未設定)。

### キラー系9 + デッドデータ大盾4 — 配線+設計 完了
- **キラー系**を種族一致ダンジョンに配線し floor準拠で設計: アンデッド系→undead_ruins(f70)、獣系→wolf_grassland(f100)、人間系→subjugation(f180)/bandit(f70)、竜系→lizardman_swamp(f180)。特効倍率も floorで変化(bandit1.5 / subjugation2.0)。竜特効は計測エリアに竜が居ないため個別注入(`dragon_slayer_2_0`)。
- **大盾**は通常ドロップ非対象(rank付き7カテゴリに含まれない)と確認。デッドデータだった4種(アイアンウォール/城塞/竜鱗/アダマント)を防御力ラダー順(f70/100/180/180)に配線+設計。
- 配線先: `enemy/{undead_ruins_1,wolf_grassland_1,subjugation_force_1,bandit_hideout,lizardman_swamp_1}.json` に `rareEquipmentDrops` 追加。

### 設計カバレッジ: **216 / 247**(配線済みレアは全て設計済み)

### 方針決定済みの残処理
- **初代スライム仮装備 5件を削除完了**(ゼリーローブ/ぷるぷるワンド/王冠ゼリー/スライムバックラー/粘王のロッド)。配線済み rare_002版と役割重複の旧プレースホルダ。`equipmentPool.json` のテンプレ＋`i18n/resources/equipment.ts` の名前定義(ja/en/ko各1)を削除。→ レア総数 247→**242**。
- **店売り/特殊系 18件は現状維持**(忍具ラダー8・タレント剣5・rod2・爆炎の杖・大分裂核/因子核)。価格ラダー付きの店売り想定として敵ドロップにはしない。
- **ボス固定装備 8件は保留**(ホブゴブリン剣/戦鎧・族長盾/戦冠・赤傷ククリ/ブリガンダイン・盗賊王指輪・ガルドカトラス)。由来ボスに配線すれば設計可(族長は該当敵名が無く要判断)。次回着手候補。

### 最終状態
- レア総数 **242** / 設計済み(配線済み)**216** / 未配線26(店売り18＋ボス保留8)。
- 完全一致は `armor_rare_006/018`(ボス固定・保留)のみ(§3.5 の第2次再設計で 7組→1組に削減)。
- `physical_damage`序盤強度は後日バランス調整。
- 参考ゲーム由来の新スキル群を band ゲート付きで配線済み(§3.5)。**戦闘ロジックも全実装済み**(§4)。残タスクは敵専用スキル3種の敵JSON配線。

## 3.5 参考ゲーム由来スキルの導入(2026-07-10 第2次再設計)

初回再設計(#318)が既存カタログスキルのみで構成されていた反省から、参考ゲームの実データ
(ローカル参照のスキルデータ 1,895件 / 装備データ 998件)を再分析し、
**流用可能なスキル概念を翻案**(名称・数値は変更、コピーはしない)してレアに配線した。

**仕分け方法**: 参考の全スキルを573ファミリーに正規化し、items.json の付与状況で
「一般装備(店売り/汎用)」「NPC/私物専用(固有キャラ・ボス級)」「アイテム付与なし(職業/敵専用)」に分類。
一般装備で入手できた概念はプレイヤー側レアに、NPC専用級・ボス級の概念は敵専用スキルとして翻案した。

### 導入したプレイヤー側スキル(band解禁ゲート付き)

| 新ID | 名称 | 効果(翻案) | 参考元 | 解禁band |
|---|---|---|---|---|
| `lifesteal_5/8/12` | 吸血 | 与ダメのN%回復(上限:最大HP25%/回) | 吸収能力Lv1-3 | C/D/E |
| `hp_degen_5/10` | 血の代償 | ターン終了時HP N%減少(トレードオフ用) | HPダメージLvN | E(強スキルの対価) |
| `party_heal_regen_10/20` | 癒しの霊気 | ターン終了時、味方全員を魔法回復量のN%回復 | 全体回復LvN | B/D |
| `battle_fervor_4/6` | 闘志 | 攻撃行動ごとに与ダメ+N%(上限40/60%) | 激闘 | C/D |
| `mana_surge_4/6` | 魔力高揚 | ターン経過ごとに魔法攻撃力+N%(上限40/60%) | トランス(速度上昇は削除) | C/D |
| `mighty_blow_180` | 渾身の一撃 | 攻撃回数1のとき攻撃力1.8倍 | 一撃必殺(2.0→1.8に調整) | C |
| `deadeye_200` | 精密照準 | 攻撃回数1のとき命中2倍 | 精密射撃 | B |
| `ward_physical_2/3` | 物理障壁 | 敵の攻撃をN回1/3に軽減(PT保護) | 物理結界LvN | B/D |
| `ward_magic_2/3` | 魔法障壁 | 敵の魔法をN回1/3に軽減(PT保護) | 魔法結界LvN | C/D |
| `war_cry_1_2/1_3` | 鬨の声 | PT全員の攻撃ダメージ1.2/1.3倍(重複無効) | 単騎突撃/指揮 | D/E |
| `pursuit_30` | 追い打ち | 敵撃破時30%で再攻撃 | 殺意/闘争心 | C |
| `crit_guard_30/50` | 急所守り | 必殺被ダメN%軽減 | クリティカル・ガード | B/D |
| `pierce_guard_30/50` | 対貫通装甲 | 追加ダメージ被ダメN%軽減 | 貫通防御 | B/D |
| `action_order_200` | [戦術]神速 | 行動順速さ2.0倍 | 高速行動 | D |
| `bulwark_stance_30` | 城塞の構え | 攻撃回数半減→半減回数×30防御力 | 攻撃回数→防御力 | D |
| `mystic_stance_30` | 魔導の構え | 攻撃回数半減→半減回数×30魔法攻撃力 | 攻撃回数→魔法攻撃力 | D |
| `spell_siphon_30` | 魔力簒奪 | 通常攻撃時30%で使用済み魔法1回復 | 魔力吸収(NPC級→E/T3限定で許可) | E/T3 |
| `frost_nova_t4` | 氷霧の大渦 | 4ターン目開始時、敵全体に魔攻150%魔法 | フロストノヴァ(Lv99級→T3限定) | E/T3 |

- **配線結果**: 83箇所(77件の一括注入＋重複解消・テーマ整合の個別調整6件)。
  既存の汎用フィラー枠(`base_*_up_*`)を差し替える方式でスキル総数は維持
  (トレードオフ2件のみ `battle_fervor_6`+`hp_degen_5` で+1)。
- **条件スキルの配線先**は攻撃回数マイナスの一撃型装備(狩猟弓/アサシンボウ/鍬槍 等)に限定し、シナジーを保証。
- **テーマ整合の個別調整**: 再生肉→`hp_regen_10`、遠見の矢羽→`deadeye_200`、裏道の鍵→`action_order_200`、
  奪魔のロッド→`spell_siphon_30`、怨声の指輪→`pursuit_30`。
- **コピペ解消**: HEAD時点で残っていた完全一致7組(進捗ログの「残り1ペア」は過小計上)を1組まで削減。
  残る `armor_rare_006/018` はボス固定装備(保留8件)のため次回対応。
- **検証**: `tsc` clean / 全32スイート536テスト合格 / round-trip差分ゼロ / 完全一致 7→1組。

### 敵専用スキル(装備には付与しない)

参考ゲームのボス/敵専用級の概念はカタログに敵専用として翻案登録済み(戦闘ロジック実装済み。**敵JSONへの配線は未着手**、`enemy/*.json` の `skills` にIDを追加すれば有効):

| 新ID | 名称 | 効果 | 参考元 |
|---|---|---|---|
| `enemy_royal_pressure_30` | 王の威圧 | 自分よりLvが低い相手からの被ダメ30%軽減 | 君臨 |
| `enemy_chain_reattack_30` | 連撃衝動 | 攻撃後30%で再攻撃を繰り返す | 無双連撃 |
| `enemy_thunder_call` | 招雷の角 | 毎ターン開始時、敵全体に魔攻60%の雷撃 | 招雷 |

**将来の敵スキル候補(アイデアのみ、未登録)**: 生贄の儀(1体に攻撃集中)、闇の契約/神の試練(1ターン全体の魔防/防御半減)、
天威降臨(1ターン全員必殺100%)、アシッドブレス(全体ブレス+防御劣化)、覚醒(1ターン与ダメ2倍)、突然変異(HP2倍エリート個体)。
状態異常系(毒/麻痺/眠り/混乱/石化/即死)は状態異常システム自体が未実装のため見送り。

## 4. 未実装スキルの記録

> ユーザー方針: レア設計時に「まだ戦闘ロジックに未実装のスキル」を付けた場合はここに記録する。あとでまとめて実装する。

**判定基準**: `CharacterSkill` の効果フィールドが実行時(`BattleSystem` / `battle/unitFactory` / `GoblinStatCalculator` / `ExpeditionEngine` / `CompleteExpeditionUseCase` 等)で消費されているか。集約層 `src/shared/data/characterSkills.ts` の `getXxxFromSkills` / `hasXxxSkill` の呼び出し元で確認できる。

**2026-07-10 第2次再設計で追加した新スキル群(§3.5)は、同日中に戦闘ロジックを一括実装済み**。
現在、カタログ `CHARACTER_SKILL_CATALOG` の全効果フィールドは実行時に消費されており、**未実装は無し**。

実装箇所の要約(後から挙動を追う際のガイド):

| フィールド | 対象スキルID | 実装箇所 |
|---|---|---|
| `lifestealPercent` | lifesteal_5/8/12 | `BattleSystem.executeBasicAttack` ダメージ適用後(回復上限=最大HP25%/回) |
| `hpRegenPercent`の負値 | hp_degen_5/10 | ターン終了時に負値対応済み(**HP下限1**、actionEffect='damage'でログ) |
| `partyHpRegenFromMagicHealPercent` | party_heal_regen_10/20 | ターン終了時、自分の魔法回復量×%で味方全員回復 |
| `damageRampPerAttackPercent/Max` | battle_fervor_4/6 | 通常攻撃行動の後にスタック加算→次の攻撃から与ダメ係数 |
| `magicAtkRampPerTurnPercent/Max` | mana_surge_4/6 | ターン開始時に基準値から magicAtk を再計算(unit/combatant両方) |
| `singleStrikeAttackMultiplier` | mighty_blow_180 | `unitFactory`(味方/敵とも)。最終攻撃回数==1のとき atk へ乗算 |
| `singleStrikeAccuracyMultiplier` | deadeye_200 | 同上。accuracy へ乗算 |
| `physicalBarrierCharges` / `magicBarrierCharges` | ward_physical/magic_2/3 | 戦闘開始時にPT共有 `barrierState` 生成(重複無効=最大値)。被弾ごとに1消費で1/3軽減 |
| `partyPhysicalDamageMultiplier` | war_cry_1_2/1_3 | 戦闘開始時PT効果(magic_field と同型、最大値のみ) |
| `reattackOnKillChancePercent` | pursuit_30 | `tryReattacks`: 撃破時1回のみ再攻撃(追撃/反撃からは発動しない) |
| `chainReattackChancePercent` | enemy_chain_reattack_30 | `tryReattacks`: 確率連鎖、安全上限5回 |
| `criticalDamageTakenReductionPercent` | crit_guard_30/50 | 必殺時の criticalDamageFactor に乗算 |
| `additionalDamageTakenReductionPercent` | pierce_guard_30/50 | 追加ダメージへ乗算(切り捨て) |
| `halveAttackCountToDefRate` / `...MagicAtkRate` | bulwark/mystic_stance_30 | `GoblinStatCalculator.applyPassiveSkillEffects`(defToHp等より先に適用) |
| `recoverUsedSpellOnAttackChancePercent` | spell_siphon_30 | 通常攻撃行動の後に確率で使用済みチャージ+1 |
| `turnStartAoeMagic` | frost_nova_t4, enemy_thunder_call | ターン開始時(魔力高揚の更新後)。魔防系軽減・障壁・王の威圧を適用 |
| `lowerLevelDamageTakenReductionPercent` | enemy_royal_pressure_30 | 物理/魔法/ターン開始AoEの被ダメ計算(攻撃側Lv<自Lvで軽減) |

**検証(2026-07-10)**: 全16ケースの一時スモークテスト(吸血/血の代償HP下限/癒しの霊気/障壁/鬨の声/闘志/魔力高揚+AoE/連撃上限5/追い打ち1回/渾身/精密/急所守り/対貫通/王の威圧/魔力簒奪/構え×2)で挙動確認後、方針(新規テストは追加しない)に従い削除。`tsc` clean / 既存536テスト合格。

> 今後 floor未確定99件を設計する際に新規/未実装スキルを付けたら、ここに追記する。

## 5. ツール / スクリプト

計測・マッピングは `scripts/balance/`(既存)＋作業用スクリプト。レアのドロップ配線とfloorの突き合わせは以下の手順:
- `equipmentPool.json`(`templates[]`, `isRare:true`)を敵JSON(`enemy/*.json` の `rareEquipmentDrops` / `tierRareEquipmentDrops`)と突き合わせ、`tierSweep.csv` の (area,tier)→floor で有効floorを算出。
- 適用は `equipmentPool.json` を読み込み→対象templateの `statBonuses` / `grantedSkillIds` を差し替え→`JSON.stringify(obj,null,2)` で書き戻し(round-trip差分ゼロを確認済み)。
