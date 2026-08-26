import { FactorInheritanceService } from '../FactorInheritanceService'
import { factorDatabase } from '../../../shared/data/factors'
import type { Goblin } from '../../../shared/types/Goblin'

/** シード付き乱数（他のテストと同じ実装） */
function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return (state >>> 0) / 0x100000000
  }
}

function sequenceRng(values: number[]): () => number {
  let index = 0
  return () => values[index++] ?? 0
}

function createGoblin(overrides: Partial<Goblin> & { id: number }): Goblin {
  return {
    name: 'テストゴブリン',
    race: 'ゴブリン',
    raceId: 'goblin',
    level: 1,
    experience: 0,
    avatar: '/src/assets/goblin/goblin.png',
    stats: {
      hp: 19,
      atk: 11,
      magicAtk: 10,
      def: 11,
      magicDef: 10,
      attackCount: 2,
      accuracy: 62,
      evasion: 11,
      magicHeal: 10,
      criticalRate: 0,
    },
    skills: [],
    ...overrides,
  }
}

describe('FactorInheritanceService', () => {
  describe('selectParents', () => {
    it('拠点ゴブリンが0体なら親は両方null', () => {
      const rng = createSeededRandom(1)
      const result = FactorInheritanceService.selectParents([], rng)
      expect(result).toEqual({ parent1: null, parent2: null })
    })

    it('拠点ゴブリンが1体ならparent1のみ選出されparent2はnull', () => {
      const rng = createSeededRandom(1)
      const goblin = createGoblin({ id: 1 })
      const result = FactorInheritanceService.selectParents([goblin], rng)
      expect(result.parent1).toBe(goblin)
      expect(result.parent2).toBeNull()
    })

    it('拠点ゴブリンが2体以上ならシャッフルされた先頭2体が選出される', () => {
      const goblins = [
        createGoblin({ id: 1 }),
        createGoblin({ id: 2 }),
        createGoblin({ id: 3 }),
      ]
      // rng()=0 のみ返す場合、Fisher-Yatesのjは常に0 → shuffled = [3, 1, 2]... 実際の並びは決定的
      const rng = () => 0
      const result = FactorInheritanceService.selectParents(goblins, rng)
      expect(result.parent1).not.toBeNull()
      expect(result.parent2).not.toBeNull()
      expect(result.parent1).not.toBe(result.parent2)
      // 元の配列は破壊されない
      expect(goblins.map((g) => g.id)).toEqual([1, 2, 3])
    })

    it('同じrngなら常に同じ2体が選ばれる（決定論的）', () => {
      const goblins = [
        createGoblin({ id: 1 }),
        createGoblin({ id: 2 }),
        createGoblin({ id: 3 }),
        createGoblin({ id: 4 }),
      ]
      const result1 = FactorInheritanceService.selectParents(goblins, createSeededRandom(777))
      const result2 = FactorInheritanceService.selectParents(goblins, createSeededRandom(777))
      expect(result1.parent1?.id).toBe(result2.parent1?.id)
      expect(result1.parent2?.id).toBe(result2.parent2?.id)
    })
  })

  describe('evaluateInheritance', () => {
    it('親が両方nullなら空の結果を返す', () => {
      const rng = createSeededRandom(1)
      const result = FactorInheritanceService.evaluateInheritance({ parent1: null, parent2: null }, rng)
      expect(result).toEqual({ inheritedFactors: [], isVariant: false })
    })

    it('親が因子を1つも持たない場合は空の結果を返す', () => {
      const parent1 = createGoblin({ id: 1, factors: [] })
      const parent2 = createGoblin({ id: 2 })
      const rng = createSeededRandom(1)
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2 }, rng)
      expect(result).toEqual({ inheritedFactors: [], isVariant: false })
    })

    it('wolf因子の継承確率は0.25。判定乱数が閾値未満なら継承、以上なら継承しない（境界値）', () => {
      expect(factorDatabase.wolf.inheritProbability).toBe(0.25)

      const parent1 = createGoblin({ id: 1, factors: ['wolf'] })
      const parent2 = createGoblin({ id: 2 })

      // 継承判定rng=0.249999 (< 0.25) → 継承成功
      const successRng = sequenceRng([0.249999])
      const successResult = FactorInheritanceService.evaluateInheritance({ parent1, parent2 }, successRng)
      expect(successResult.inheritedFactors).toEqual(['wolf'])

      // 継承判定rng=0.25 (境界: 0.25 < 0.25 は偽) → 継承失敗
      const failRng = sequenceRng([0.25])
      const failResult = FactorInheritanceService.evaluateInheritance({ parent1, parent2 }, failRng)
      expect(failResult).toEqual({ inheritedFactors: [], isVariant: false })
    })

    it('親の因子は重複排除して収集される（両親が同じ因子を持っていても継承因子は1個だけ）', () => {
      const parent1 = createGoblin({ id: 1, factors: ['wolf'] })
      const parent2 = createGoblin({ id: 2, factors: ['wolf'] })

      const rng = createSeededRandom(5)
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2 }, rng)
      // Setで重複排除されるため、継承に成功しても'wolf'は1個のみ
      expect(result.inheritedFactors.filter((id) => id === 'wolf').length).toBeLessThanOrEqual(1)
    })

    it('存在しない因子IDはスキップされる', () => {
      const parent1 = createGoblin({ id: 1, factors: ['unknown_factor'] })
      const rng = createSeededRandom(1)
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2: null }, rng)
      expect(result).toEqual({ inheritedFactors: [], isVariant: false })
    })

    it('複数因子を同時に継承できる（因子ごとに独立判定）', () => {
      const parent1 = createGoblin({ id: 1, factors: ['wolf', 'slime'] })
      const parent2 = createGoblin({ id: 2, factors: ['orc'] })

      expect(factorDatabase.wolf.inheritProbability).toBe(0.25)
      expect(factorDatabase.slime.inheritProbability).toBe(0.3)
      expect(factorDatabase.orc.inheritProbability).toBe(0.2)

      // 判定順は Set の挿入順（wolf, slime, orc）。全て成功させ、
      // その後の亜種シャッフル・亜種判定分もすべて閾値未満で用意しておく
      const rng = sequenceRng([0, 0, 0, 0, 0, 0])
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2 }, rng)
      expect(result.inheritedFactors.sort()).toEqual(['orc', 'slime', 'wolf'])
    })

    it('継承した因子が0個の場合は空の結果を返す（全因子が閾値以上で失敗）', () => {
      const parent1 = createGoblin({ id: 1, factors: ['wolf', 'slime', 'orc'] })
      const rng = () => 0.999999
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2: null }, rng)
      expect(result).toEqual({ inheritedFactors: [], isVariant: false })
    })

    it('亜種判定に成功した場合、variantConfigの内容が結果に反映される', () => {
      const parent1 = createGoblin({ id: 1, factors: ['wolf'], plusValue: 4 })
      expect(factorDatabase.wolf.variantConfig?.probability).toBe(0.15)

      // 因子1個の場合シャッフルは発生しない（要素数1のFisher-Yatesはループしない）ため
      // 消費されるrngは「継承判定」「亜種判定」の2回のみ。
      // 継承成功(0 < 0.25) → 亜種判定成功(0.14 < 0.15)
      const rng = sequenceRng([0, 0.14])
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2: null }, rng)

      expect(result.isVariant).toBe(true)
      expect(result.variantRaceId).toBe('wolf')
      expect(result.variantRace).toBe('ウルフゴブリン')
      expect(result.variantFactorId).toBe('wolf')
      expect(result.variantAvatar).toBe(factorDatabase.wolf.variantConfig?.avatar)
    })

    it('亜種判定に失敗した場合、isVariantはfalseのまま', () => {
      const parent1 = createGoblin({ id: 1, factors: ['wolf'] })

      // 継承成功(0 < 0.25) → 亜種判定失敗(0.15は0.15未満ではない)
      const rng = sequenceRng([0, 0.15])
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2: null }, rng)

      expect(result.isVariant).toBe(false)
      expect(result.variantRaceId).toBeUndefined()
      expect(result.inheritedFactors).toEqual(['wolf'])
    })

    it('standaloneのratatoskr因子はvariantConfigを持たないため亜種にならない', () => {
      expect(factorDatabase.ratatoskr.variantConfig).toBeUndefined()

      const parent1 = createGoblin({ id: 1, factors: ['ratatoskr'] })
      const rng = () => 0 // 継承常に成功
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2: null }, rng)

      expect(result.inheritedFactors).toEqual(['ratatoskr'])
      expect(result.isVariant).toBe(false)
    })

    it('複数因子が亜種条件を満たす場合、最初に成功した1つのみ適用される', () => {
      const parent1 = createGoblin({ id: 1, factors: ['wolf', 'slime'] })

      // 継承判定: wolf成功(0), slime成功(0)
      // シャッフル用乱数(0) → 候補順は変わらず [wolf, slime]（あるいは実装依存の並び）
      // 亜種判定: 最初の候補が成功(0) → その因子で確定、2つ目は判定されない
      const rng = sequenceRng([0, 0, 0, 0])
      const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2: null }, rng)

      expect(result.isVariant).toBe(true)
      expect(['wolf', 'slime']).toContain(result.variantFactorId)
    })

    it('同じrngなら継承結果は決定論的に再現される', () => {
      const parent1 = createGoblin({ id: 1, factors: ['wolf', 'slime', 'orc'] })
      const parent2 = createGoblin({ id: 2, factors: ['undead'] })

      const result1 = FactorInheritanceService.evaluateInheritance({ parent1, parent2 }, createSeededRandom(42))
      const result2 = FactorInheritanceService.evaluateInheritance({ parent1, parent2 }, createSeededRandom(42))
      expect(result1).toEqual(result2)
    })

    it('多数回シミュレーションしたときwolf因子の継承率が理論値25%付近に収束する', () => {
      const parent1 = createGoblin({ id: 1, factors: ['wolf'] })
      const iterations = 5000
      let inheritedCount = 0

      for (let seed = 0; seed < iterations; seed++) {
        const rng = createSeededRandom(seed * 97 + 3)
        const result = FactorInheritanceService.evaluateInheritance({ parent1, parent2: null }, rng)
        if (result.inheritedFactors.includes('wolf')) inheritedCount++
      }

      const rate = inheritedCount / iterations
      expect(rate).toBeGreaterThan(0.2)
      expect(rate).toBeLessThan(0.3)
    })
  })

  describe('calculateFactorBonuses', () => {
    it('因子が空配列の場合は全ステータス0のボーナスを返す', () => {
      const bonuses = FactorInheritanceService.calculateFactorBonuses([])
      expect(bonuses).toEqual({
        hp: 0,
        atk: 0,
        magicAtk: 0,
        def: 0,
        magicDef: 0,
        attackCount: 0,
        accuracy: 0,
        evasion: 0,
        magicHeal: 0,
        criticalRate: 0,
      })
    })

    it('単一因子のstat_bonus効果が反映される（wolf: atk+10）', () => {
      const bonuses = FactorInheritanceService.calculateFactorBonuses(['wolf'])
      expect(bonuses.atk).toBe(10)
      expect(bonuses.hp).toBe(0)
    })

    it('複数因子の効果は合算される（wolf: atk+10, slime: hp+20）', () => {
      const bonuses = FactorInheritanceService.calculateFactorBonuses(['wolf', 'slime'])
      expect(bonuses.atk).toBe(10)
      expect(bonuses.hp).toBe(20)
    })

    it('同じ因子IDが重複して渡されると効果も重複加算される', () => {
      const bonuses = FactorInheritanceService.calculateFactorBonuses(['wolf', 'wolf'])
      expect(bonuses.atk).toBe(20)
    })

    it('存在しない因子IDはスキップされ、他の因子の効果には影響しない', () => {
      const bonuses = FactorInheritanceService.calculateFactorBonuses(['wolf', 'unknown_factor'])
      expect(bonuses.atk).toBe(10)
    })
  })
})
