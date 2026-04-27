import { LUCK_ROLL_TABLE, getLuckRollRange, rollLuckValue } from '../LuckRoller'

describe('LuckRoller', () => {
  describe('LUCK_ROLL_TABLE', () => {
    it('閾値は降順で並び、最下段は minLuck=0 / min=0 / max=99.99', () => {
      for (let i = 1; i < LUCK_ROLL_TABLE.length; i++) {
        expect(LUCK_ROLL_TABLE[i].minLuck).toBeLessThan(LUCK_ROLL_TABLE[i - 1].minLuck)
      }
      const last = LUCK_ROLL_TABLE[LUCK_ROLL_TABLE.length - 1]
      expect(last.minLuck).toBe(0)
      expect(last.min).toBe(0)
      expect(last.max).toBe(99.99)
    })

    it('全ステップで max は 99.99', () => {
      for (const step of LUCK_ROLL_TABLE) {
        expect(step.max).toBe(99.99)
      }
    })
  })

  describe('getLuckRollRange (切り捨てステップ)', () => {
    it('運値 35 → min 37.00', () => {
      expect(getLuckRollRange(35)).toEqual({ min: 37.0, max: 99.99 })
    })

    it('運値 30 → min 30.00', () => {
      expect(getLuckRollRange(30)).toEqual({ min: 30.0, max: 99.99 })
    })

    it('運値 25 → min 22.00', () => {
      expect(getLuckRollRange(25)).toEqual({ min: 22.0, max: 99.99 })
    })

    it('運値 20 → min 15.00', () => {
      expect(getLuckRollRange(20)).toEqual({ min: 15.0, max: 99.99 })
    })

    it('運値 15 → min 7.00', () => {
      expect(getLuckRollRange(15)).toEqual({ min: 7.0, max: 99.99 })
    })

    it('運値 10 → min 0.00', () => {
      expect(getLuckRollRange(10)).toEqual({ min: 0.0, max: 99.99 })
    })

    it('運値 27 は 25 枠（切り捨て）', () => {
      expect(getLuckRollRange(27)).toEqual({ min: 22.0, max: 99.99 })
    })

    it('運値 9 は最下段（10未満）枠', () => {
      expect(getLuckRollRange(9)).toEqual({ min: 0.0, max: 99.99 })
    })

    it('運値 0 は最下段', () => {
      expect(getLuckRollRange(0)).toEqual({ min: 0.0, max: 99.99 })
    })

    it('運値 50 でも 35 枠固定（上限超過は最上段に留まる）', () => {
      expect(getLuckRollRange(50)).toEqual({ min: 37.0, max: 99.99 })
    })
  })

  describe('rollLuckValue', () => {
    it('rng=0 のとき下限値を返す', () => {
      expect(rollLuckValue(35, () => 0)).toBeCloseTo(37.0, 5)
      expect(rollLuckValue(10, () => 0)).toBeCloseTo(0.0, 5)
    })

    it('rng=1-ε のとき上限近くを返す', () => {
      const value = rollLuckValue(10, () => 0.999999)
      expect(value).toBeGreaterThan(99)
      expect(value).toBeLessThanOrEqual(99.99)
    })

    it('複数回抽選しても全て [min, max) に収まる', () => {
      let counter = 0
      const rng = () => {
        counter += 0.0123
        return counter - Math.floor(counter)
      }
      const range = getLuckRollRange(20)
      for (let i = 0; i < 200; i++) {
        const v = rollLuckValue(20, rng)
        expect(v).toBeGreaterThanOrEqual(range.min)
        expect(v).toBeLessThan(range.max)
      }
    })
  })
})
