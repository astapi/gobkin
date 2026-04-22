import { DROP_RANK_TABLE, findStartStepIndex, rollDropRank } from '../DropRankRoller'

/** シード付き乱数（ExpeditionEngineと同じ実装） */
function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return (state >>> 0) / 0x100000000
  }
}

describe('DropRankRoller', () => {
  describe('DROP_RANK_TABLE', () => {
    it('minLevel は昇順で並んでいる', () => {
      for (let i = 1; i < DROP_RANK_TABLE.length; i++) {
        expect(DROP_RANK_TABLE[i].minLevel).toBeGreaterThanOrEqual(DROP_RANK_TABLE[i - 1].minLevel)
      }
    })

    it('最下段は rank 0 / 確率100%', () => {
      expect(DROP_RANK_TABLE[0]).toEqual({ minLevel: 1, rank: 0, probability: 1.0 })
    })

    it('rank 0 以外の確率は 70%', () => {
      for (const step of DROP_RANK_TABLE) {
        if (step.rank === 0) continue
        expect(step.probability).toBe(0.7)
      }
    })
  })

  describe('findStartStepIndex', () => {
    it('レベル1 は rank 0 のステップ', () => {
      const idx = findStartStepIndex(1)
      expect(DROP_RANK_TABLE[idx].rank).toBe(0)
    })

    it('レベル58 は rank 4 のステップ（58~）から開始', () => {
      const idx = findStartStepIndex(58)
      const step = DROP_RANK_TABLE[idx]
      expect(step.rank).toBe(4)
      expect(step.minLevel).toBe(58)
    })

    it('レベル69 も rank 4（58~）のステップ', () => {
      const idx = findStartStepIndex(69)
      expect(DROP_RANK_TABLE[idx].rank).toBe(4)
      expect(DROP_RANK_TABLE[idx].minLevel).toBe(58)
    })

    it('レベル70 は rank 4（70~）のステップ', () => {
      const idx = findStartStepIndex(70)
      expect(DROP_RANK_TABLE[idx].rank).toBe(4)
      expect(DROP_RANK_TABLE[idx].minLevel).toBe(70)
    })

    it('レベル30 は rank 3（30~）のステップ（テーブル末尾優先）', () => {
      const idx = findStartStepIndex(30)
      const step = DROP_RANK_TABLE[idx]
      expect(step.rank).toBe(3)
      expect(step.minLevel).toBe(30)
    })

    it('レベル1000 はテーブル末尾のステップ', () => {
      const idx = findStartStepIndex(1000)
      expect(idx).toBe(DROP_RANK_TABLE.length - 1)
    })
  })

  describe('rollDropRank', () => {
    it('レベル1 は常に rank 0', () => {
      for (let seed = 0; seed < 100; seed++) {
        const rng = createSeededRandom(seed)
        expect(rollDropRank(1, rng)).toBe(0)
      }
    })

    it('レベル3 も常に rank 0', () => {
      for (let seed = 0; seed < 100; seed++) {
        const rng = createSeededRandom(seed)
        expect(rollDropRank(3, rng)).toBe(0)
      }
    })

    it('レベル58 では 70% で rank 4 / フォールバックで rank 3 等になる', () => {
      const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
      const iterations = 5000
      for (let seed = 0; seed < iterations; seed++) {
        const rng = createSeededRandom(seed * 1000 + 7)
        const rank = rollDropRank(58, rng)
        counts[rank] = (counts[rank] ?? 0) + 1
      }
      // rank 4 の出現は 70% 付近
      const rank4Ratio = counts[4] / iterations
      expect(rank4Ratio).toBeGreaterThan(0.65)
      expect(rank4Ratio).toBeLessThan(0.75)
      // rank 5 以上は出現しない
      expect(counts[5]).toBeUndefined()
    })

    it('rank は敵レベルが上がるほど高くなりやすい（期待値が単調増加）', () => {
      const testLevels = [1, 5, 15, 25, 50, 80, 120, 200]
      const averages = testLevels.map((level) => {
        const iterations = 2000
        let total = 0
        for (let seed = 0; seed < iterations; seed++) {
          const rng = createSeededRandom(seed * 31 + level)
          total += rollDropRank(level, rng)
        }
        return total / iterations
      })
      for (let i = 1; i < averages.length; i++) {
        expect(averages[i]).toBeGreaterThanOrEqual(averages[i - 1])
      }
    })

    it('確率に全て外れた場合は rank 0 に落ちる', () => {
      // 常に1を返すrng（0<rng未満は常に偽）→ すべて失敗して rank 0
      const alwaysFailRng = () => 1
      expect(rollDropRank(200, alwaysFailRng)).toBe(0)
      expect(rollDropRank(500, alwaysFailRng)).toBe(0)
    })

    it('必ず成功するrngでは開始ステップのrankが返る', () => {
      const alwaysSuccessRng = () => 0
      expect(rollDropRank(58, alwaysSuccessRng)).toBe(4)
      expect(rollDropRank(120, alwaysSuccessRng)).toBe(5)
      expect(rollDropRank(500, alwaysSuccessRng)).toBe(7)
    })
  })
})
