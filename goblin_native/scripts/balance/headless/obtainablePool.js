'use strict'

/**
 * 「到達時点で入手可能な要素」プール導出モジュール。
 *
 * バランスシミュレータの median / ceiling ペルソナが「そのエリアに到達した時点で
 * プレイヤーが現実的に入手できる装備・因子」だけでビルドを組めるように、
 * 解放グラフ（allArea.json の unlockNext / unlockNexts / unlockRequires）を辿って
 * 先行エリアを特定し、そこから得られる要素を列挙する。
 *
 * ------------------------------------------------------------------
 * 「先行エリア」の定義（設計判断）
 * ------------------------------------------------------------------
 * 対象エリア A の「先行エリア」= 解放グラフ上で A の祖先（A に到達する経路上の
 * すべてのエリア）とする。逆辺は次の3種から構成する:
 *   - C.unlockNext = t         → t の先行に C
 *   - C.unlockNexts[] = t       → t の先行に C
 *   - A.unlockRequires = R      → A の先行に R
 * A 自身は含めない（原則「到達時点」= まだ A はクリアしていない）。
 * 課金解放エリア（cat_fortress_1 / necromancer_crypt_1）は本編エリアの祖先では
 * ないため、本編エリアのプールには混入しない（= 到達時点の入手可能性を過大評価しない）。
 * この定義は masterDataIntegrity.unlock.test.ts の BFS と同じ辺集合を使うが、
 * あちらは「ルートからの到達可能性」、こちらは「A への祖先」を求める点が異なる。
 *
 * ------------------------------------------------------------------
 * 入手可能な要素
 * ------------------------------------------------------------------
 * 装備（equipmentTemplateIds）:
 *   1. ノーマルドロップ: 先行エリアの敵レベルから rollDropRank（DropRankRoller）で
 *      到達し得る最大ランク ceiling を求め、rank <= ceiling の全テンプレートを含める。
 *   2. レアドロップ: 先行エリアの敵の rareEquipmentDrops.templateId と
 *      tierRareEquipmentDrops[].drops[].templateId（全Tier。先行エリアは任意Tierで
 *      周回できるため）。
 *   3. ショップ購入: unlockRank <= estimatedBaseRank のテンプレート。拠点ランクは
 *      エリア解放グラフと直接対応しないため、先行エリアの最大 areaLevel から拠点ランクを
 *      近似する（estimatedBaseRankFromAreaLevel）。unlockRank の実在値は {1,2,3,5}。
 *
 * 因子（factorIds）:
 *   先行エリアのボスの factorDrops.factorId のうち factorDatabase に実在するもの。
 *
 * 種族 / 継承スキル（設計判断）:
 *   種族バリアントも因子継承も、実装上は出産時の確率抽選（variantProbability /
 *   inheritProbability）でしか付与されず、プレイヤーが戦闘前に決定論的に「選ぶ」ことは
 *   できない。したがって種族は床ペルソナと同じ純ゴブリン + 種族デフォルトスキル
 *   （goblin_pack_tactics）に固定する。因子だけは「専念すれば当該因子持ちの個体を
 *   入手できる」という理想化のもとでビルド要素として扱う（median/ceiling で付与可）。
 */

require('./runtime')

const allAreaData = require('@/shared/data/expeditionArea/allArea.json')
const { getEnemyDatabase } = require('@/shared/data/enemy')
const { getEquipmentTemplates, getEquipmentTemplate } = require('@/shared/data/equipmentPoolLoader')
const { DROP_RANK_TABLE, findStartStepIndex } = require('@/core/services/DropRankRoller')
const { factorDatabase } = require('@/shared/data/factors')

const AREAS = allAreaData.areas || []
const AREA_BY_ID = new Map(AREAS.map(a => [a.id, a]))

// --- 逆辺（predecessor）グラフを構築 ------------------------------------------
const PREDECESSORS = new Map() // areaId -> Set<予測先行areaId>
function addPred(target, pred) {
  if (!target || !pred || target === pred) return
  if (!PREDECESSORS.has(target)) PREDECESSORS.set(target, new Set())
  PREDECESSORS.get(target).add(pred)
}
for (const area of AREAS) {
  if (area.unlockNext) addPred(area.unlockNext, area.id)
  for (const t of area.unlockNexts || []) addPred(t, area.id)
  if (area.unlockRequires) addPred(area.id, area.unlockRequires)
}

/**
 * 対象エリアの祖先（先行エリア）ID集合を返す。A 自身は含めない。
 */
function computeAncestors(areaId) {
  const ancestors = new Set()
  const queue = [areaId]
  const seen = new Set([areaId])
  while (queue.length > 0) {
    const cur = queue.shift()
    for (const pred of PREDECESSORS.get(cur) || []) {
      if (!seen.has(pred)) {
        seen.add(pred)
        ancestors.add(pred)
        queue.push(pred)
      }
    }
  }
  return ancestors
}

/**
 * 敵レベルからノーマルドロップで到達し得る最大ランクを返す。
 * rollDropRank は findStartStepIndex から下へしか落ちないため、上限＝開始段のランク。
 */
function maxDropRankForEnemyLevel(level) {
  return DROP_RANK_TABLE[findStartStepIndex(level)].rank
}

/**
 * 先行エリアの最大 areaLevel から拠点ランク（ショップ品揃え）を近似する。
 * unlockRank の実在値 {1,2,3,5} に合わせた素朴な段階マップ。
 */
function estimatedBaseRankFromAreaLevel(maxAreaLevel) {
  if (maxAreaLevel <= 3) return 1
  if (maxAreaLevel <= 12) return 2
  if (maxAreaLevel <= 25) return 3
  return 5
}

const _cache = new Map()

/**
 * deriveObtainablePool(areaId) — 到達時点で入手可能な装備テンプレID / 因子ID を返す。
 *
 * @returns {{
 *   areaId: string,
 *   precedingAreaIds: string[],
 *   normalRankCeiling: number,
 *   estimatedBaseRank: number,
 *   equipmentTemplateIds: string[],
 *   equipmentBySource: { normal: string[], rare: string[], shop: string[] },
 *   factorIds: string[],
 * }}
 */
function deriveObtainablePool(areaId) {
  if (_cache.has(areaId)) return _cache.get(areaId)

  const ancestors = computeAncestors(areaId)
  const precedingAreaIds = [...ancestors].sort()

  // 先行エリアの敵を集約
  const enemies = []
  let maxAreaLevel = 0
  for (const pid of precedingAreaIds) {
    const area = AREA_BY_ID.get(pid)
    if (area) maxAreaLevel = Math.max(maxAreaLevel, area.areaLevel || 0)
    const db = getEnemyDatabase(pid)
    if (db && Array.isArray(db.enemies)) enemies.push(...db.enemies)
  }

  // 1. ノーマルドロップランク上限
  let normalRankCeiling = -1
  for (const e of enemies) {
    normalRankCeiling = Math.max(normalRankCeiling, maxDropRankForEnemyLevel(e.level || 1))
  }

  const allTemplates = getEquipmentTemplates()

  const normalSet = new Set()
  if (normalRankCeiling >= 0) {
    for (const t of allTemplates) {
      if (t.rank !== undefined && t.rank <= normalRankCeiling) normalSet.add(t.id)
    }
  }

  // 2. レアドロップ（全Tier）
  const rareSet = new Set()
  for (const e of enemies) {
    for (const d of e.rareEquipmentDrops || []) {
      if (getEquipmentTemplate(d.templateId)) rareSet.add(d.templateId)
    }
    for (const tier of e.tierRareEquipmentDrops || []) {
      for (const d of tier.drops || []) {
        if (getEquipmentTemplate(d.templateId)) rareSet.add(d.templateId)
      }
    }
  }

  // 3. ショップ購入
  const estimatedBaseRank = estimatedBaseRankFromAreaLevel(maxAreaLevel)
  const shopSet = new Set()
  for (const t of allTemplates) {
    if (t.unlockRank !== undefined && t.unlockRank <= estimatedBaseRank) shopSet.add(t.id)
  }

  const equipmentTemplateIds = [...new Set([...normalSet, ...rareSet, ...shopSet])].sort()

  // 因子（先行ボス）
  const factorSet = new Set()
  for (const e of enemies) {
    for (const fd of e.factorDrops || []) {
      if (factorDatabase[fd.factorId]) factorSet.add(fd.factorId)
    }
  }

  const result = {
    areaId,
    precedingAreaIds,
    normalRankCeiling,
    estimatedBaseRank,
    equipmentTemplateIds,
    equipmentBySource: {
      normal: [...normalSet].sort(),
      rare: [...rareSet].sort(),
      shop: [...shopSet].sort(),
    },
    factorIds: [...factorSet].sort(),
  }
  _cache.set(areaId, result)
  return result
}

module.exports = {
  deriveObtainablePool,
  computeAncestors,
  maxDropRankForEnemyLevel,
  estimatedBaseRankFromAreaLevel,
}
