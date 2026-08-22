/**
 * マスターデータ整合性ラチェットテスト: 報酬効率の逆転
 *
 * 「探索時間あたりの期待ゴールド」を簡易指標として、解放グラフ上で
 * 親エリア(先に解放される側) -> 子エリア(後に解放される側) と進むときに
 * 効率が明確に(閾値以上)下がるペアを検出し、KNOWN_REWARD_INVERSIONSと
 * 完全一致することを確認するラチェット。
 *
 * 指標の定義:
 *   efficiency(area) = mean(area内の敵のgold) * floors / exploration_time_sec
 *   (1周あたりの推定ゴールド ÷ 定常状態の探索所要秒数。フロア数を掛けることで
 *    フロア数の違いをある程度均している。厳密なドロップ確率までは加味しない)
 *
 * 比較対象は「到達可能なエリア間の解放グラフの辺(unlockNext/unlockNexts)」のみ。
 * 到達不能な既知エリア(masterDataIntegrity.unlock.test.ts の
 * KNOWN_UNREACHABLE_AREAS参照)は現状プレイヤーが実際に辿る進行順ではないため対象外。
 *
 * 閾値は誤検知を避けるため緩め(20%以上の低下のみ違反扱い)。
 * このリストは「バランス調整保留中」の既知事項を固定するためのものであり、
 * 新しい逆転が増えた場合、または既存の逆転が解消された場合の両方を検知する。
 */
import { areasData } from '..'
import { getEnemyDatabase } from '../enemy'
import type { Dungeon } from '../../types'

/** 課金（サイドストーリー）で直接解放されるエリアID一覧。
 * 参照元: src/shared/constants/purchases.ts SHADOW_CAT_DUNGEON_ID / NECROMANCER_DUNGEON_ID
 * （react-native に依存するため import せず値だけ複製。詳細は masterDataIntegrity.unlock.test.ts）
 */
const PURCHASE_UNLOCKED_AREA_IDS = ['cat_fortress_1', 'necromancer_crypt_1']

/** 効率低下とみなす閾値(この割合以上下がったら違反扱い) */
const DROP_THRESHOLD = 0.2

/**
 * 既知の報酬効率逆転ペア。"parentAreaId->childAreaId" 形式。
 * 解放グラフの辺(親が先に解放され、クリアすると子が解放される)を進むと、
 * 探索時間あたりの期待ゴールド効率が20%以上低下するペア。
 */
const KNOWN_REWARD_INVERSIONS = [
  'slime_cave->forest_outskirts',
  'forest_outskirts->goblin_village_1',
  'goblin_village_1->forest_edge_village',
  'undead_ruins_1->bandit_hideout',
  'road_1->orc_camp_1',
  'orc_camp_1->orc_fortress_1',
  'wolf_grassland_1->lizardman_swamp_1',
  'spider_forest_1->dead_grave_1',
  // 2026-08 イベントダンジョン追加時の変化:
  //  - harpy_cliff_1->human_fortress_1 は平原会戦(margrave_sortie_1)の挿入とgold調整で解消
  //  - vampire_castle_1->royal_capital_1 は王都平原会戦(royal_field_battle_1)の挿入で辺自体が消滅し、
  //    王都1の報酬の薄さは royal_field_battle_1->royal_capital_1 として残る(構造は同じ・調整保留)
  'royal_field_battle_1->royal_capital_1',
  'dragon_volcano_1->royal_capital_3',
].sort()

function computeReachableAreaIds(allAreas: Dungeon[]): Set<string> {
  const areaById = new Map(allAreas.map(area => [area.id, area]))
  const roots = allAreas
    .filter((area, index) => area.unlocked === true || index === 0)
    .map(area => area.id)

  const queue = [...roots, ...PURCHASE_UNLOCKED_AREA_IDS]
  const reachable = new Set<string>(queue)

  while (queue.length > 0) {
    const currentId = queue.shift() as string
    const current = areaById.get(currentId)
    if (!current) continue

    const targets = [
      ...(current.unlockNext ? [current.unlockNext] : []),
      ...(current.unlockNexts ?? []),
    ]
    for (const targetId of targets) {
      if (!reachable.has(targetId)) {
        reachable.add(targetId)
        queue.push(targetId)
      }
    }
  }
  return reachable
}

function computeEfficiency(area: Dungeon): number {
  const database = getEnemyDatabase(area.id)
  const enemies = database?.enemies ?? []
  const meanGold = enemies.reduce((sum, enemy) => sum + enemy.gold, 0) / enemies.length
  return (meanGold * area.floors) / area.exploration_time_sec
}

function computeInversionEdges(): string[] {
  const reachable = computeReachableAreaIds(areasData)
  const efficiencyById = new Map(areasData.map(area => [area.id, computeEfficiency(area)]))

  const violations: string[] = []
  for (const area of areasData) {
    if (!reachable.has(area.id)) continue

    const targets = [
      ...(area.unlockNext ? [area.unlockNext] : []),
      ...(area.unlockNexts ?? []),
    ]

    for (const targetId of targets) {
      if (!reachable.has(targetId)) continue

      const parentEfficiency = efficiencyById.get(area.id)
      const childEfficiency = efficiencyById.get(targetId)
      if (parentEfficiency === undefined || childEfficiency === undefined) continue

      const drop = 1 - childEfficiency / parentEfficiency
      if (drop >= DROP_THRESHOLD) {
        violations.push(`${area.id}->${targetId}`)
      }
    }
  }
  return violations.sort()
}

describe('報酬効率逆転ラチェット', () => {
  it('解放グラフを進むと報酬効率(gold/sec目安)が20%以上下がるペアがKNOWN_REWARD_INVERSIONSと一致する', () => {
    const actualInversions = computeInversionEdges()

    const newInversions = actualInversions.filter(edge => !KNOWN_REWARD_INVERSIONS.includes(edge))
    const resolvedInversions = KNOWN_REWARD_INVERSIONS.filter(edge => !actualInversions.includes(edge))

    expect({ newInversions, resolvedInversions }).toEqual({
      newInversions: [],
      resolvedInversions: [],
    })

    expect(actualInversions).toEqual(KNOWN_REWARD_INVERSIONS)
  })

  it('KNOWN_REWARD_INVERSIONSの各ペアは実在するエリアIDかつ解放グラフの辺として実在する', () => {
    const areaById = new Map(areasData.map(area => [area.id, area]))
    for (const edge of KNOWN_REWARD_INVERSIONS) {
      const [parentId, childId] = edge.split('->')
      const parent = areaById.get(parentId)
      expect(parent).toBeDefined()
      const targets = [
        ...(parent?.unlockNext ? [parent.unlockNext] : []),
        ...(parent?.unlockNexts ?? []),
      ]
      expect(targets).toContain(childId)
    }
  })
})
