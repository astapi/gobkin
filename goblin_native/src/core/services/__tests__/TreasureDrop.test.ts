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
  partyLuckAverage: number = 10,
  rewardMultipliers?: Partial<PartyRewardMultipliers>,
  rareDropMultiplierBoost: number = 1,
  titleMultiplierBoost: number = 1,
  tier: number = 0,
) {
  return (engine as any).rollTreasureDrops(
    enemies,
    droppedIds,
    partyLuckAverage,
    rewardMultipliers,
    rareDropMultiplierBoost,
    titleMultiplierBoost,
    tier,
  )
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
    it('最大ランクは 7。rank 0 は1カテゴリに複数個ありうる', () => {
      // 剣（11アイテム: 下位4つはrank 0、その後1刻みで7まで）
      expect(getEquipmentTemplate('sword_cypress_stick')?.rank).toBe(0)
      expect(getEquipmentTemplate('sword_club')?.rank).toBe(0)
      expect(getEquipmentTemplate('sword_copper')?.rank).toBe(0)
      expect(getEquipmentTemplate('sword_broad')?.rank).toBe(0)
      expect(getEquipmentTemplate('sword_long')?.rank).toBe(1)
      expect(getEquipmentTemplate('sword_mithril')?.rank).toBe(2)
      expect(getEquipmentTemplate('sword_royal')?.rank).toBe(3)
      expect(getEquipmentTemplate('sword_kaiser')?.rank).toBe(4)
      expect(getEquipmentTemplate('sword_ancient')?.rank).toBe(5)
      expect(getEquipmentTemplate('sword_dragon')?.rank).toBe(6)
      expect(getEquipmentTemplate('sword_adamant')?.rank).toBe(7)

      // 爪（剣と同じ配列）
      expect(getEquipmentTemplate('claw_sharp')?.rank).toBe(0)
      expect(getEquipmentTemplate('claw_beast')?.rank).toBe(0)
      expect(getEquipmentTemplate('claw_copper')?.rank).toBe(0)
      expect(getEquipmentTemplate('claw_adamant')?.rank).toBe(7)

      // 弓（9アイテム: 0〜7）
      expect(getEquipmentTemplate('bow_slingshot')?.rank).toBe(0)
      expect(getEquipmentTemplate('bow_adamant')?.rank).toBe(7)

      // 鎧（10アイテム: 下位3つがrank 0）
      expect(getEquipmentTemplate('armor_tattered_cloth')?.rank).toBe(0)
      expect(getEquipmentTemplate('armor_leather_vest')?.rank).toBe(0)
      expect(getEquipmentTemplate('armor_fur_vest')?.rank).toBe(0)
      expect(getEquipmentTemplate('armor_adamant')?.rank).toBe(7)

      // 盾（9アイテム: 0〜7、入門帯を追加）
      expect(getEquipmentTemplate('shield_pot_lid')?.rank).toBe(0)
      expect(getEquipmentTemplate('shield_wooden')?.rank).toBe(0)
      expect(getEquipmentTemplate('shield_shield')?.rank).toBe(1)
      expect(getEquipmentTemplate('shield_mithril')?.rank).toBe(2)
      expect(getEquipmentTemplate('shield_adamant')?.rank).toBe(7)

      // 小手（10アイテム: 下位2つがrank 0）
      expect(getEquipmentTemplate('gauntlet_cloth_gloves')?.rank).toBe(0)
      expect(getEquipmentTemplate('gauntlet_leather')?.rank).toBe(0)
      expect(getEquipmentTemplate('gauntlet_adamant')?.rank).toBe(7)

      // ワンド（9アイテム: 0〜7、入門帯を追加）
      expect(getEquipmentTemplate('wand_twig')?.rank).toBe(0)
      expect(getEquipmentTemplate('wand_apprentice')?.rank).toBe(0)
      expect(getEquipmentTemplate('wand_wand')?.rank).toBe(1)
      expect(getEquipmentTemplate('wand_mithril')?.rank).toBe(2)
      expect(getEquipmentTemplate('wand_adamant')?.rank).toBe(7)

      // ロッド（9アイテム: 0〜7、入門帯を追加）
      expect(getEquipmentTemplate('rod_acolyte')?.rank).toBe(0)
      expect(getEquipmentTemplate('rod_wooden')?.rank).toBe(0)
      expect(getEquipmentTemplate('rod_rod')?.rank).toBe(1)
      expect(getEquipmentTemplate('rod_mithril')?.rank).toBe(2)
      expect(getEquipmentTemplate('rod_adamant')?.rank).toBe(7)
    })

    it('装備の rank は全カテゴリで 0〜7 に収まる', () => {
      for (let r = 0; r <= 7; r++) {
        // 各ランクに最低1アイテムは存在する（全カテゴリ合算）
        expect(getEquipmentByRank(r).length).toBeGreaterThan(0)
      }
      // rank 8 以上は存在しない
      expect(getEquipmentByRank(8).length).toBe(0)
      expect(getEquipmentByRank(9).length).toBe(0)
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

    it('getEquipmentByRank(1) は各カテゴリのスタンダード帯を含む', () => {
      const ids = new Set(getEquipmentByRank(1).map((t) => t.id))
      expect(ids.has('shield_shield')).toBe(true)
      expect(ids.has('wand_wand')).toBe(true)
      expect(ids.has('rod_rod')).toBe(true)
      expect(ids.has('sword_long')).toBe(true)
      expect(ids.has('armor_armor')).toBe(true)
    })

    it('getEquipmentByRank(7) は全カテゴリのアダマント装備を含む', () => {
      const ids = new Set(getEquipmentByRank(7).map((t) => t.id))
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

  describe('ノーマルドロップ確率（運値ベース）', () => {
    /**
     * 仕様: `100 - rare * 10 < 運乱数` でノーマルドロップ判定。
     * rare=1, 運値10 → 閾値 90、運乱数 [0, 99.99) → 約 9.99/100 = 約10%。
     */
    it('rare=1 / 運値10 のときノーマルドロップ率は 約10% (5%〜15%)', () => {
      const iterations = 4000
      let dropCount = 0
      for (let i = 0; i < iterations; i++) {
        const eng = createEngine(i * 1000)
        const result = callRollTreasureDrops(eng, [createDummyEnemy()], new Set(), 10, { rare: 1 })
        if (result.length > 0) dropCount++
      }
      const rate = dropCount / iterations
      expect(rate).toBeGreaterThan(0.05)
      expect(rate).toBeLessThan(0.15)
    })

    it('運値が高いほどノーマルドロップ率は上がる', () => {
      const iterations = 2000
      const measure = (luck: number) => {
        let drops = 0
        for (let seed = 0; seed < iterations; seed++) {
          const eng = createEngine(seed * 11 + luck)
          const result = callRollTreasureDrops(eng, [createDummyEnemy()], new Set(), luck, { rare: 1 })
          if (result.length > 0) drops++
        }
        return drops / iterations
      }
      const lowLuck = measure(10)
      const highLuck = measure(35)
      expect(highLuck).toBeGreaterThan(lowLuck)
    })

    it('rareMultiplier が大きいほどノーマルドロップ率が上がる', () => {
      const iterations = 2000
      const measure = (rare: number) => {
        let drops = 0
        for (let seed = 0; seed < iterations; seed++) {
          const eng = createEngine(seed * 13 + rare * 100)
          const result = callRollTreasureDrops(eng, [createDummyEnemy()], new Set(), 10, { rare })
          if (result.length > 0) drops++
        }
        return drops / iterations
      }
      const baseRate = measure(1)
      const boostedRate = measure(2)
      expect(boostedRate).toBeGreaterThan(baseRate)
    })

    it('敵数が増えると1戦闘で複数ドロップしうる', () => {
      const enemies = Array.from({ length: 5 }, (_, i) => createDummyEnemy({ id: `enemy_${i}` }))

      for (let seed = 0; seed < 4000; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, enemies, new Set(), 10, { rare: 1 })
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

      for (let seed = 0; seed < 5000; seed++) {
        const engine = createEngine(seed * 13)
        const result = callRollTreasureDrops(engine, [createDummyEnemy({ level: 1 })], new Set(), 35, { rare: 1 })
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

      for (let seed = 0; seed < 5000; seed++) {
        const engine = createEngine(seed * 17)
        const result = callRollTreasureDrops(engine, [createDummyEnemy({ level: 58 })], new Set(), 35, { rare: 1 })
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
      const iterations = 5000
      const measure = (level: number) => {
        let sum = 0
        let count = 0
        for (let seed = 0; seed < iterations; seed++) {
          const engine = createEngine(seed * 23 + level)
          const result = callRollTreasureDrops(engine, [createDummyEnemy({ level })], new Set(), 35, { rare: 1 })
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
      for (let seed = 0; seed < 2000; seed++) {
        const engine = createEngine(seed * 1000)
        result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set(), 35, { rare: 1 })
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
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set(), 35, { rare: 1 })
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
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set(), 35, { rare: 1, title: 99 })
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

      for (let seed = 0; seed < 200; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [createDummyEnemy({ level: 1 })], droppedIds, 35, { rare: 1 })
        // プールからのドロップは全て除外されるため空
        expect(result).toEqual([])
      }
    })

    it('ドロップしたアイテムがdroppedIdsに追加される', () => {
      const droppedIds = new Set<string>()

      for (let seed = 0; seed < 200; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], droppedIds, 35, { rare: 1 })
        if (result.length > 0) {
          expect(droppedIds.has(result[0].templateId)).toBe(true)
          return
        }
      }
    })

    it('同一遠征で同じ装備は2回ドロップしない', () => {
      const droppedIds = new Set<string>()
      const allDroppedTemplates: string[] = []

      for (let i = 0; i < 100; i++) {
        const engine = createEngine(i * 100)
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], droppedIds, 35, { rare: 1 })
        for (const drop of result) {
          allDroppedTemplates.push(drop.templateId)
        }
      }

      const unique = new Set(allDroppedTemplates)
      expect(unique.size).toBe(allDroppedTemplates.length)
    })
  })

  describe('称号付与倍率の統合', () => {
    it('titleMultiplier=1（threshold=70）では称号なしが過半数', () => {
      // 運値35平均、luckRoll=[37,99.99) → 付与率 ≒ 47.6%
      let titleCount = 0
      let totalDrops = 0
      const iterations = 1500

      for (let seed = 0; seed < iterations; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set(), 35, { rare: 1, title: 1 })
        for (const drop of result) {
          totalDrops++
          if (drop.titleId !== undefined) titleCount++
        }
      }

      if (totalDrops > 0) {
        // 付与率の理論値 ~47.6% 周辺。粗く 60% 以下、25% 以上で範囲確認
        const titleRate = titleCount / totalDrops
        expect(titleRate).toBeLessThan(0.60)
        expect(titleRate).toBeGreaterThan(0.25)
      }
    })

    it('titleMultiplier=99 では必ず称号付き（threshold が負）', () => {
      let titleCount = 0
      let totalDrops = 0
      const iterations = 1500

      for (let seed = 0; seed < iterations; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [createDummyEnemy()], new Set(), 35, { rare: 1, title: 99 })
        for (const drop of result) {
          totalDrops++
          if (drop.titleId !== undefined) titleCount++
        }
      }

      if (totalDrops > 0) {
        // multiplier=99 → threshold=-2870、luckRoll は必ず大きい → 全件付与
        expect(titleCount / totalDrops).toBe(1)
      }
    })

    it('Tier が上がると高位称号（masterwork 以上）の出現比率が上がる', () => {
      const measureHighRate = (tier: number): number => {
        let highCount = 0
        let totalDrops = 0
        const iterations = 800
        for (let seed = 0; seed < iterations; seed++) {
          const engine = createEngine(seed * 17 + tier * 3)
          const result = callRollTreasureDrops(
            engine,
            [createDummyEnemy()],
            new Set(),
            35,
            { rare: 1, title: 99 },
            1,
            1,
            tier,
          )
          for (const drop of result) {
            totalDrops++
            // masterwork(3) 以上を「高位」とみなす
            const positiveIds = ['masterwork', 'magical', 'imbued', 'legendary', 'terrifying', 'broken']
            if (drop.titleId && positiveIds.includes(drop.titleId)) {
              highCount++
            }
          }
        }
        return totalDrops > 0 ? highCount / totalDrops : 0
      }

      const t0 = measureHighRate(0)
      const t5 = measureHighRate(5)

      expect(t5).toBeGreaterThan(t0)
      // Tier 5 ではほぼ確実に masterwork 以上
      expect(t5).toBeGreaterThan(0.95)
    })
  })

  describe('レアドロップ', () => {
    it('rareEquipmentDrops が無い敵からはレアドロップしない', () => {
      const enemy = createDummyEnemy({ rareEquipmentDrops: undefined })
      // rare を極端に上げてもレアドロップは発生しない（ノーマルのみ）
      // ただしノーマルが落ちることはあるので「sword_royal が出ない」で確認する
      for (let seed = 0; seed < 200; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [enemy], new Set(), 35, { rare: 99 })
        for (const drop of result) {
          expect(drop.templateId).not.toBe('sword_royal')
        }
      }
    })

    it('rareEquipmentDrops が設定された敵からレアドロップが発生する', () => {
      const enemy = createDummyEnemy({
        rareEquipmentDrops: [{ templateId: 'sword_royal' }],
      })

      let found = false
      // rare=99 で閾値 100 - 99*0.1 = 90.1 → ほぼ毎回当選する
      for (let seed = 0; seed < 500; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [enemy], new Set(), 35, { rare: 99 })
        if (result.some((d: any) => d.templateId === 'sword_royal')) {
          found = true
          break
        }
      }
      expect(found).toBe(true)
    })

    it('rare=1 のときレアドロップ率は極めて低い (約 0.1% 以下)', () => {
      // 敵レベル1のためノーマルは rank0 のみ → sword_kaiser (rank4) はノーマルでは出ない
      const enemy = createDummyEnemy({
        level: 1,
        rareEquipmentDrops: [{ templateId: 'sword_kaiser' }],
      })

      let rareDrops = 0
      const iterations = 5000
      for (let seed = 0; seed < iterations; seed++) {
        const engine = createEngine(seed * 7)
        const result = callRollTreasureDrops(engine, [enemy], new Set(), 10, { rare: 1 })
        if (result.some((d: any) => d.templateId === 'sword_kaiser')) rareDrops++
      }
      const rate = rareDrops / iterations
      expect(rate).toBeLessThan(0.01)
    })

    it('rareDropMultiplierBoost を 2 にするとレアドロップ率が上がる（ノーマルには波及しない）', () => {
      // 敵レベル1のためノーマルは rank0 のみ → sword_kaiser (rank4) はノーマルでは出ない
      const enemy = createDummyEnemy({
        level: 1,
        rareEquipmentDrops: [{ templateId: 'sword_kaiser' }],
      })

      const iterations = 2000
      const measure = (boost: number) => {
        let rareDrops = 0
        let normalDrops = 0
        for (let seed = 0; seed < iterations; seed++) {
          const engine = createEngine(seed * 31 + boost * 7)
          const result = callRollTreasureDrops(engine, [enemy], new Set(), 35, { rare: 50 }, boost)
          for (const d of result) {
            if (d.templateId === 'sword_kaiser') rareDrops++
            else normalDrops++
          }
        }
        return { rareDrops, normalDrops }
      }

      const base = measure(1)
      const boosted = measure(2)
      expect(boosted.rareDrops).toBeGreaterThan(base.rareDrops)
      // ノーマルドロップ数は同程度（boost が効かないことを大まかに確認）
      const normalRatio = boosted.normalDrops > 0
        ? Math.abs(boosted.normalDrops - base.normalDrops) / Math.max(boosted.normalDrops, base.normalDrops)
        : 0
      expect(normalRatio).toBeLessThan(0.4)
    })

    it('レアドロップにも称号が付与される', () => {
      const enemy = createDummyEnemy({
        rareEquipmentDrops: [{ templateId: 'sword_royal' }],
      })

      let foundTitle = false
      for (let seed = 0; seed < 500; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [enemy], new Set(), 35, { rare: 99, title: 99 })
        const rareDrop = result.find((d: any) => d.templateId === 'sword_royal')
        if (rareDrop && rareDrop.titleId !== undefined) {
          foundTitle = true
          break
        }
      }
      expect(foundTitle).toBe(true)
    })

    it('レアドロップも遠征中の重複防止に登録される', () => {
      const enemy = createDummyEnemy({
        rareEquipmentDrops: [{ templateId: 'sword_royal' }],
      })
      const droppedIds = new Set<string>()

      // rare=99 で第1戦でほぼ確実にドロップ
      let firstDrops: any[] = []
      for (let seed = 0; seed < 200; seed++) {
        const engine = createEngine(seed)
        firstDrops = callRollTreasureDrops(engine, [enemy], droppedIds, 35, { rare: 99 })
        if (firstDrops.some((d) => d.templateId === 'sword_royal')) break
      }
      expect(firstDrops.some((d: any) => d.templateId === 'sword_royal')).toBe(true)
      expect(droppedIds.has('sword_royal')).toBe(true)

      // 第2戦では同じレアは出ないこと
      for (let seed = 1000; seed < 1100; seed++) {
        const engine = createEngine(seed)
        const result = callRollTreasureDrops(engine, [enemy], droppedIds, 35, { rare: 99 })
        for (const drop of result) {
          expect(drop.templateId).not.toBe('sword_royal')
        }
      }
    })

    it('tierRareEquipmentDrops は指定Tier以上で追加される', () => {
      const enemy = createDummyEnemy({
        level: 1,
        rareEquipmentDrops: [{ templateId: 'sword_royal' }],
        tierRareEquipmentDrops: [
          { tier: 1, drops: [{ templateId: 'sword_kaiser' }] },
          { tier: 3, drops: [{ templateId: 'sword_ancient' }] },
        ],
      })

      const hasDrop = (tier: number, templateId: string) => {
        for (let seed = 0; seed < 500; seed++) {
          const engine = createEngine(seed)
          const result = callRollTreasureDrops(engine, [enemy], new Set(), 35, { rare: 99 }, 1, 1, tier)
          if (result.some((drop: any) => drop.templateId === templateId)) return true
        }
        return false
      }

      expect(hasDrop(0, 'sword_royal')).toBe(true)
      expect(hasDrop(0, 'sword_kaiser')).toBe(false)
      expect(hasDrop(1, 'sword_kaiser')).toBe(true)
      expect(hasDrop(2, 'sword_kaiser')).toBe(true)
      expect(hasDrop(2, 'sword_ancient')).toBe(false)
      expect(hasDrop(3, 'sword_ancient')).toBe(true)
    })
  })
})
