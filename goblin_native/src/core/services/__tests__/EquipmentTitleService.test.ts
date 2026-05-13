import { EquipmentTitleService } from '../EquipmentTitleService'
import { EQUIPMENT_TITLE_DEFS } from '../../../shared/data/equipmentTitleConfig'
import type { EquipmentTitleId } from '../../../shared/types/EquipmentTitle'
import type { DungeonTier } from '../../../shared/types/DungeonTier'

/**
 * シード付き乱数生成器（テスト再現性のため）
 */
function createSeededRng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return (state >>> 0) / 0x100000000
  }
}

const ALL_LUCK_ROLL = 100  // 付与判定を必ず通す（運乱数の最大相当）
const NEVER_LUCK_ROLL = 0  // 付与判定を必ず外す

describe('EquipmentTitleService', () => {
  describe('rollTitle - 付与判定（運乱数 > 100 - x*30）', () => {
    it('運乱数が閾値以下のときは none を返す', () => {
      const rng = createSeededRng(1)
      // multiplier=1 → threshold=70
      const result = EquipmentTitleService.rollTitle(1, 70, 0, rng)
      expect(result.titleId).toBe('none')
    })

    it('運乱数が閾値を上回るときは称号付きを返す', () => {
      const rng = createSeededRng(2)
      // multiplier=1 → threshold=70。luckRoll=71 で通過
      const result = EquipmentTitleService.rollTitle(1, 71, 0, rng)
      expect(result.titleId).not.toBe('none')
    })

    it('multiplier=2（どんぐり相当）で閾値が 40 になる', () => {
      const rng = createSeededRng(3)
      // multiplier=2 → threshold=40
      const ngResult = EquipmentTitleService.rollTitle(2, 40, 0, rng)
      expect(ngResult.titleId).toBe('none')

      const rng2 = createSeededRng(3)
      const okResult = EquipmentTitleService.rollTitle(2, 41, 0, rng2)
      expect(okResult.titleId).not.toBe('none')
    })

    it('multiplier=0 は内部で 1 にクランプされる', () => {
      const rng1 = createSeededRng(10)
      const rng2 = createSeededRng(10)
      // どちらも threshold=70 として扱われる
      const r0 = EquipmentTitleService.rollTitle(0, 71, 0, rng1)
      const r1 = EquipmentTitleService.rollTitle(1, 71, 0, rng2)
      expect(r0.titleId).toBe(r1.titleId)
    })
  })

  describe('rollTitle - 称号テーブルの確率分布', () => {
    it('Tier 0（1回引き）の分布が設計値に近い', () => {
      const rng = createSeededRng(31415)
      const iterations = 50000
      const counts: Record<string, number> = {}

      for (let i = 0; i < iterations; i++) {
        // 付与判定を必ず通す（luckRoll を高くする）
        const result = EquipmentTitleService.rollTitle(99, ALL_LUCK_ROLL, 0, rng)
        counts[result.titleId] = (counts[result.titleId] || 0) + 1
      }

      // 設計値（±許容範囲）
      const expectations: Array<{ id: string; expected: number; tolerance: number }> = [
        { id: 'worst', expected: 0.28571, tolerance: 0.015 },
        { id: 'stinky', expected: 0.37986, tolerance: 0.015 },
        { id: 'masterwork', expected: 0.28571, tolerance: 0.015 },
        { id: 'magical', expected: 0.03657, tolerance: 0.01 },
        { id: 'imbued', expected: 0.00914, tolerance: 0.005 },
      ]

      for (const { id, expected, tolerance } of expectations) {
        const actual = (counts[id] || 0) / iterations
        expect(actual).toBeGreaterThan(expected - tolerance)
        expect(actual).toBeLessThan(expected + tolerance)
      }
    })
  })

  describe('rollTitle - Tier 別の判定回数と最高位採用', () => {
    it('Tier 0 は 1 回引き', () => {
      // 同じシードで 1 回引いた称号と一致する
      const rng1 = createSeededRng(7777)
      const rng2 = createSeededRng(7777)

      const result = EquipmentTitleService.rollTitle(99, ALL_LUCK_ROLL, 0, rng1)
      // 直接 1 回 pick した結果と同じになる
      const pickedRoll = rng2() * EQUIPMENT_TITLE_DEFS
        .filter(d => d.rollWeight > 0)
        .reduce((s, d) => s + d.rollWeight, 0)
      const sorted = EQUIPMENT_TITLE_DEFS.filter(d => d.rollWeight > 0)
      let cumulative = 0
      let expected: EquipmentTitleId = sorted[sorted.length - 1].id
      for (const def of sorted) {
        cumulative += def.rollWeight
        if (pickedRoll < cumulative) { expected = def.id; break }
      }
      expect(result.titleId).toBe(expected)
    })

    it('Tier が上がるほど高位称号の出現率が増える', () => {
      const iterations = 5000

      const measurePositiveAvgRank = (tier: DungeonTier): number => {
        let totalRank = 0
        let count = 0
        const rng = createSeededRng(tier * 13 + 100)
        for (let i = 0; i < iterations; i++) {
          const result = EquipmentTitleService.rollTitle(99, ALL_LUCK_ROLL, tier, rng)
          const def = EquipmentTitleService.getTitleDef(result.titleId)!
          totalRank += def.rank
          count++
        }
        return totalRank / count
      }

      const rankT0 = measurePositiveAvgRank(0)
      const rankT3 = measurePositiveAvgRank(3)
      const rankT5 = measurePositiveAvgRank(5)

      // Tier が上がるほど平均 rank は上がる
      expect(rankT3).toBeGreaterThan(rankT0)
      expect(rankT5).toBeGreaterThan(rankT3)
    })

    it('Tier 5 ではほぼ確実に masterwork 以上が採用される', () => {
      const rng = createSeededRng(424242)
      const iterations = 2000
      let highOrAbove = 0

      for (let i = 0; i < iterations; i++) {
        const result = EquipmentTitleService.rollTitle(99, ALL_LUCK_ROLL, 5, rng)
        const def = EquipmentTitleService.getTitleDef(result.titleId)!
        if (def.rank >= 3) highOrAbove++ // masterwork(3) 以上
      }

      // worst/stinky のみが 25 連続で出る確率は約 9.6e-6 なので、ほぼ 100%
      expect(highOrAbove / iterations).toBeGreaterThan(0.98)
    })

    it('Tier 5 では Tier 0 比で broken が大幅に増える', () => {
      const measureBrokenRate = (tier: DungeonTier): number => {
        const rng = createSeededRng(tier * 91 + 31)
        const iterations = 30000
        let brokenCount = 0
        for (let i = 0; i < iterations; i++) {
          const result = EquipmentTitleService.rollTitle(99, ALL_LUCK_ROLL, tier, rng)
          if (result.titleId === 'broken') brokenCount++
        }
        return brokenCount / iterations
      }

      const t0 = measureBrokenRate(0)
      const t5 = measureBrokenRate(5)

      expect(t5).toBeGreaterThan(t0 * 5)
    })

    it('付与判定を外す場合は Tier に関係なく none を返す', () => {
      const rng = createSeededRng(0)
      for (const tier of [0, 1, 2, 3, 4, 5] as DungeonTier[]) {
        const result = EquipmentTitleService.rollTitle(1, NEVER_LUCK_ROLL, tier, rng)
        expect(result.titleId).toBe('none')
      }
    })
  })

  describe('rollTitle - 返り値の形', () => {
    it('返却値にtitleIdとtitleNameが含まれる', () => {
      const rng = createSeededRng(42)
      const result = EquipmentTitleService.rollTitle(1, ALL_LUCK_ROLL, 0, rng)

      expect(result).toHaveProperty('titleId')
      expect(result).toHaveProperty('titleName')
      expect(typeof result.titleId).toBe('string')
      expect(typeof result.titleName).toBe('string')
    })

    it('称号なしのtitleNameは空文字', () => {
      const rng = createSeededRng(0)
      const result = EquipmentTitleService.rollTitle(1, NEVER_LUCK_ROLL, 0, rng)
      expect(result.titleId).toBe('none')
      expect(result.titleName).toBe('')
    })
  })

  describe('getTitleDef', () => {
    it('全称号IDの定義を取得できる', () => {
      const ids: EquipmentTitleId[] = [
        'worst', 'stinky', 'none', 'masterwork', 'magical',
        'imbued', 'legendary', 'terrifying', 'broken',
      ]
      for (const id of ids) {
        const def = EquipmentTitleService.getTitleDef(id)
        expect(def).toBeDefined()
        expect(def!.id).toBe(id)
      }
    })

    it('各称号の補正倍率が正しく設定されている', () => {
      const broken = EquipmentTitleService.getTitleDef('broken')!
      expect(broken.plusMultiplier).toBe(5.00)
      expect(broken.minusMultiplier).toBe(0.20)
      expect(broken.priceMultiplier).toBe(125.00)

      const none = EquipmentTitleService.getTitleDef('none')!
      expect(none.plusMultiplier).toBe(1.00)
      expect(none.minusMultiplier).toBe(1.00)
      expect(none.priceMultiplier).toBe(1.00)
    })

    it('rank と rollWeight が定義されている', () => {
      const broken = EquipmentTitleService.getTitleDef('broken')!
      expect(broken.rank).toBe(8)
      expect(broken.rollWeight).toBe(14)

      const worst = EquipmentTitleService.getTitleDef('worst')!
      expect(worst.rank).toBe(1)
      expect(worst.rollWeight).toBe(28571)

      const none = EquipmentTitleService.getTitleDef('none')!
      expect(none.rollWeight).toBe(0) // 抽選対象外
    })
  })

  describe('formatTitledName', () => {
    it('称号ありの場合、接頭辞+装備名を返す', () => {
      expect(EquipmentTitleService.formatTitledName('伝説の', 'ミスリルソード'))
        .toBe('伝説のミスリルソード')
    })

    it('称号なし（空文字）の場合、装備名のみを返す', () => {
      expect(EquipmentTitleService.formatTitledName('', 'ミスリルソード'))
        .toBe('ミスリルソード')
    })
  })
})
