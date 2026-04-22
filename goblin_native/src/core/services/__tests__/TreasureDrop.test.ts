import { ExpeditionEngine } from '../ExpeditionEngine'
import { getEquipmentByRank, getEquipmentTemplate, getShopEquipment } from '../../../shared/data/equipmentPoolLoader'
import type { Enemy, PartyRewardMultipliers } from '../../../shared/types'

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
  enemies: Enemy[],
  droppedIds: Set<string>,
  rewardMultipliers?: Partial<PartyRewardMultipliers>
) {
  return (engine as any).rollTreasureDrops(enemies, droppedIds, rewardMultipliers)
}

/** テスト用の最小限の敵（デフォルトは rank 0 が落ちるレベル1） */
function createDummyEnemy(overrides?: Partial<Enemy>): Enemy {
  return {
    id: 'test_enemy',
    name: 'テスト敵',
    raceTags: ['beast'],
    level: 1,
    hp: 10,
    atk: 5,
    def: 3,
    agility: 3,
    attackCount: 1,
    accuracy: 10,
    evasion: 0,
    gold: 10,
    xp: 5,
    skills: [],
    ...overrides,
  } as Enemy
}

describe('rollTreasureDrops', () => {
  describe('アイテムランク定義', () => {
    it('最大ランクは 8。rank 0 は1カテゴリに複数個ありうる', () => {
      // 剣（11アイテム: 下位3つはrank 0、その後1刻みで8まで）
      expect(getEquipmentTemplate('sword_cypress_stick')?.rank).toBe(0)
      expect(getEquipmentTemplate('sword_club')?.rank).toBe(0)
      expect(getEquipmentTemplate('sword_copper')?.rank).toBe(0)
      expect(getEquipmentTemplate('sword_broad')?.rank).toBe(1)
      expect(getEquipmentTemplate('sword_long')?.rank).toBe(2)
      expect(getEquipmentTemplate('sword_mithril')?.rank).toBe(3)
      expect(getEquipmentTemplate('sword_royal')?.rank).toBe(4)
      expect(getEquipmentTemplate('sword_kaiser')?.rank).toBe(5)
      expect(getEquipmentTemplate('sword_ancient')?.rank).toBe(6)
      expect(getEquipmentTemplate('sword_dragon')?.rank).toBe(7)
      expect(getEquipmentTemplate('sword_adamant')?.rank).toBe(8)

      // 爪（剣と同じ配列）
      expect(getEquipmentTemplate('claw_sharp')?.rank).toBe(0)
      expect(getEquipmentTemplate('claw_beast')?.rank).toBe(0)
      expect(getEquipmentTemplate('claw_copper')?.rank).toBe(0)
      expect(getEquipmentTemplate('claw_adamant')?.rank).toBe(8)

      // 弓（9アイテム: 0〜8）
      expect(getEquipmentTemplate('bow_slingshot')?.rank).toBe(0)
      expect(getEquipmentTemplate('bow_adamant')?.rank).toBe(8)

      // 鎧（10アイテム: 下位2つがrank 0）
      expect(getEquipmentTemplate('armor_tattered_cloth')?.rank).toBe(0)
      expect(getEquipmentTemplate('armor_leather_vest')?.rank).toBe(0)
      expect(getEquipmentTemplate('armor_fur_vest')?.rank).toBe(1)
      expect(getEquipmentTemplate('armor_adamant')?.rank).toBe(8)

      // 盾（9アイテム: 0〜8、入門帯を追加）
      expect(getEquipmentTemplate('shield_pot_lid')?.rank).toBe(0)
      expect(getEquipmentTemplate('shield_wooden')?.rank).toBe(1)
      expect(getEquipmentTemplate('shield_shield')?.rank).toBe(2)
      expect(getEquipmentTemplate('shield_mithril')?.rank).toBe(3)
      expect(getEquipmentTemplate('shield_adamant')?.rank).toBe(8)

      // 小手（10アイテム: 下位2つがrank 0）
      expect(getEquipmentTemplate('gauntlet_cloth_gloves')?.rank).toBe(0)
      expect(getEquipmentTemplate('gauntlet_leather')?.rank).toBe(0)
      expect(getEquipmentTemplate('gauntlet_adamant')?.rank).toBe(8)

      // ワンド（9アイテム: 0〜8、入門帯を追加）
      expect(getEquipmentTemplate('wand_twig')?.rank).toBe(0)
      expect(getEquipmentTemplate('wand_apprentice')?.rank).toBe(1)
      expect(getEquipmentTemplate('wand_wand')?.rank).toBe(2)
      expect(getEquipmentTemplate('wand_mithril')?.rank).toBe(3)
      expect(getEquipmentTemplate('wand_adamant')?.rank).toBe(8)

      // ロッド（9アイテム: 0〜8、入門帯を追加）
      expect(getEquipmentTemplate('rod_acolyte')?.rank).toBe(0)
      expect(getEquipmentTemplate('rod_wooden')?.rank).toBe(1)
      expect(getEquipmentTemplate('rod_rod')?.rank).toBe(2)
      expect(getEquipmentTemplate('rod_mithril')?.rank).toBe(3)
      expect(getEquipmentTemplate('rod_adamant')?.rank).toBe(8)
    })

    it('装備の rank は全カテゴリで 0〜8 に収まる', () => {
      for (let r = 0; r <= 8; r++) {
        // 各ランクに最低1アイテムは存在する（全カテゴリ合算）
        expect(getEquipmentByRank(r).length).toBeGreaterThan(0)
      }
      // rank 9 以上は存在しない
      expect(getEquipmentByRank(9).length).toBe(0)
      expect(getEquipmentByRank(10).length).toBe(0)
    })

    it('getEquipmentByRank(0) は全カテゴリの最弱装備を含む（盾/ワンド/ロッドの入門帯も）', () => {
      const ids = new Set(getEquipmentByRank(0).map((t) => t.id))
      expect(ids.has('sword_cypress_stick')).toBe(true)
      expect(ids.has('claw_sharp')).toBe(true)
      expect(ids.has('bow_slingshot')).toBe(true)
      expect(ids.has('armor_tattered_cloth')).toBe(true)
      expect(ids.has('gauntlet_cloth_gloves')).toBe(true)
      expect(ids.has('shield_pot_lid')).toBe(true)
      expect(ids.has('wand_twig')).toBe(true)
      expect(ids.has('rod_acolyte')).toBe(true)
    })

    it('getEquipmentByRank(1) は各カテゴリの入門上位を含む', () => {
      const ids = new Set(getEquipmentByRank(1).map((t) => t.id))
      expect(ids.has('shield_wooden')).toBe(true)
      expect(ids.has('wand_apprentice')).toBe(true)
      expect(ids.has('rod_wooden')).toBe(true)
      expect(ids.has('sword_broad')).toBe(true)
      expect(ids.has('armor_fur_vest')).toBe(true)
    })

    it('getEquipmentByRank(8) は全カテゴリのアダマント装備を含む', () => {
      const ids = new Set(getEquipmentByRank(8).map((t) => t.id))
      expect(ids.has('sword_adamant')).toBe(true)
      expect(ids.has('claw_adamant')).toBe(true)
      expect(ids.has('bow_adamant')).toBe(true)
      expect(ids.has('armor_adamant')).toBe(true)
      expect(ids.has('gauntlet_adamant')).toBe(true)
      expect(ids.has('shield_adamant')).toBe(true)
      expect(ids.has('wand_adamant')).toBe(true)
      expect(ids.has('rod_adamant')).toBe(true)
    })

    it('商店ランク2では各カテゴリのロイヤル帯まで購入できる（rank導入後も維持）', () => {
      const shopIds = new Set(getShopEquipment(2).map((template) => template.id))

      for (const id of [
        'sword_royal',
        'claw_royal',
        'bow_royal',
        'armor_royal',
        'shield_royal',
        'gauntlet_royal',
        'wand_royal',
        'rod_royal',
      ]) {
        expect(shopIds.has(id)).toBe(true)
      }
      expect(shopIds.has('rod_kaiser')).toBe(false)
      expect(shopIds.has('armor_kaiser')).toBe(false)
    })
  })

  describe('ドロップ確率の基本動作', () => {
    it('敵1体あたり15%のドロップ確率で装備がドロップする', () => {
      const iterations = 1000
      let dropCount = 0
      for (let i = 0; i < iterations; i++) {
        const eng = createEngine(i * 1000)
        const result = callRollTreasureDrops(eng, [createDummyEnemy()], new Set())
        if (result.length > 0) dropCount++
      }
      // 15%前後であることを確認（10%〜20%の範囲）
      const rate = dropCount / iterations
      expect(rate).toBeGreaterThan(0.1)
      expect(rate).toBeLessThan(0.2)
    })

    it('敵数が増えると1戦闘で複数ドロップしうる', () => {
      const enemies = Array.from({ length: 5 }, (_, i) => createDummyEnemy({ id: `enemy_${i}` }))

      for (let seed = 0; seed < 2000; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, enemies, new Set())
        if (result.length >= 2) {
          expect(result.length).toBeGreaterThanOrEqual(2)
          return
        }
      }

      throw new Error('5体戦闘で複数ドロップになるシードが見つかりませんでした')
    })
  })

  describe('敵レベルによるランク抽選', () => {
    it('レベル1の敵からは rank 0 の装備のみドロップする', () => {
      const rank0Ids = new Set(getEquipmentByRank(0).map((t) => t.id))
      let totalDrops = 0

      for (let seed = 0; seed < 3000; seed++) {
        const engine = createEngine(seed * 13)
        const result = callRollTreasureDrops(engine, [createDummyEnemy({ level: 1 })], new Set())
        for (const drop of result) {
          totalDrops++
          expect(rank0Ids.has(drop.templateId)).toBe(true)
        }
      }
      expect(totalDrops).toBeGreaterThan(0)
    })

    it('レベル58の敵からは最大で rank 4 までしかドロップしない', () => {
      const allowedIds = new Set<string>()
      for (let r = 0; r <= 4; r++) {
        for (const t of getEquipmentByRank(r)) allowedIds.add(t.id)
      }

      let totalDrops = 0
      let rank4Drops = 0
      const rank4Ids = new Set(getEquipmentByRank(4).map((t) => t.id))

      for (let seed = 0; seed < 3000; seed++) {
        const engine = createEngine(seed * 17)
        const result = callRollTreasureDrops(engine, [createDummyEnemy({ level: 58 })], new Set())
        for (const drop of result) {
          totalDrops++
          expect(allowedIds.has(drop.templateId)).toBe(true)
          if (rank4Ids.has(drop.templateId)) rank4Drops++
        }
      }
      expect(totalDrops).toBeGreaterThan(0)
      // rank 4 の装備も実際にドロップしていることを確認
      expect(rank4Drops).toBeGreaterThan(0)
    })

    it('高レベル敵では rank 0 のみのレベル1敵より平均ランクが高い', () => {
      const iterations = 3000
      const measure = (level: number) => {
        let sum = 0
        let count = 0
        for (let seed = 0; seed < iterations; seed++) {
          const engine = createEngine(seed * 23 + level)
          const result = callRollTreasureDrops(engine, [createDummyEnemy({ level })], new Set())
          for (const drop of result) {
            const template = getEquipmentTemplate(drop.templateId)
            if (template?.rank !== undefined) {
              sum += template.rank
              count++
            }
          }
        }
        return count > 0 ? sum / count : 0
      }

      const lvl1Avg = measure(1)
      const lvl100Avg = measure(100)
      expect(lvl100Avg).toBeGreaterThan(lvl1Avg)
    })
  })

  describe('ドロップ結果の構造', () => {
    it('ドロップにtemplateId が含まれる', () => {
      let result: any[] = []
      for (let seed = 0; seed < 1000; seed++) {
        const engine = createEngine(seed * 1000)
        result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set())
        if (result.length > 0) break
      }

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('templateId')
      expect(typeof result[0].templateId).toBe('string')
    })

    it('称号なしの場合、titleIdはundefined', () => {
      let foundNone = false
      for (let seed = 0; seed < 5000; seed++) {
        const engine = createEngine(seed * 1000)
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set())
        if (result.length > 0 && result[0].titleId === undefined) {
          foundNone = true
          break
        }
      }
      expect(foundNone).toBe(true)
    })

    it('称号ありの場合、titleIdが設定される', () => {
      let foundTitle = false
      for (let seed = 0; seed < 5000; seed++) {
        const engine = createEngine(seed * 1000)
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set(), { title: 99 })
        if (result.length > 0 && result[0].titleId !== undefined) {
          expect(typeof result[0].titleId).toBe('string')
          foundTitle = true
          break
        }
      }
      expect(foundTitle).toBe(true)
    })
  })

  describe('重複防止', () => {
    it('droppedIdsに含まれるテンプレートはドロップしない', () => {
      // rank 0 全候補をdroppedIdsに入れる（レベル1敵は rank 0 しか出ない）
      const droppedIds = new Set(getEquipmentByRank(0).map((t) => t.id))

      for (let seed = 0; seed < 100; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [createDummyEnemy({ level: 1 })], droppedIds)
        // プールからのドロップは全て除外されるため空
        expect(result).toEqual([])
      }
    })

    it('ドロップしたアイテムがdroppedIdsに追加される', () => {
      const droppedIds = new Set<string>()

      for (let seed = 0; seed < 100; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], droppedIds)
        if (result.length > 0) {
          expect(droppedIds.has(result[0].templateId)).toBe(true)
          return
        }
      }
    })

    it('同一遠征で同じ装備は2回ドロップしない', () => {
      const droppedIds = new Set<string>()
      const allDroppedTemplates: string[] = []

      for (let i = 0; i < 50; i++) {
        const engine = createEngine(i * 100)
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], droppedIds)
        for (const drop of result) {
          allDroppedTemplates.push(drop.templateId)
        }
      }

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
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set(), { title: 1 })
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
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set(), { title: 99 })
        for (const drop of result) {
          totalDrops++
          if (drop.titleId !== undefined) titleCount++
        }
      }

      if (totalDrops > 0) {
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

      let found = false
      for (let seed = 0; seed < 100; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [enemy], new Set())
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
        const result = callRollTreasureDrops(engine, [enemy], new Set(), { title: 99 })

        const enemyDrop = result.find((d: any) => d.templateId === 'sword_cypress_stick')
        if (enemyDrop && enemyDrop.titleId !== undefined) {
          foundTitle = true
          break
        }
      }
      expect(foundTitle).toBe(true)
    })

    it('同一戦闘内なら同じ敵ドロップが複数回発生しうる', () => {
      const duplicatedEnemies = [
        createDummyEnemy({
          id: 'enemy_a',
          equipmentDrops: [
            { templateId: 'sword_cypress_stick', probability: 1.0 },
          ],
        }),
        createDummyEnemy({
          id: 'enemy_b',
          equipmentDrops: [
            { templateId: 'sword_cypress_stick', probability: 1.0 },
          ],
        }),
      ]

      const result = callRollTreasureDrops(createEngine(1), duplicatedEnemies, new Set())

      const duplicatedDrops = result.filter((d: any) => d.templateId === 'sword_cypress_stick')
      expect(duplicatedDrops).toHaveLength(2)
    })

    it('同じアイテムは戦闘をまたぐと再ドロップしない', () => {
      const duplicatedEnemies = [
        createDummyEnemy({
          id: 'enemy_a',
          equipmentDrops: [
            { templateId: 'sword_cypress_stick', probability: 1.0 },
          ],
        }),
        createDummyEnemy({
          id: 'enemy_b',
          equipmentDrops: [
            { templateId: 'sword_cypress_stick', probability: 1.0 },
          ],
        }),
      ]
      const droppedIds = new Set<string>()

      const firstBattle = callRollTreasureDrops(createEngine(1), duplicatedEnemies, droppedIds)
      const secondBattle = callRollTreasureDrops(createEngine(2), duplicatedEnemies, droppedIds)

      expect(firstBattle.filter((d: any) => d.templateId === 'sword_cypress_stick')).toHaveLength(2)
      expect(secondBattle.filter((d: any) => d.templateId === 'sword_cypress_stick')).toHaveLength(0)
    })

    it('rareMultiplier が敵個別ドロップ確率に乗る', () => {
      const enemy = createDummyEnemy({
        equipmentDrops: [
          { templateId: 'sword_cypress_stick', probability: 0.2 },
        ],
      })

      let baseDrops = 0
      let boostedDrops = 0
      const iterations = 1000

      for (let seed = 0; seed < iterations; seed++) {
        const baseResult = callRollTreasureDrops(
          createEngine(seed),
          [enemy],
          new Set(),
          { rare: 1 }
        )
        const boostedResult = callRollTreasureDrops(
          createEngine(seed),
          [enemy],
          new Set(),
          { rare: 2 }
        )

        if (baseResult.some((d: any) => d.templateId === 'sword_cypress_stick')) {
          baseDrops++
        }
        if (boostedResult.some((d: any) => d.templateId === 'sword_cypress_stick')) {
          boostedDrops++
        }
      }

      expect(boostedDrops).toBeGreaterThan(baseDrops)
    })
  })
})
