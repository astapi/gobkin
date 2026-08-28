/**
 * 装備枠の解放レベル表
 * index 0 が1枠目、index 1 が2枠目を表す
 */
export const EQUIPMENT_SLOT_LEVELS = [
  1, 3, 6, 9, 12, 16, 20, 25, 30, 36, 42, 49,
  58, 67, 77, 89, 102, 118, 134, 150, 166, 183, 200,
] as const

/**
 * [才能]アイテム装備可能数を持つ場合の装備枠解放レベル表
 * 通常より早く多くの枠が開放される（最大28枠）
 */
export const TALENT_EQUIPMENT_SLOT_LEVELS = [
  1, 2, 5, 7, 10, 13, 16, 20, 24, 29, 34, 40, 46, 53,
  60, 67, 75, 83, 91, 99, 108, 117, 126, 135, 145, 158, 172, 187,
] as const

function normalizeEquipmentLevel(level: unknown): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    return 1
  }

  return Math.max(1, Math.floor(level))
}

/**
 * ゴブリンのレベルからスロット数を計算
 * @param hasItemSlotsBonus [才能]アイテム装備可能数を持つ場合 true
 */
export function calculateSlotCount(level: number, hasItemSlotsBonus?: boolean): number {
  const normalizedLevel = normalizeEquipmentLevel(level)
  const table = hasItemSlotsBonus ? TALENT_EQUIPMENT_SLOT_LEVELS : EQUIPMENT_SLOT_LEVELS
  let unlockedSlots = 0

  for (const unlockLevel of table) {
    if (normalizedLevel < unlockLevel) break
    unlockedSlots++
  }

  return Math.max(1, unlockedSlots)
}
