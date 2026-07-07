'use strict'

/**
 * 「各エリア到達時点で繁殖により現実的に入手可能な亜種/種族プール」導出モジュール。
 *
 * バランスシミュレータの統合側が「そのエリアに到達した時点で、プレイヤーが繁殖を
 * 通じて現実的にパーティへ組み込める亜種（種族バリアント）はどれか」を判断できるよう、
 * 各亜種の入手容易度（accessibility）を段階評価し、あわせて goblinVariants.ts の
 * 生の戦闘特性データ（statTraits）を返す。
 *
 * ------------------------------------------------------------------
 * 亜種入手の実プロセス（このモジュールが近似する対象）
 * ------------------------------------------------------------------
 * 亜種ゴブリンは戦闘前に決定論的に「選ぶ」ことはできず、次の2段のガチャを経て生まれる:
 *
 *   ガチャ1（因子キャリア入手）:
 *     先行エリアのボス等を周回し、factorDrops で当該亜種の因子を落とす個体を1体入手する。
 *     1周あたりのドロップ確率 = 敵JSON の probability × 到達時点で解放されている Tier 倍率。
 *     （FactorInheritanceService は「親が因子を持っている」ことを前提に継承判定するため、
 *      まず因子持ちの親を1体用意する必要がある。）
 *
 *   ガチャ2（繁殖で亜種化）:
 *     因子持ちの親を拠点に置いて繁殖させる。子は
 *       - FactorInheritanceService.evaluateInheritance で
 *         rng() < factor.inheritProbability なら因子を継承し、
 *       - 継承した因子について rng() < factor.variantConfig.probability なら亜種化する。
 *     したがって1出産あたりの亜種化確率 ≈ inheritProbability × variantProbability。
 *
 * このモジュールは世代シミュレーションまではやらず（重すぎる）、上記2段の期待手数から
 * 「入手容易度」を段階評価するに留める。実際のステータス適用（effectiveStats 再計算）は
 * 統合エージェント側の責務。
 *
 * ------------------------------------------------------------------
 * 「先行エリア」の定義
 * ------------------------------------------------------------------
 * obtainablePool.js の computeAncestors をそのまま再利用する（解放グラフ上で対象エリアの
 * 祖先＝到達経路上のエリア集合。対象エリア自身は含めない。課金解放エリアは本編の祖先で
 * ないため混入しない）。因子ドロップ源が先行エリアに存在しない亜種は unavailable とする。
 *
 * ------------------------------------------------------------------
 * 監査済みの既知事実
 * ------------------------------------------------------------------
 * harpy / hobbit / minotaur / vampire / dragon の5亜種は、どの敵JSON にも factorDrops が
 * 無く、現状どのエリアでも入手不能（accessibility='unavailable'）。
 * wolf / orc / slime / undead / hobgoblin / dwarf / elf / lizardman / troll / shadow は
 * いずれかのエリアのボス（等）に factorDrops を持つため、そのエリアが先行に入れば入手可能。
 */

require('./runtime')

const allAreaData = require('@/shared/data/expeditionArea/allArea.json')
const { getEnemyDatabase } = require('@/shared/data/enemy')
const { goblinVariantDefinitions } = require('@/shared/data/goblinVariants')
const {
  DUNGEON_TIER_SELECTABLE_MAX,
  getDungeonTierFactorDropMultiplier,
} = require('@/shared/types/DungeonTier')
const { computeAncestors } = require('./obtainablePool')

const AREAS = allAreaData.areas || []

// ============================================================================
// チューニング定数（accessibility 判定の基準。すべてここに集約し、根拠をコメントで明記）
// ============================================================================

/**
 * 因子ドロップ確率に掛ける Tier 倍率の「到達時点での上限」の近似。
 *
 * Tier が高いほど因子ドロップ確率が上がる（getDungeonTierFactorDropMultiplier）。
 * 到達時点で実際に解放済みの Tier を厳密に求めるのは複雑なため、
 * 「専念プレイヤーは先行エリアを通常選択できる最大 Tier（DUNGEON_TIER_SELECTABLE_MAX=3）
 *  まで押し上げて周回できる」という理想化した上限を全エリア共通で用いる。
 * これにより早期エリアでもドロップ確率を過小評価しすぎず、入手可否の主たる差は
 * 「因子ドロップ源が先行エリアに含まれるか」で決まる（＝進行に応じて増える）。
 *
 * getDungeonTierFactorDropMultiplier(3) = 0.045 / 0.015 = 3.0
 */
const TIER_CEILING = DUNGEON_TIER_SELECTABLE_MAX
const TIER_DROP_MULTIPLIER = getDungeonTierFactorDropMultiplier(TIER_CEILING)

/**
 * accessibility 判定に使う「入手期待手数（effortCost）」の閾値。
 *
 * effortCost = expectedBossClears + expectedBreedBirths
 *   expectedBossClears  = 1 / (best drop prob × TIER_DROP_MULTIPLIER)  … 因子キャリア入手の期待周回数
 *   expectedBreedBirths = 1 / (inheritProbability × variantProbability) … 亜種化の期待出産数
 * どちらも「1回の遠征/1回の出産」という同程度の作業単位として素朴に加算する近似。
 * 小さいほど楽。閾値は現行データ（因子ドロップ基準 1.5%、亜種の inherit×variant が
 * おおむね 0.01〜0.06）に対して、戦略ビルドへ現実的に組み込めるラインを easy/moderate、
 * 理論上は可能だが専念が要るラインを hard に切るよう調整した。
 *
 * 参考（TIER_CEILING=3, 全ソース base 0.015 の場合の effortCost）:
 *   slime 39 / hobgoblin 42 → easy
 *   wolf 49 / shadow* 68 / undead 55 / orc 72 / elf 72 / dwarf 72 → moderate
 *   lizardman 89 / troll 105 → hard
 *   （* shadow のドロップ源 cat_fortress_1 は課金解放エリアで本編の祖先に入らないため、
 *      本編エリアでは実際には unavailable になりやすい）
 */
const EFFORT_EASY_MAX = 45
const EFFORT_MODERATE_MAX = 75
// effortCost > EFFORT_MODERATE_MAX かつドロップ源ありなら 'hard'
// ドロップ源が先行エリアに無ければ 'unavailable'

/**
 * 統合側が threshold で絞り込むための順序。'easy' と 'moderate' までを「戦略ビルドに
 * 使ってよい現実的なプール」、'hard' を「理論上のみ／専念前提」とする想定。
 */
const ACCESSIBILITY_ORDER = ['unavailable', 'hard', 'moderate', 'easy']
const STRATEGIC_THRESHOLD = 'moderate' // これ以上（moderate/easy）を実用プールとして推奨

// ============================================================================
// 因子ドロップ源マップの構築（全エリアを走査。areaId 単位で保持）
// ============================================================================

/**
 * factorId -> [{ areaId, probability, isBoss }] のグローバルなドロップ源マップ。
 * probability は敵JSON の生値（Tier 倍率は判定時に掛ける）。
 */
const FACTOR_DROP_SOURCES = (() => {
  const map = new Map()
  for (const area of AREAS) {
    const db = getEnemyDatabase(area.id)
    if (!db || !Array.isArray(db.enemies)) continue
    for (const enemy of db.enemies) {
      for (const drop of enemy.factorDrops || []) {
        if (!drop || !drop.factorId) continue
        if (!map.has(drop.factorId)) map.set(drop.factorId, [])
        map.get(drop.factorId).push({
          areaId: area.id,
          probability: drop.probability ?? 0,
          isBoss: enemy.isBoss === true,
        })
      }
    }
  }
  return map
})()

// ============================================================================
// accessibility 評価
// ============================================================================

/**
 * ある亜種について、先行エリア集合の中でのドロップ源と入手容易度を評価する。
 *
 * @param {object} variant goblinVariantDefinitions のエントリ
 * @param {Set<string>} precedingAreaIds 対象エリアの先行エリアID集合
 */
function evaluateVariantAccessibility(variant, precedingAreaIds) {
  const factorId = variant.factorId
  const allSources = FACTOR_DROP_SOURCES.get(factorId) || []
  const reachableSources = allSources.filter(s => precedingAreaIds.has(s.areaId))

  // ドロップ源が先行エリアに無い（＝そもそもゲーム中に源が無い5亜種、または
  // 源はあるが到達時点でまだ解放されていない）→ unavailable
  if (reachableSources.length === 0) {
    return {
      accessibility: 'unavailable',
      effortCost: Infinity,
      effectiveDropProb: 0,
      breedProb: variant.inheritProbability * variant.variantProbability,
      reachableSources,
      note:
        allSources.length === 0
          ? `因子 ${factorId} を落とす敵が存在せず入手不能（監査済みの入手不能亜種）`
          : `因子 ${factorId} のドロップ源(${allSources.map(s => s.areaId).join('/')})が到達時点で未解放`,
    }
  }

  // ガチャ1: 因子キャリア入手（先行エリア内で最も高いドロップ確率を採用）
  const effectiveDropProb = Math.max(
    ...reachableSources.map(s => s.probability * TIER_DROP_MULTIPLIER)
  )
  const expectedBossClears = effectiveDropProb > 0 ? 1 / effectiveDropProb : Infinity

  // ガチャ2: 繁殖で亜種化
  const breedProb = variant.inheritProbability * variant.variantProbability
  const expectedBreedBirths = breedProb > 0 ? 1 / breedProb : Infinity

  const effortCost = expectedBossClears + expectedBreedBirths

  let accessibility
  if (effortCost <= EFFORT_EASY_MAX) accessibility = 'easy'
  else if (effortCost <= EFFORT_MODERATE_MAX) accessibility = 'moderate'
  else accessibility = 'hard'

  const bestSource = reachableSources.reduce((a, b) => (b.probability > a.probability ? b : a))
  const note =
    `${bestSource.areaId} のボス(因子${(bestSource.probability * 100).toFixed(1)}%×Tier上限${TIER_DROP_MULTIPLIER.toFixed(1)}` +
    `=約${(effectiveDropProb * 100).toFixed(1)}%)から因子入手→繁殖(継承${variant.inheritProbability}×亜種化${variant.variantProbability}` +
    `=約${(breedProb * 100).toFixed(1)}%/出産)。期待手数≈${Math.round(effortCost)}`

  return { accessibility, effortCost, effectiveDropProb, breedProb, reachableSources, note }
}

/**
 * goblinVariants.ts の生データから戦闘特性（statTraits）を正確に写す。
 * 実際のステータス適用は統合側が行うため、ここでは生データの受け渡しに徹する。
 */
function extractStatTraits(variant) {
  return {
    raceId: variant.raceId,
    raceName: variant.raceName,
    factorEffects: variant.factorEffects,        // stat_bonus の配列（戦闘補正の主因）
    baseAttributes: variant.baseAttributes,      // 種族の基礎能力値（未定義なら純ゴブリン準拠）
    hpCoefficient: variant.hpCoefficient,        // HP 係数（未定義なら基準1.0相当）
    defaultSkillIds: variant.defaultSkillIds || [], // 種族デフォルトスキル
  }
}

const _cache = new Map()

/**
 * deriveBreedingPool(areaId) — 到達時点で繁殖入手可能な亜種プールを返す。
 *
 * @param {string} areaId 対象エリアID
 * @returns {{
 *   areaId: string,
 *   precedingAreaIds: string[],
 *   tierCeiling: number,
 *   tierDropMultiplier: number,
 *   strategicThreshold: 'easy'|'moderate'|'hard'|'unavailable',
 *   factors: string[],                         // 先行エリアのボス等から入手可能な因子ID
 *   variants: Array<{
 *     id: string,                              // 亜種ID（= factorId, 例 'wolf'）
 *     factorId: string,
 *     accessibility: 'easy'|'moderate'|'hard'|'unavailable',
 *     statTraits: object,                      // goblinVariants 由来の生の戦闘特性
 *     note: string,                            // 入手経路の要約
 *   }>
 * }}
 */
function deriveBreedingPool(areaId) {
  if (_cache.has(areaId)) return _cache.get(areaId)

  const ancestorSet = computeAncestors(areaId)
  const precedingAreaIds = [...ancestorSet].sort()

  // 到達時点で入手可能な因子（先行エリアにドロップ源があるもの）
  const factorSet = new Set()
  for (const [factorId, sources] of FACTOR_DROP_SOURCES) {
    if (sources.some(s => ancestorSet.has(s.areaId))) factorSet.add(factorId)
  }

  // 全亜種を評価
  const variants = Object.values(goblinVariantDefinitions)
    .map(variant => {
      const evaluated = evaluateVariantAccessibility(variant, ancestorSet)
      return {
        id: variant.factorId,
        factorId: variant.factorId,
        accessibility: evaluated.accessibility,
        statTraits: extractStatTraits(variant),
        note: evaluated.note,
        // 補助情報（統合側の絞り込み/デバッグ用。仕様外だが有用なので同梱）
        effortCost: evaluated.effortCost,
        effectiveDropProb: evaluated.effectiveDropProb,
        breedProb: evaluated.breedProb,
      }
    })
    // 入手しやすい順→IDでソート（決定論）
    .sort((a, b) => {
      const oa = ACCESSIBILITY_ORDER.indexOf(a.accessibility)
      const ob = ACCESSIBILITY_ORDER.indexOf(b.accessibility)
      if (oa !== ob) return ob - oa
      return a.id.localeCompare(b.id)
    })

  const result = {
    areaId,
    precedingAreaIds,
    tierCeiling: TIER_CEILING,
    tierDropMultiplier: TIER_DROP_MULTIPLIER,
    strategicThreshold: STRATEGIC_THRESHOLD,
    factors: [...factorSet].sort(),
    variants,
  }
  _cache.set(areaId, result)
  return result
}

/**
 * accessibility が「戦略ビルドに使える」水準（moderate 以上）か判定するユーティリティ。
 * 統合側が threshold で絞る際のヘルパー（任意利用）。
 */
function isStrategicallyObtainable(accessibility, threshold = STRATEGIC_THRESHOLD) {
  return ACCESSIBILITY_ORDER.indexOf(accessibility) >= ACCESSIBILITY_ORDER.indexOf(threshold)
}

module.exports = {
  deriveBreedingPool,
  isStrategicallyObtainable,
  ACCESSIBILITY_ORDER,
  STRATEGIC_THRESHOLD,
  TIER_CEILING,
  TIER_DROP_MULTIPLIER,
  FACTOR_DROP_SOURCES,
}

// ============================================================================
// 自己テスト: `node scripts/balance/headless/breedingPool.js`
// ============================================================================
if (require.main === module) {
  const SAMPLE_AREAS = ['goblin_village_1', 'wolf_grassland_1', 'royal_capital_1']
  const UNAVAILABLE_5 = ['harpy', 'hobbit', 'minotaur', 'vampire', 'dragon']

  const fmt = v =>
    `${v.id.padEnd(11)} ${v.accessibility.padEnd(11)} ` +
    `(effort≈${Number.isFinite(v.effortCost) ? Math.round(v.effortCost) : '∞'})`

  const obtainableCounts = {}

  for (const areaId of SAMPLE_AREAS) {
    const pool = deriveBreedingPool(areaId)
    console.log('\n' + '='.repeat(72))
    console.log(`エリア: ${areaId}`)
    console.log(`先行エリア(${pool.precedingAreaIds.length}): ${pool.precedingAreaIds.join(', ')}`)
    console.log(`Tier上限=${pool.tierCeiling} ドロップ倍率=${pool.tierDropMultiplier.toFixed(2)} 推奨閾値=${pool.strategicThreshold}`)
    console.log(`入手可能因子(${pool.factors.length}): ${pool.factors.join(', ') || '(なし)'}`)
    console.log('亜種 accessibility:')
    for (const v of pool.variants) console.log('  ' + fmt(v) + '  ' + v.note)

    const obtainable = pool.variants.filter(v => v.accessibility !== 'unavailable').map(v => v.id)
    obtainableCounts[areaId] = obtainable.length
    console.log(`→ 入手可能亜種(${obtainable.length}): ${obtainable.join(', ') || '(なし)'}`)
  }

  console.log('\n' + '='.repeat(72))
  console.log('検証結果:')

  // (a) 進行に応じて入手可能亜種が増える（単調増加）
  const c1 = obtainableCounts['goblin_village_1']
  const c2 = obtainableCounts['wolf_grassland_1']
  const c3 = obtainableCounts['royal_capital_1']
  const monotonic = c1 <= c2 && c2 <= c3
  console.log(`(a) 入手可能亜種数 ${c1} <= ${c2} <= ${c3} : ${monotonic ? 'OK' : 'NG'}`)

  // (b) 5亜種が全エリアで unavailable
  let allUnavailable = true
  for (const areaId of SAMPLE_AREAS) {
    const pool = deriveBreedingPool(areaId)
    for (const id of UNAVAILABLE_5) {
      const v = pool.variants.find(x => x.id === id)
      if (!v || v.accessibility !== 'unavailable') {
        allUnavailable = false
        console.log(`   NG: ${areaId} の ${id} が ${v ? v.accessibility : '不在'}`)
      }
    }
  }
  console.log(`(b) 5亜種 [${UNAVAILABLE_5.join(', ')}] が全エリアで unavailable : ${allUnavailable ? 'OK' : 'NG'}`)

  // (c) 同一入力で決定論（キャッシュ無効化して2回比較）
  _cache.clear()
  const first = JSON.stringify(deriveBreedingPool('wolf_grassland_1'))
  _cache.clear()
  const second = JSON.stringify(deriveBreedingPool('wolf_grassland_1'))
  const deterministic = first === second
  console.log(`(c) 同一入力で決定論 : ${deterministic ? 'OK' : 'NG'}`)

  const allOk = monotonic && allUnavailable && deterministic
  console.log('\n総合: ' + (allOk ? 'ALL PASS' : 'FAIL'))
  if (!allOk) process.exitCode = 1
}
