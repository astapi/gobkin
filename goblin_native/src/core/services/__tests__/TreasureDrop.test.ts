import { ExpeditionEngine } from '../ExpeditionEngine'
import { getEquipmentByDungeonLevel } from '../../../shared/data/equipmentPoolLoader'
import type { Enemy } from '../../../shared/types'

/**
 * ExpeditionEngine の private メソッド rollTreasureDrops をテストするため、
 * 固定シードでインスタンスを生成し、内部の rng を利用する。
 */
function createEngine(seed: number): ExpeditionEngine {
  return new ExpeditionEngine(seed)
}

/** privateメソッドにアクセスするヘルパー */
function callRollTreasureDrops(
  engine: ExpeditionEngine,
  dungeonLevel: number,
  enemies: Enemy[],
  droppedIds: Set<string>,
  titleMultiplier?: number
) {
  return (engine as any).rollTreasureDrops(
    dungeonLevel, enemies, droppedIds, titleMultiplier
  )
}

/** テスト用の最小限の敵 */
function createDummyEnemy(overrides?: Partial<Enemy>): Enemy {
  return {
    id: 'test_enemy',
    name: 'テスト敵',
    level: 1,
    stats: { hp: 10, atk: 5, def: 3, spd: 3, sp: 2 },
    gold: 10,
    xp: 5,
    skills: [],
    ...overrides,
  } as Enemy
}

describe('rollTreasureDrops', () => {
  describe('ドロップ確率の基本動作', () => {
    it('一律25%のドロップ確率で装備がドロップする', () => {
      // areaLevel=1 にはひのきの棒(dropLevelMin=1,dropLevelMax=2)がある
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return // プールが空なら skip

      const iterations = 1000
      let dropCount = 0
      for (let i = 0; i < iterations; i++) {
        const eng = createEngine(i * 1000)
        const result = callRollTreasureDrops(
          eng, 1, [createDummyEnemy()], new Set()
        )
        if (result.length > 0) dropCount++
      }
      // 25%前後であることを確認（15%〜35%の範囲）
      const rate = dropCount / iterations
      expect(rate).toBeGreaterThan(0.15)
      expect(rate).toBeLessThan(0.35)
    })
  })

  describe('ドロップ結果の構造', () => {
    it('ドロップにtemplateId, name が含まれる', () => {
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return

      // 確実にドロップするシードを探す
      let result: any[] = []
      for (let seed = 0; seed < 100; seed++) {
        const engine = createEngine(seed)
        result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], new Set()
        )
        if (result.length > 0) break
      }

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('templateId')
      expect(result[0]).toHaveProperty('name')
      expect(typeof result[0].templateId).toBe('string')
      expect(typeof result[0].name).toBe('string')
    })

    it('称号なしの場合、titleId/titleNameはundefined', () => {
      // 倍率1ではほぼ称号なし。多数試行してnoneを見つける
      let foundNone = false
      for (let seed = 0; seed < 500; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], new Set()
        )
        if (result.length > 0 && result[0].titleId === undefined) {
          expect(result[0].titleName).toBeUndefined()
          foundNone = true
          break
        }
      }
      expect(foundNone).toBe(true)
    })

    it('称号ありの場合、titleIdとtitleNameが設定される', () => {
      // 倍率99で多数試行して称号付きを見つける
      let foundTitle = false
      for (let seed = 0; seed < 500; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], new Set(), 99
        )
        if (result.length > 0 && result[0].titleId !== undefined) {
          expect(typeof result[0].titleId).toBe('string')
          expect(typeof result[0].titleName).toBe('string')
          expect(result[0].titleName!.length).toBeGreaterThan(0)
          // 装備名に称号が接頭辞として含まれる
          expect(result[0].name).toContain(result[0].titleName!)
          foundTitle = true
          break
        }
      }
      expect(foundTitle).toBe(true)
    })
  })

  describe('重複防止', () => {
    it('droppedIdsに含まれるテンプレートはドロップしない', () => {
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return

      // 全候補をdroppedIdsに入れる
      const droppedIds = new Set(pool.map(t => t.id))

      // ドロップするシードを探して実行
      for (let seed = 0; seed < 100; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], droppedIds
        )
        // プールからのドロップは全て除外されるため空
        expect(result).toEqual([])
      }
    })

    it('ドロップしたアイテムがdroppedIdsに追加される', () => {
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return

      const droppedIds = new Set<string>()

      // ドロップするシードを探す
      for (let seed = 0; seed < 100; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], droppedIds
        )
        if (result.length > 0) {
          expect(droppedIds.has(result[0].templateId)).toBe(true)
          return
        }
      }
    })

    it('同一遠征で同じ装備は2回ドロップしない', () => {
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return

      const droppedIds = new Set<string>()
      const allDroppedTemplates: string[] = []

      // 同じdroppedIdsを使い回して複数回ドロップ
      for (let i = 0; i < 50; i++) {
        const engine = createEngine(i * 100)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], droppedIds
        )
        for (const drop of result) {
          allDroppedTemplates.push(drop.templateId)
        }
      }

      // 重複がないことを確認
      const unique = new Set(allDroppedTemplates)
      expect(unique.size).toBe(allDroppedTemplates.length)
    })
  })

  describe('称号付与倍率の統合', () => {
    it('titleMultiplier=1 では称号なしが大半', () => {
      let titleCount = 0
      let totalDrops = 0
      const iterations = 500

      for (let seed = 0; seed < iterations; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], new Set(), 1
        )
        for (const drop of result) {
          totalDrops++
          if (drop.titleId !== undefined) titleCount++
        }
      }

      if (totalDrops > 0) {
        expect(titleCount / totalDrops).toBeLessThan(0.20)
      }
    })

    it('titleMultiplier=99 では称号付きが増加する', () => {
      let titleCount = 0
      let totalDrops = 0
      const iterations = 500

      for (let seed = 0; seed < iterations; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], new Set(), 99
        )
        for (const drop of result) {
          totalDrops++
          if (drop.titleId !== undefined) titleCount++
        }
      }

      if (totalDrops > 0) {
        // 99倍では90%以上が称号付き
        expect(titleCount / totalDrops).toBeGreaterThan(0.85)
      }
    })
  })

  describe('敵個別ドロップ', () => {
    it('敵のequipmentDropsからドロップする', () => {
      const enemy = createDummyEnemy({
        equipmentDrops: [
          { templateId: 'sword_cypress_stick', probability: 1.0 },
        ],
      })

      // 敵ドロップは装備プール抽選とは独立に判定される
      let found = false
      for (let seed = 0; seed < 100; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, [enemy], new Set()
        )
        const enemyDrop = result.find((d: any) => d.templateId === 'sword_cypress_stick')
        if (enemyDrop) {
          expect(enemyDrop.templateId).toBe('sword_cypress_stick')
          found = true
          break
        }
      }
      expect(found).toBe(true)
    })

    it('敵ドロップにも称号が付与される', () => {
      let foundTitle = false

      for (let seed = 0; seed < 500; seed++) {
        const enemy = createDummyEnemy({
          equipmentDrops: [
            { templateId: 'sword_cypress_stick', probability: 1.0 },
          ],
        })

        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, [enemy], new Set(), 99
        )

        const enemyDrop = result.find((d: any) => d.templateId === 'sword_cypress_stick')
        if (enemyDrop && enemyDrop.titleId !== undefined) {
          foundTitle = true
          break
        }
      }
      expect(foundTitle).toBe(true)
    })
  })
})
