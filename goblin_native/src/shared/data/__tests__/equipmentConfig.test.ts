import { EQUIPMENT_SLOT_LEVELS, calculateSlotCount } from '../equipmentConfig'

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
})
