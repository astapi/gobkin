import { EQUIPMENT_SLOT_LEVELS, TALENT_EQUIPMENT_SLOT_LEVELS, calculateSlotCount } from '../equipmentConfig'

describe('equipmentConfig', () => {
  it('装備枠の解放レベル表を正しく持つ', () => {
    expect(EQUIPMENT_SLOT_LEVELS).toEqual([
      1, 3, 6, 9, 12, 16, 20, 25, 30, 36, 42, 49,
      58, 67, 77, 89, 102, 118, 134, 150, 166, 183, 200,
    ])
  })

  it('レベル閾値どおりに装備枠数を返す', () => {
    expect(calculateSlotCount(1)).toBe(1)
    expect(calculateSlotCount(2)).toBe(1)
    expect(calculateSlotCount(3)).toBe(2)
    expect(calculateSlotCount(5)).toBe(2)
    expect(calculateSlotCount(6)).toBe(3)
    expect(calculateSlotCount(9)).toBe(4)
    expect(calculateSlotCount(16)).toBe(6)
    expect(calculateSlotCount(200)).toBe(23)
    expect(calculateSlotCount(250)).toBe(23)
  })

  it('不正なレベル値でもNaNを返さない', () => {
    expect(calculateSlotCount(Number.NaN)).toBe(1)
  })

  it('[才能]アイテム装備可能数の解放レベル表を正しく持つ', () => {
    expect(TALENT_EQUIPMENT_SLOT_LEVELS).toEqual([
      1, 2, 5, 7, 10, 13, 16, 20, 24, 29, 34, 40, 46, 53,
      60, 67, 75, 83, 91, 99, 108, 117, 126, 135, 145, 158, 172, 187,
    ])
  })

  it('[才能]アイテム装備可能数付きでレベル閾値どおりに装備枠数を返す', () => {
    expect(calculateSlotCount(1, true)).toBe(1)
    expect(calculateSlotCount(2, true)).toBe(2)
    expect(calculateSlotCount(4, true)).toBe(2)
    expect(calculateSlotCount(5, true)).toBe(3)
    expect(calculateSlotCount(7, true)).toBe(4)
    expect(calculateSlotCount(10, true)).toBe(5)
    expect(calculateSlotCount(13, true)).toBe(6)
    expect(calculateSlotCount(16, true)).toBe(7)
    expect(calculateSlotCount(20, true)).toBe(8)
    expect(calculateSlotCount(24, true)).toBe(9)
    expect(calculateSlotCount(29, true)).toBe(10)
    expect(calculateSlotCount(99, true)).toBe(20)
    expect(calculateSlotCount(187, true)).toBe(28)
    expect(calculateSlotCount(200, true)).toBe(28)
  })

  it('[才能]なしの場合は従来どおり', () => {
    expect(calculateSlotCount(2, false)).toBe(1)
    expect(calculateSlotCount(3, false)).toBe(2)
  })
})
