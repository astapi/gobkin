import { EquipmentTitleService } from '../EquipmentTitleService'
import { EQUIPMENT_TITLE_DEFS } from '../../../shared/data/equipmentTitleConfig'
import type { EquipmentTitleId } from '../../../shared/types/EquipmentTitle'

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

describe('EquipmentTitleService', () => {
  describe('rollTitle', () => {
    it('倍率1倍で称号なしが最も多く出る', () => {
      const counts: Record<string, number> = {}
      const rng = createSeededRng(12345)
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        const result = EquipmentTitleService.rollTitle(1, rng)
        counts[result.titleId] = (counts[result.titleId] || 0) + 1
      }

      // 称号なしが80%以上
      expect(counts['none']! / iterations).toBeGreaterThan(0.80)
    })

    it('倍率1倍で壊れたはほぼ出ない（0.1%未満）', () => {
      const rng = createSeededRng(99999)
      const iterations = 50000
      let brokenCount = 0

      for (let i = 0; i < iterations; i++) {
        const result = EquipmentTitleService.rollTitle(1, rng)
        if (result.titleId === 'broken') brokenCount++
      }

      expect(brokenCount / iterations).toBeLessThan(0.001)
    })

    it('倍率99倍で称号なしが大幅に減少する', () => {
      const rng = createSeededRng(54321)
      const iterations = 10000
      let noneCount = 0

      for (let i = 0; i < iterations; i++) {
        const result = EquipmentTitleService.rollTitle(99, rng)
        if (result.titleId === 'none') noneCount++
      }

      // 称号なしが15%以下
      expect(noneCount / iterations).toBeLessThan(0.15)
    })

    it('倍率99倍で壊れたが出現する（0.5%〜3%程度）', () => {
      const rng = createSeededRng(11111)
      const iterations = 50000
      let brokenCount = 0

      for (let i = 0; i < iterations; i++) {
        const result = EquipmentTitleService.rollTitle(99, rng)
        if (result.titleId === 'broken') brokenCount++
      }

      const rate = brokenCount / iterations
      expect(rate).toBeGreaterThan(0.005)
      expect(rate).toBeLessThan(0.03)
    })

    it('全倍率で称号の強さ順が維持される（レア称号ほど出にくい）', () => {
      const positiveTitles: EquipmentTitleId[] = [
        'masterwork', 'magical', 'imbued', 'legendary', 'terrifying', 'broken',
      ]

      for (const multiplier of [1, 10, 30, 50, 99]) {
        const counts: Record<string, number> = {}
        const rng = createSeededRng(multiplier * 7919)
        const iterations = 100000

        for (let i = 0; i < iterations; i++) {
          const result = EquipmentTitleService.rollTitle(multiplier, rng)
          counts[result.titleId] = (counts[result.titleId] || 0) + 1
        }

        // 隣接する称号間で、上位称号の方が少ないことを確認
        for (let j = 0; j < positiveTitles.length - 1; j++) {
          const higher = counts[positiveTitles[j]] || 0
          const lower = counts[positiveTitles[j + 1]] || 0
          expect(higher).toBeGreaterThanOrEqual(lower)
        }
      }
    })

    it('倍率の範囲外はクランプされる', () => {
      const rng1 = createSeededRng(100)
      const rng2 = createSeededRng(100)

      // 倍率0は1にクランプ
      const result1 = EquipmentTitleService.rollTitle(0, rng1)
      const result2 = EquipmentTitleService.rollTitle(1, rng2)
      expect(result1.titleId).toBe(result2.titleId)

      // 倍率100は99にクランプ
      const rng3 = createSeededRng(200)
      const rng4 = createSeededRng(200)
      const result3 = EquipmentTitleService.rollTitle(100, rng3)
      const result4 = EquipmentTitleService.rollTitle(99, rng4)
      expect(result3.titleId).toBe(result4.titleId)
    })

    it('返却値にtitleIdとtitleNameが含まれる', () => {
      const rng = createSeededRng(42)
      const result = EquipmentTitleService.rollTitle(1, rng)

      expect(result).toHaveProperty('titleId')
      expect(result).toHaveProperty('titleName')
      expect(typeof result.titleId).toBe('string')
      expect(typeof result.titleName).toBe('string')
    })

    it('称号なしのtitleNameは空文字', () => {
      // 倍率1倍で大量に回してnoneを引く
      const rng = createSeededRng(777)
      let noneResult = null
      for (let i = 0; i < 100; i++) {
        const result = EquipmentTitleService.rollTitle(1, rng)
        if (result.titleId === 'none') {
          noneResult = result
          break
        }
      }
      expect(noneResult).not.toBeNull()
      expect(noneResult!.titleName).toBe('')
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

  describe('確率分布の統計検証', () => {
    it('倍率1倍の分布が設計値に近い', () => {
      const rng = createSeededRng(31415)
      const iterations = 100000
      const counts: Record<string, number> = {}

      for (let i = 0; i < iterations; i++) {
        const result = EquipmentTitleService.rollTitle(1, rng)
        counts[result.titleId] = (counts[result.titleId] || 0) + 1
      }

      // 設計値（±許容範囲）
      const expectations: Array<{ id: string; expected: number; tolerance: number }> = [
        { id: 'none', expected: 0.88, tolerance: 0.02 },
        { id: 'masterwork', expected: 0.04, tolerance: 0.01 },
        { id: 'worst', expected: 0.02, tolerance: 0.01 },
        { id: 'stinky', expected: 0.03, tolerance: 0.01 },
        { id: 'magical', expected: 0.02, tolerance: 0.01 },
        { id: 'imbued', expected: 0.008, tolerance: 0.005 },
      ]

      for (const { id, expected, tolerance } of expectations) {
        const actual = (counts[id] || 0) / iterations
        expect(actual).toBeGreaterThan(expected - tolerance)
        expect(actual).toBeLessThan(expected + tolerance)
      }
    })
  })
})
