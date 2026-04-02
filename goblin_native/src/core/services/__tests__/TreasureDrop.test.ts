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
  dropChance: number | undefined,
  dungeonLevel: number,
  enemies: Enemy[],
  droppedIds: Set<string>,
  titleMultiplier?: number
) {
  return (engine as any).rollTreasureDrops(
    dropChance, dungeonLevel, enemies, droppedIds, titleMultiplier
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
    it('dropChance=undefined の場合、装備プールからのドロップはない', () => {
      const engine = createEngine(12345)
      const result = callRollTreasureDrops(
        engine, undefined, 1, [createDummyEnemy()], new Set()
      )
      expect(result).toEqual([])
    })

    it('dropChance=0 の場合、ドロップしない', () => {
      const engine = createEngine(12345)
      const iterations = 100
      let dropCount = 0

      for (let i = 0; i < iterations; i++) {
        const eng = createEngine(i)
        const result = callRollTreasureDrops(
          eng, 0, 1, [createDummyEnemy()], new Set()
        )
        if (result.length > 0) dropCount++
      }
      expect(dropCount).toBe(0)
    })

    it('dropChance=1.0 の場合、装備プールに候補があれば必ずドロップする', () => {
      // areaLevel=1 にはひのきの棒(dropLevelMin=1,dropLevelMax=2)がある
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return // プールが空なら skip

      const iterations = 50
      let dropCount = 0
      for (let i = 0; i < iterations; i++) {
        const eng = createEngine(i * 1000)
        const result = callRollTreasureDrops(
          eng, 1.0, 1, [createDummyEnemy()], new Set()
        )
        if (result.length > 0) dropCount++
      }
      expect(dropCount).toBe(iterations)
    })
  })

  describe('ドロップ結果の構造', () => {
    it('ドロップにtemplateId, name が含まれる', () => {
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return

      const engine = createEngine(42)
      const result = callRollTreasureDrops(
        engine, 1.0, 1, [createDummyEnemy()], new Set()
      )

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('templateId')
      expect(result[0]).toHaveProperty('name')
      expect(typeof result[0].templateId).toBe('string')
      expect(typeof result[0].name).toBe('string')
    })

    it('称号なしの場合、titleId/titleNameはundefined', () => {
      // 倍率1ではほぼ称号なし。多数試行してnoneを見つける
      let foundNone = false
      for (let seed = 0; seed < 200; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1.0, 1, [createDummyEnemy()], new Set()
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
          engine, 1.0, 1, [createDummyEnemy()], new Set(), 99
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

      const engine = createEngine(42)
      const result = callRollTreasureDrops(
        engine, 1.0, 1, [createDummyEnemy()], droppedIds
      )
      expect(result).toEqual([])
    })

    it('ドロップしたアイテムがdroppedIdsに追加される', () => {
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return

      const droppedIds = new Set<string>()
      const engine = createEngine(42)
      const result = callRollTreasureDrops(
        engine, 1.0, 1, [createDummyEnemy()], droppedIds
      )

      if (result.length > 0) {
        expect(droppedIds.has(result[0].templateId)).toBe(true)
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
          engine, 1.0, 1, [createDummyEnemy()], droppedIds
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
          engine, 1.0, 1, [createDummyEnemy()], new Set(), 1
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
          engine, 1.0, 1, [createDummyEnemy()], new Set(), 99
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

      // dropChance=0（プールからはドロップしない）で敵ドロップのみ
      const engine = createEngine(42)
      const result = callRollTreasureDrops(
        engine, 0, 1, [enemy], new Set()
      )

      expect(result.length).toBe(1)
      expect(result[0].templateId).toBe('sword_cypress_stick')
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
          engine, 0, 1, [enemy], new Set(), 99
        )

        if (result.length > 0 && result[0].titleId !== undefined) {
          foundTitle = true
          break
        }
      }
      expect(foundTitle).toBe(true)
    })
  })
})
