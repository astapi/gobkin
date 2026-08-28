import { FactorService } from '../FactorService'
import type { Goblin } from '../../../shared/types/Goblin'
import type { FactorDropConfig } from '../../../shared/types/Factor'

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

describe('FactorService', () => {
  describe('rollFactorDrops', () => {
    it('probability=1 のドロップは（未所持であれば）常に獲得する', () => {
      const goblin = createGoblin({ id: 1 })
      const drops: FactorDropConfig[] = [{ factorId: 'always_drop', probability: 1 }]

      for (let seed = 0; seed < 200; seed++) {
        const acquired = FactorService.rollFactorDrops(goblin, drops, seed)
        expect(acquired).toEqual(['always_drop'])
      }
    })

    it('probability=0 のドロップは絶対に獲得しない', () => {
      const goblin = createGoblin({ id: 1 })
      const drops: FactorDropConfig[] = [{ factorId: 'never_drop', probability: 0 }]

      for (let seed = 0; seed < 200; seed++) {
        const acquired = FactorService.rollFactorDrops(goblin, drops, seed)
        expect(acquired).toEqual([])
      }
    })

    it('probability=0.015（ボス因子の基準値）の獲得率は多数試行で約1.5%に収束する', () => {
      const goblin = createGoblin({ id: 1 })
      const drops: FactorDropConfig[] = [{ factorId: 'ratatoskr', probability: 0.015 }]

      const iterations = 20000
      let acquiredCount = 0
      for (let seed = 0; seed < iterations; seed++) {
        const acquired = FactorService.rollFactorDrops(goblin, drops, seed * 31 + 7)
        if (acquired.includes('ratatoskr')) acquiredCount++
      }

      const rate = acquiredCount / iterations
      expect(rate).toBeGreaterThan(0.010)
      expect(rate).toBeLessThan(0.020)
    })

    it('既に所持している因子はprobability=1でもスキップされる', () => {
      const goblin = createGoblin({ id: 1, factors: ['owned_factor'] })
      const drops: FactorDropConfig[] = [{ factorId: 'owned_factor', probability: 1 }]

      const acquired = FactorService.rollFactorDrops(goblin, drops, 12345)
      expect(acquired).toEqual([])
    })

    it('複数因子ドロップは因子ごとに独立して判定される', () => {
      const goblin = createGoblin({ id: 1 })
      const drops: FactorDropConfig[] = [
        { factorId: 'guaranteed', probability: 1 },
        { factorId: 'impossible', probability: 0 },
      ]

      const acquired = FactorService.rollFactorDrops(goblin, drops, 999)
      expect(acquired).toEqual(['guaranteed'])
    })

    it('probabilityMultiplierで確率が拡大される（基準よりも高頻度で獲得する）', () => {
      const goblin = createGoblin({ id: 1 })
      const drops: FactorDropConfig[] = [{ factorId: 'boosted', probability: 0.1 }]
      const iterations = 4000

      const measure = (multiplier: number) => {
        let acquiredCount = 0
        for (let seed = 0; seed < iterations; seed++) {
          const acquired = FactorService.rollFactorDrops(goblin, drops, seed * 13 + 3, multiplier)
          if (acquired.includes('boosted')) acquiredCount++
        }
        return acquiredCount / iterations
      }

      const baseRate = measure(1)
      const boostedRate = measure(3)
      expect(boostedRate).toBeGreaterThan(baseRate)
    })

    it('probability * multiplierが1を超える場合は100%にクランプされる', () => {
      const goblin = createGoblin({ id: 1 })
      const drops: FactorDropConfig[] = [{ factorId: 'clamped', probability: 0.5 }]

      for (let seed = 0; seed < 200; seed++) {
        const acquired = FactorService.rollFactorDrops(goblin, drops, seed, 10)
        expect(acquired).toEqual(['clamped'])
      }
    })

    it('probabilityMultiplierが負の場合は0にクランプされ、獲得しない', () => {
      const goblin = createGoblin({ id: 1 })
      const drops: FactorDropConfig[] = [{ factorId: 'never_because_negative', probability: 0.9 }]

      for (let seed = 0; seed < 200; seed++) {
        const acquired = FactorService.rollFactorDrops(goblin, drops, seed, -5)
        expect(acquired).toEqual([])
      }
    })

    it('factorDatabaseに存在しないfactorIdでも、抽選ロジック自体はそのまま獲得扱いになる（DB整合性チェックはしない）', () => {
      const goblin = createGoblin({ id: 1 })
      const drops: FactorDropConfig[] = [{ factorId: 'no_such_factor_in_database', probability: 1 }]

      const acquired = FactorService.rollFactorDrops(goblin, drops, 1)
      expect(acquired).toEqual(['no_such_factor_in_database'])
    })

    it('空のfactorDropsは常に空配列を返す', () => {
      const goblin = createGoblin({ id: 1 })
      expect(FactorService.rollFactorDrops(goblin, [], 1)).toEqual([])
    })

    it('同じseedとgoblin.idの組み合わせであれば常に同じ結果になる（決定論的）', () => {
      const drops: FactorDropConfig[] = [{ factorId: 'deterministic', probability: 0.5 }]
      const goblin = createGoblin({ id: 42 })

      const first = FactorService.rollFactorDrops(goblin, drops, 777)
      const second = FactorService.rollFactorDrops(goblin, drops, 777)
      expect(first).toEqual(second)
    })

    it('goblin.idが異なれば、同じseedでも異なる乱数列になり得る', () => {
      const drops: FactorDropConfig[] = [{ factorId: 'variable', probability: 0.5 }]
      const goblinA = createGoblin({ id: 1 })
      const goblinB = createGoblin({ id: 2 })

      const resultsDiffer = Array.from({ length: 50 }, (_, seed) => {
        const a = FactorService.rollFactorDrops(goblinA, drops, seed).includes('variable')
        const b = FactorService.rollFactorDrops(goblinB, drops, seed).includes('variable')
        return a !== b
      }).some(Boolean)

      expect(resultsDiffer).toBe(true)
    })

    it('連番のgoblin.id同士でも判定結果は相関しない（隣接ID相関バグの回帰テスト）', () => {
      // 修正前は内部rngが `seed + goblin.id` を直接LCGの初期状態に使っていたため、
      // 連番ID(1違い)のゴブリンはほぼ常に同じ成否になっていた。
      // probability=0.5で多数のseedを試し、隣接ID間の一致率が50%付近（無相関）に
      // 収まることを確認する。
      const drops: FactorDropConfig[] = [{ factorId: 'adjacent_independence', probability: 0.5 }]
      const goblinA = createGoblin({ id: 100 })
      const goblinB = createGoblin({ id: 101 })

      const iterations = 1000
      let matchCount = 0
      for (let seed = 0; seed < iterations; seed++) {
        const a = FactorService.rollFactorDrops(goblinA, drops, seed).includes('adjacent_independence')
        const b = FactorService.rollFactorDrops(goblinB, drops, seed).includes('adjacent_independence')
        if (a === b) matchCount++
      }

      const matchRate = matchCount / iterations
      expect(matchRate).toBeGreaterThan(0.4)
      expect(matchRate).toBeLessThan(0.6)
    })
  })

  describe('addFactors', () => {
    it('newFactorsが空配列の場合は同一のgoblin参照をそのまま返す', () => {
      const goblin = createGoblin({ id: 1, factors: ['wolf'] })
      const result = FactorService.addFactors(goblin, [])
      expect(result).toBe(goblin)
    })

    it('新規因子を追加すると因子配列に反映され、effectiveStatsが再計算される', () => {
      const goblin = createGoblin({ id: 1 })
      const result = FactorService.addFactors(goblin, ['wolf'])

      expect(result.factors).toEqual(['wolf'])
      expect(result.effectiveStats).toBeDefined()
      // wolf因子はatk+10のボーナスを持つため、素のstats.atkより実効atkが高くなる
      expect(result.effectiveStats!.atk).toBeGreaterThan(goblin.stats.atk)
    })

    it('既存因子と重複する因子のみ渡した場合は変化なし（元のgoblin参照を返す）', () => {
      const goblin = createGoblin({ id: 1, factors: ['wolf'] })
      const result = FactorService.addFactors(goblin, ['wolf'])
      expect(result).toBe(goblin)
    })

    it('既存因子と新規因子が混在する場合は重複排除してマージされる', () => {
      const goblin = createGoblin({ id: 1, factors: ['wolf'] })
      const result = FactorService.addFactors(goblin, ['wolf', 'slime'])

      expect(result.factors).toEqual(['wolf', 'slime'])
      expect(result).not.toBe(goblin)
    })

    it('factorsが未定義のgoblinに追加する場合も正しく初期化される', () => {
      const goblin = createGoblin({ id: 1 })
      expect(goblin.factors).toBeUndefined()

      const result = FactorService.addFactors(goblin, ['orc'])
      expect(result.factors).toEqual(['orc'])
    })
  })

  describe('hasFactor', () => {
    it('factorsが未定義の場合はfalseを返す', () => {
      const goblin = createGoblin({ id: 1 })
      expect(FactorService.hasFactor(goblin, 'wolf')).toBe(false)
    })

    it('因子を所持していればtrueを返す', () => {
      const goblin = createGoblin({ id: 1, factors: ['wolf', 'slime'] })
      expect(FactorService.hasFactor(goblin, 'wolf')).toBe(true)
      expect(FactorService.hasFactor(goblin, 'slime')).toBe(true)
    })

    it('所持していない因子はfalseを返す', () => {
      const goblin = createGoblin({ id: 1, factors: ['wolf'] })
      expect(FactorService.hasFactor(goblin, 'orc')).toBe(false)
    })
  })
})
