import { ExpeditionEngine } from '../ExpeditionEngine'
import { getEquipmentByDungeonLevel, getEquipmentTemplate } from '../../../shared/data/equipmentPoolLoader'
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
  dungeonLevel: number,
  enemies: Enemy[],
  droppedIds: Set<string>,
  rewardMultipliers?: Partial<PartyRewardMultipliers>
) {
  return (engine as any).rollTreasureDrops(
    dungeonLevel, dungeonLevel, enemies, droppedIds, rewardMultipliers
  )
}

/** テスト用の最小限の敵 */
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
  describe('防具プール', () => {
    it('鎧が剣と同じティア帯でダンジョンレベルプールに含まれる', () => {
      expect(getEquipmentTemplate('armor_tattered_cloth')?.dropLevelMin).toBe(1)
      expect(getEquipmentTemplate('armor_tattered_cloth')?.dropLevelMax).toBe(2)
      expect(getEquipmentTemplate('armor_leather_vest')?.dropLevelMin).toBe(4)
      expect(getEquipmentTemplate('armor_leather_vest')?.dropLevelMax).toBe(10)
      expect(getEquipmentTemplate('armor_fur_vest')?.dropLevelMin).toBe(8)
      expect(getEquipmentTemplate('armor_fur_vest')?.dropLevelMax).toBe(15)
      expect(getEquipmentTemplate('armor_armor')?.dropLevelMin).toBe(12)
      expect(getEquipmentTemplate('armor_armor')?.dropLevelMax).toBe(25)
      expect(getEquipmentTemplate('armor_mithril')?.dropLevelMin).toBe(20)
      expect(getEquipmentTemplate('armor_royal')?.dropLevelMin).toBe(35)
      expect(getEquipmentTemplate('armor_kaiser')?.dropLevelMin).toBe(50)
      expect(getEquipmentTemplate('armor_ancient')?.dropLevelMin).toBe(70)
      expect(getEquipmentTemplate('armor_dragon')?.dropLevelMin).toBe(95)
      expect(getEquipmentTemplate('armor_adamant')?.dropLevelMin).toBe(120)

      expect(getEquipmentByDungeonLevel(1).some((t) => t.id === 'armor_tattered_cloth')).toBe(true)
      expect(getEquipmentByDungeonLevel(4).some((t) => t.id === 'armor_leather_vest')).toBe(true)
      expect(getEquipmentByDungeonLevel(8).some((t) => t.id === 'armor_fur_vest')).toBe(true)
      expect(getEquipmentByDungeonLevel(12).some((t) => t.id === 'armor_armor')).toBe(true)
      expect(getEquipmentByDungeonLevel(20).some((t) => t.id === 'armor_mithril')).toBe(true)
      expect(getEquipmentByDungeonLevel(35).some((t) => t.id === 'armor_royal')).toBe(true)
      expect(getEquipmentByDungeonLevel(50).some((t) => t.id === 'armor_kaiser')).toBe(true)
      expect(getEquipmentByDungeonLevel(70).some((t) => t.id === 'armor_ancient')).toBe(true)
      expect(getEquipmentByDungeonLevel(95).some((t) => t.id === 'armor_dragon')).toBe(true)
      expect(getEquipmentByDungeonLevel(120).some((t) => t.id === 'armor_adamant')).toBe(true)
    })

    it('小手が低ティアから上位までのダンジョンレベルプールに含まれる', () => {
      expect(getEquipmentTemplate('gauntlet_cloth_gloves')?.dropLevelMin).toBe(1)
      expect(getEquipmentTemplate('gauntlet_cloth_gloves')?.dropLevelMax).toBe(2)
      expect(getEquipmentTemplate('gauntlet_leather')?.dropLevelMin).toBe(4)
      expect(getEquipmentTemplate('gauntlet_leather')?.dropLevelMax).toBe(10)
      expect(getEquipmentTemplate('gauntlet_copper')?.dropLevelMin).toBe(8)
      expect(getEquipmentTemplate('gauntlet_copper')?.dropLevelMax).toBe(15)
      expect(getEquipmentTemplate('gauntlet_gauntlet')?.dropLevelMin).toBe(12)
      expect(getEquipmentTemplate('gauntlet_gauntlet')?.dropLevelMax).toBe(25)
      expect(getEquipmentTemplate('gauntlet_mithril')?.dropLevelMin).toBe(20)
      expect(getEquipmentTemplate('gauntlet_mithril')?.dropLevelMax).toBe(40)
      expect(getEquipmentTemplate('gauntlet_royal')?.dropLevelMin).toBe(35)
      expect(getEquipmentTemplate('gauntlet_royal')?.dropLevelMax).toBe(60)
      expect(getEquipmentTemplate('gauntlet_kaiser')?.dropLevelMin).toBe(50)
      expect(getEquipmentTemplate('gauntlet_kaiser')?.dropLevelMax).toBe(80)
      expect(getEquipmentTemplate('gauntlet_ancient')?.dropLevelMin).toBe(70)
      expect(getEquipmentTemplate('gauntlet_ancient')?.dropLevelMax).toBe(105)
      expect(getEquipmentTemplate('gauntlet_dragon')?.dropLevelMin).toBe(95)
      expect(getEquipmentTemplate('gauntlet_dragon')?.dropLevelMax).toBe(135)
      expect(getEquipmentTemplate('gauntlet_adamant')?.dropLevelMin).toBe(120)
      expect(getEquipmentTemplate('gauntlet_adamant')?.dropLevelMax).toBe(150)

      expect(getEquipmentByDungeonLevel(1).some((t) => t.id === 'gauntlet_cloth_gloves')).toBe(true)
      expect(getEquipmentByDungeonLevel(4).some((t) => t.id === 'gauntlet_leather')).toBe(true)
      expect(getEquipmentByDungeonLevel(8).some((t) => t.id === 'gauntlet_copper')).toBe(true)
      expect(getEquipmentByDungeonLevel(12).some((t) => t.id === 'gauntlet_gauntlet')).toBe(true)
      expect(getEquipmentByDungeonLevel(20).some((t) => t.id === 'gauntlet_mithril')).toBe(true)
      expect(getEquipmentByDungeonLevel(35).some((t) => t.id === 'gauntlet_royal')).toBe(true)
      expect(getEquipmentByDungeonLevel(50).some((t) => t.id === 'gauntlet_kaiser')).toBe(true)
      expect(getEquipmentByDungeonLevel(70).some((t) => t.id === 'gauntlet_ancient')).toBe(true)
      expect(getEquipmentByDungeonLevel(95).some((t) => t.id === 'gauntlet_dragon')).toBe(true)
      expect(getEquipmentByDungeonLevel(120).some((t) => t.id === 'gauntlet_adamant')).toBe(true)
    })

    it('小手は必殺率statと必殺率アップスキルを持つ', () => {
      const template = getEquipmentTemplate('gauntlet_cloth_gloves')

      expect(template?.category).toBe('gauntlet')
      expect(template?.statBonuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stat: 'accuracy_flat', value: 10 }),
          expect.objectContaining({ stat: 'critical_rate_percent', value: 3 }),
          expect.objectContaining({ stat: 'attackCount_flat', value: 0.8 }),
        ])
      )
      expect(template?.grantedSkills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'attack_count_up_1', statBonuses: { attackCount: 1 } }),
          expect.objectContaining({ id: 'critical_rate_up_10', criticalRateBonusPercent: 10 }),
        ])
      )
    })

    it('盾がアーマーと同じティア帯でダンジョンレベルプールに含まれる', () => {
      expect(getEquipmentTemplate('shield_shield')?.dropLevelMin).toBe(12)
      expect(getEquipmentTemplate('shield_shield')?.dropLevelMax).toBe(25)
      expect(getEquipmentTemplate('shield_mithril')?.dropLevelMin).toBe(20)
      expect(getEquipmentTemplate('shield_mithril')?.dropLevelMax).toBe(40)
      expect(getEquipmentTemplate('shield_royal')?.dropLevelMin).toBe(35)
      expect(getEquipmentTemplate('shield_royal')?.dropLevelMax).toBe(60)
      expect(getEquipmentTemplate('shield_kaiser')?.dropLevelMin).toBe(50)
      expect(getEquipmentTemplate('shield_kaiser')?.dropLevelMax).toBe(80)
      expect(getEquipmentTemplate('shield_ancient')?.dropLevelMin).toBe(70)
      expect(getEquipmentTemplate('shield_ancient')?.dropLevelMax).toBe(105)
      expect(getEquipmentTemplate('shield_dragon')?.dropLevelMin).toBe(95)
      expect(getEquipmentTemplate('shield_dragon')?.dropLevelMax).toBe(135)
      expect(getEquipmentTemplate('shield_adamant')?.dropLevelMin).toBe(120)
      expect(getEquipmentTemplate('shield_adamant')?.dropLevelMax).toBe(150)

      expect(getEquipmentByDungeonLevel(12).some((t) => t.id === 'shield_shield')).toBe(true)
      expect(getEquipmentByDungeonLevel(20).some((t) => t.id === 'shield_mithril')).toBe(true)
      expect(getEquipmentByDungeonLevel(35).some((t) => t.id === 'shield_royal')).toBe(true)
      expect(getEquipmentByDungeonLevel(50).some((t) => t.id === 'shield_kaiser')).toBe(true)
      expect(getEquipmentByDungeonLevel(70).some((t) => t.id === 'shield_ancient')).toBe(true)
      expect(getEquipmentByDungeonLevel(95).some((t) => t.id === 'shield_dragon')).toBe(true)
      expect(getEquipmentByDungeonLevel(120).some((t) => t.id === 'shield_adamant')).toBe(true)
    })

    it('盾は魔法防御statとブレス軽減スキルを持つ', () => {
      const template = getEquipmentTemplate('shield_shield')

      expect(template?.category).toBe('shield')
      expect(template?.statBonuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stat: 'critical_rate_percent', value: -2 }),
          expect.objectContaining({ stat: 'def_flat', value: 8 }),
          expect.objectContaining({ stat: 'evasion_flat', value: 12 }),
          expect.objectContaining({ stat: 'magic_def_flat', value: 8 }),
        ])
      )
      expect(template?.grantedSkills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'breath_damage_4_5', breathDamageMultiplier: 0.8 }),
          expect.objectContaining({ id: 'evasion_up_20', statBonuses: { evasion: 20 } }),
          expect.objectContaining({ id: 'breath_reduction_6', breathDamageReductionPercent: 6 }),
        ])
      )
    })

    it('ワンドがアーマーと同じティア帯でダンジョンレベルプールに含まれる', () => {
      expect(getEquipmentTemplate('wand_wand')?.dropLevelMin).toBe(12)
      expect(getEquipmentTemplate('wand_wand')?.dropLevelMax).toBe(25)
      expect(getEquipmentTemplate('wand_mithril')?.dropLevelMin).toBe(20)
      expect(getEquipmentTemplate('wand_mithril')?.dropLevelMax).toBe(40)
      expect(getEquipmentTemplate('wand_royal')?.dropLevelMin).toBe(35)
      expect(getEquipmentTemplate('wand_royal')?.dropLevelMax).toBe(60)
      expect(getEquipmentTemplate('wand_kaiser')?.dropLevelMin).toBe(50)
      expect(getEquipmentTemplate('wand_kaiser')?.dropLevelMax).toBe(80)
      expect(getEquipmentTemplate('wand_ancient')?.dropLevelMin).toBe(70)
      expect(getEquipmentTemplate('wand_ancient')?.dropLevelMax).toBe(105)
      expect(getEquipmentTemplate('wand_dragon')?.dropLevelMin).toBe(95)
      expect(getEquipmentTemplate('wand_dragon')?.dropLevelMax).toBe(135)
      expect(getEquipmentTemplate('wand_adamant')?.dropLevelMin).toBe(120)
      expect(getEquipmentTemplate('wand_adamant')?.dropLevelMax).toBe(150)

      expect(getEquipmentByDungeonLevel(12).some((t) => t.id === 'wand_wand')).toBe(true)
      expect(getEquipmentByDungeonLevel(20).some((t) => t.id === 'wand_mithril')).toBe(true)
      expect(getEquipmentByDungeonLevel(35).some((t) => t.id === 'wand_royal')).toBe(true)
      expect(getEquipmentByDungeonLevel(50).some((t) => t.id === 'wand_kaiser')).toBe(true)
      expect(getEquipmentByDungeonLevel(70).some((t) => t.id === 'wand_ancient')).toBe(true)
      expect(getEquipmentByDungeonLevel(95).some((t) => t.id === 'wand_dragon')).toBe(true)
      expect(getEquipmentByDungeonLevel(120).some((t) => t.id === 'wand_adamant')).toBe(true)
    })

    it('ワンドは魔法攻撃力statと魔法威力増減スキルを持つ', () => {
      const template = getEquipmentTemplate('wand_wand')

      expect(template?.category).toBe('wand')
      expect(template?.statBonuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stat: 'critical_rate_percent', value: -4 }),
          expect.objectContaining({ stat: 'magic_atk_flat', value: 20 }),
        ])
      )
      expect(template?.grantedSkills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'spell_damage_10', spellDamagePercent: 10 }),
        ])
      )
    })
  })

  describe('ドロップ確率の基本動作', () => {
    it('敵1体あたり15%のドロップ確率で装備がドロップする', () => {
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
      // 15%前後であることを確認（10%〜20%の範囲）
      const rate = dropCount / iterations
      expect(rate).toBeGreaterThan(0.1)
      expect(rate).toBeLessThan(0.2)
    })

    it('敵数が増えると1戦闘で複数ドロップしうる', () => {
      const enemies = Array.from({ length: 5 }, (_, i) => createDummyEnemy({ id: `enemy_${i}` }))

      for (let seed = 0; seed < 2000; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(
          engine, 1, enemies, new Set()
        )
        if (result.length >= 2) {
          expect(result.length).toBeGreaterThanOrEqual(2)
          return
        }
      }

      throw new Error('5体戦闘で複数ドロップになるシードが見つかりませんでした')
    })
  })

  describe('ドロップ結果の構造', () => {
    it('ドロップにtemplateId が含まれる', () => {
      const pool = getEquipmentByDungeonLevel(1)
      if (pool.length === 0) return

      // 確実にドロップするシードを探す
      let result: any[] = []
      for (let seed = 0; seed < 1000; seed++) {
        const engine = createEngine(seed * 1000)
        result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], new Set()
        )
        if (result.length > 0) break
      }

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('templateId')
      expect(typeof result[0].templateId).toBe('string')
    })

    it('称号なしの場合、titleIdはundefined', () => {
      // 倍率1ではほぼ称号なし。多数試行してnoneを見つける
      let foundNone = false
      for (let seed = 0; seed < 5000; seed++) {
        const engine = createEngine(seed * 1000)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], new Set()
        )
        if (result.length > 0 && result[0].titleId === undefined) {
          foundNone = true
          break
        }
      }
      expect(foundNone).toBe(true)
    })

    it('称号ありの場合、titleIdが設定される', () => {
      // 倍率99で多数試行して称号付きを見つける
      let foundTitle = false
      for (let seed = 0; seed < 5000; seed++) {
        const engine = createEngine(seed * 1000)
        const result = callRollTreasureDrops(
          engine, 1, [createDummyEnemy()], new Set(), { title: 99 }
        )
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
          engine, 1, [createDummyEnemy()], new Set(), { title: 1 }
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
          engine, 1, [createDummyEnemy()], new Set(), { title: 99 }
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
          engine, 1, [enemy], new Set(), { title: 99 }
        )

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

      const result = callRollTreasureDrops(
        createEngine(1), 1, duplicatedEnemies, new Set()
      )

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

      const firstBattle = callRollTreasureDrops(
        createEngine(1), 1, duplicatedEnemies, droppedIds
      )
      const secondBattle = callRollTreasureDrops(
        createEngine(2), 1, duplicatedEnemies, droppedIds
      )

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
          1,
          [enemy],
          new Set(),
          { rare: 1 }
        )
        const boostedResult = callRollTreasureDrops(
          createEngine(seed),
          1,
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
