# 戦闘ダメージ逆転の調査メモ（2026-05-09）

## 対象事象

実機の戦闘ログで、攻撃力が大きく異なる2体が同じ敵へ近いダメージを出している。

- ゴツゴツ: ATK 162、ロッドのみ、通常武器なし
- ゾロ: ATK 391、遠距離武器のみ、6列目
- 対象敵: Lv64 辺境城弓兵
- ログ上の与ダメージ:
  - ゴツゴツ → 辺境城弓兵A: 342ダメージで撃破
  - ゾロ → 辺境城弓兵B: 324ダメージで撃破
- 両者とも、周辺ログから辺境城弓兵へ2HITした可能性が高い。

期待値としては、同じ敵・同じHIT数・同じ隊列補正なら ATK391 のゾロが ATK162 のゴツゴツを大きく上回るはず。

## 前提として確認した仕様

### 辺境城弓兵 Lv64

`goblin_native/src/shared/data/enemy/subjugation_force_1.json` の辺境城弓兵は以下。

- `def = 21`
- `physicalDamageReductionPercent = 10`
- `raceTags = ["human"]`

### 通常攻撃ダメージ

通常攻撃は `BattleSystem.executeBasicAttack()` で以下の補正を掛ける。

- 基本ダメージ: `DamageCalculator.calcDamage()`
- 攻撃回数ダメージ補正: `getDamageModifier(...)`
- 後列火力支援: `getRearDamageMultiplier(...)`
- 武器レンジ隊列補正: `getRowDamageMultiplierFromSkills(...)`
- 物理与ダメージ補正: `physicalDamagePercent`
- アタックアップ: `physicalDamageDealtMultiplier`
- 対象側の物理軽減: `physicalDamageReduction`
- 乱数: `0.6〜1.05`

### 武器レンジ隊列補正

- 近接武器: 後列ほど低下
- 遠距離武器: 後列ほど上昇し、6列目は100%
- 近接と遠距離の両方を持つ場合: 固定で44%
- 武器なし: 100%

今回の前提では、ゴツゴツは武器なしで100%、ゾロは遠距離武器のみ6列目で100%。

## 現在確認済みの不具合

### 1. 攻撃回数ダメージ補正が「命中HIT番号」ではなく「攻撃試行番号」で適用されている

現在の実装:

```ts
const dmgMod = getDamageModifier(atkIdx + 1)
```

`atkIdx` はミスも含む攻撃試行番号。  
しかし意図は「命中した攻撃の何HIT目か」に応じた減衰。

このため、ミスした攻撃もダメージ減衰段数に数えられてしまう。

修正方針:

- `landedHitCount` のような命中HIT数を持つ
- 命中後に `landedHitCount++`
- `getDamageModifier(landedHitCount)` を使う

### 2. 命中率補正も同じ問題を持つ可能性が高い

現在の命中率計算も `atkIdx + 1` を渡している。

```ts
const hitRate = this.calculateHitRate(unit, attackTarget, atkIdx + 1, rng)
```

仕様意図が「命中した攻撃回数による補正」なら、命中補正も同様に見直す必要がある。  
一方で「試行回数が増えるほど命中しにくい」設計なら現状でよい。ここは仕様確認が必要。

## この不具合だけでは説明しきれない点

ゾロは15回攻撃で8HITしている。命中精度1507、対象回避46の場合、現行命中式では命中率はほぼ上限95%に張り付く。

そのため、以下のような事象は極めて起きにくい。

- 最初の7回がすべて外れる確率: `0.05^7 = 0.00000000078125`
- 最初の10回がすべて外れる確率: `0.05^10 = 0.0000000000000977`

つまり「ミス込み試行番号で減衰していた」だけで、ATK391のゾロがATK162のゴツゴツを下回る説明としては弱い。

特に、ゾロの辺境城弓兵への2HIT目だけが8HIT目だったとしても、以下の条件なら324ダメージは低すぎる可能性が高い。

- 隊列補正100%
- 後列火力支援 `inspire_150` が乗っている
- クリティカルなし
- 対象が同じ Lv64 辺境城弓兵

## 追加で疑うべき点

### 1. ゾロに後列火力支援が乗っていない

ウォリアーの `inspire_150` は、自分より後列の味方に `rearAllyDamageMultiplier = 1.5` を与える。

コード上は `getRearDamageMultiplier()` が、攻撃者より前列にいる生存ユニットから `rearAllyDamageMultiplier` を探す。

疑う点:

- 前列ウォリアーがその時点で生存していない
- 隊列番号が想定と違う
- ゾロの攻撃時に `sourceGroup` が想定と違う
- `inspire_150` がウォリアーに付与されていない

### 2. ゾロの武器レンジ補正が100%になっていない

ユーザー確認ではゾロは遠距離武器のみで、近接武器は絶対に装備していない。

ただし、コード上はスキル配列に `weapon_melee_attack` と `weapon_ranged_attack` が同時に存在すると44%固定になる。  
装備着脱時に付与スキルが残るような不整合がある場合、表示装備と戦闘スキルがずれる可能性がある。

疑う点:

- 装備解除時に `weapon_melee_attack` が `goblin.skills` に残っていないか
- 遠征出発時に装備由来スキルを二重マージしていないか
- `effectiveStats` と `skills` の出所がずれていないか

### 3. 戦闘ログの表示不足

現在、撃破した対象はHIT数が表示されない。

```tsx
target.defeated
  ? targetDefeated(...)
  : targetHits(... count: target.hitCount)
```

このため、撃破対象が何HITだったかをログから直接確認できない。  
また、ログの対象行は「対象ごとの初回ヒット順」であり、各HITの時系列ではない。

例:

```text
1HIT目: 弓兵B
2〜7HIT目: 他2体
8HIT目: 弓兵B
```

この場合、弓兵Bはログ上最初に出るが、弓兵Bの2HIT目は8HIT目になり得る。

ただし、これだけでは今回のダメージ逆転の説明としては弱い。

## effectiveStats について

通常UIの装備変更では、装備変更時に `calculateGoblinEffectiveStats()` を呼び、DBの `effectiveStats` を更新している。

そのため通常プレイの `装備変更 -> 遠征出発` で必ず古いDBになるとは言い切れない。

ただし `effectiveStats` はキャッシュ的な非正規化データなので、以下では古くなり得る。

- 過去バージョンの保存データ
- バックアップ復元
- Studio/スクリプト経由の生成
- 装備だけが直接変更された場合
- 装備保存成功後、ゴブリン保存に失敗した場合

対応済み:

- 遠征開始時に現在の装備から `effectiveStats` を再計算する防御的修正を追加
- ただし、今回の画像の主因とは断定しない

## 2026-05-09 バックアップデータでの追加確認

対象バックアップ:

- `/Users/astapi/Downloads/goblin-kingdom_20260509-193323.gkbackup.json`

対象:

- PT1
- `lizardman_swamp_1`（リザードマンの沼砦・本拠）
- 隊列4: ゴツゴツ（ID 163）
- 隊列6: ゾロ（ID 175）

バックアップ保存値そのままでは、ゾロの `effectiveStats.atk` は178だった。  
一方、現在装備から再計算すると、表示上の期待値どおりゾロは `effectiveStats.atk = 391` になる。

ただし修正前の遠征シミュレーションでは、再計算後でも戦闘デバッグ上のゾロの実ATKが222になっていた。

原因:

- `ExpeditionEngine.initializePartyState()` は `getEffectiveStats(goblin)` を使って最大HPなどを作っていた
- しかし `resolveCombat()` で `PartyState` から `Goblin` を再構築するとき、`effectiveStats` を渡していなかった
- その結果、戦闘開始時に `BattleSystem` 側で装備ステータス補正なしの値を再計算していた
- スキル由来の攻撃回数やレンジ属性は残るが、武器そのもののATK加算が落ちる

この状態では以下のように、ゴツゴツとゾロの平均ダメージがほぼ同じになる。

```text
mode=recomputed / 修正前
ゴツゴツ: avg=146.08 / 実ATK=202
ゾロ:     avg=149.50 / 実ATK=222
```

`effectiveStats` を `PartyState` に保持し、戦闘再構築時の `Goblin` に渡す修正後は以下。

```text
mode=recomputed / 修正後
ゴツゴツ: avg=142.35 / 実ATK=202
ゾロ:     avg=312.00 / 実ATK=488
```

修正後は、ゾロの装備ATKが戦闘に反映され、ダメージ差が明確に出る。

## 対応方針

### 優先1: 攻撃回数ダメージ減衰を命中HIT番号ベースに修正

対象:

- `goblin_native/src/core/services/BattleSystem.ts`
- `executeBasicAttack()`

方針:

- `landedHitCount` を導入
- 命中した通常攻撃だけを数える
- `getDamageModifier(landedHitCount)` を使う
- 2列攻撃など追加対象がある場合、主攻撃と貫通攻撃のカウント仕様を明確にする

### 優先2: 撃破ログにもHIT数を表示

対象:

- `goblin_native/app/(tabs)/formation/battle-log.tsx`
- `goblin_native/src/shared/i18n/resources/{ja,en,ko}.ts`

方針:

- `targetDefeated` に `count` を含める
- 例: `342ダメージ（2回）を与えて倒した！`
- 貫通撃破ログも同様にHIT数を表示する

### 優先3: 実機確認用の倍率内訳表示を追加

実機ではコンソールログを見られないため、戦闘ログUIに一時的または開発時限定で倍率内訳を表示する。

表示候補:

```text
ATK391 / hit#8 / dmgMod x0.53 / row x1.00 / rear x1.50 / phys x1.00 / atkUp x1.00
```

必要な内部情報:

- 攻撃者ATK
- 攻撃試行番号
- 命中HIT番号
- 対象名
- ダメージ
- `baseDamage`
- `dmgMod`
- `rowDamageMultiplier`
- `rearDamageMultiplier`
- `physicalDamageFactor`
- `physicalDamageDealtMultiplier`
- `physicalReductionFactor`
- 乱数係数

### 優先4: `inspire_150` と武器レンジスキルの実戦適用を検証するテスト追加

追加したいテスト:

- 6列目の遠距離武器のみユニットが `rowDamageMultiplier = 1.0` になる
- 近接/遠距離スキルが混在すると `0.44` になる
- 前列ウォリアーが生存している場合、後列ユニットに `rearDamageMultiplier = 1.5` が乗る
- ウォリアー死亡時は乗らない
- 高命中・高攻撃回数で、ダメージ減衰が命中HIT番号ベースになる

## 現時点の判断

今回の画像は、単なる乱数や通常仕様だけでは説明しにくい。

確実に修正すべき既知バグは「ダメージ減衰が攻撃試行番号ベースになっている」点。  
ただし、それ単独でATK391のゾロがATK162のゴツゴツを下回る説明としては弱く、追加で以下のどちらかが起きている可能性がある。

- ゾロに `inspire_150` が乗っていない
- ゾロの隊列/武器レンジ補正が実戦上100%になっていない

次の作業では、ダメージ減衰修正とログ改善を入れたうえで、実機で倍率内訳を確認できるようにする。
