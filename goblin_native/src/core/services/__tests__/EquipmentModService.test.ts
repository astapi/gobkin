import { EquipmentModService } from '../EquipmentModService'

describe('EquipmentModService', () => {
  it('敵レベルに応じて上位Tierを解禁し、Lv150でT1を抽選対象にする', () => {
    expect(EquipmentModService.getBestUnlockedTier(1)).toBe(10)
    expect(EquipmentModService.getBestUnlockedTier(29)).toBe(10)
    expect(EquipmentModService.getBestUnlockedTier(30)).toBe(9)
    expect(EquipmentModService.getBestUnlockedTier(149)).toBe(2)
    expect(EquipmentModService.getBestUnlockedTier(150)).toBe(1)
  })

  it('解禁済みTierを所定のウェイトで抽選する', () => {
    // Lv150の合計ウェイトは211: T1=1、T2=4、T3=10、...、T10=10
    expect(EquipmentModService.rollBaseTier(150, () => 0.004)).toBe(1)
    expect(EquipmentModService.rollBaseTier(150, () => 0.01)).toBe(2)
    expect(EquipmentModService.rollBaseTier(150, () => 0.05)).toBe(3)
    expect(EquipmentModService.rollBaseTier(150, () => 0.99)).toBe(10)
  })

  it('敵レベルで未解禁のTierを除外してウェイトを再集計する', () => {
    // Lv60はT7〜T10のみ。合計80のうちT7のウェイトは30（37.5%）
    expect(EquipmentModService.rollBaseTier(60, () => 0.37)).toBe(7)
    expect(EquipmentModService.rollBaseTier(60, () => 0.38)).toBe(8)
    expect(EquipmentModService.rollBaseTier(60, () => 0.99)).toBe(10)
  })

  it('ダンジョンTierに応じて抽選回数を増やし、最上位Tierを採用する', () => {
    const rolls = [0.99, 0.8, 0.5, 0.004]
    let index = 0
    const result = EquipmentModService.rollBestTier(150, 2, () => rolls[index++])
    expect(index).toBe(4)
    expect(result).toBe(1)
  })

  it('ダンジョンTier 0/1/3/5の抽選回数は1/2/7/25回', () => {
    for (const [dungeonTier, expectedRolls] of [[0, 1], [1, 2], [3, 7], [5, 25]] as const) {
      let rollCount = 0
      EquipmentModService.rollBestTier(150, dungeonTier, () => {
        rollCount++
        return 0.99
      })
      expect(rollCount).toBe(expectedRolls)
    }
  })

  it('prefixとsuffixの両方を付与する', () => {
    const result = EquipmentModService.rollMods(150, 0, () => 0)
    expect(result.prefixMod).toEqual({ id: 'power', tier: 1 })
    expect(result.suffixMod).toEqual({ id: 'vitality', tier: 1 })
  })

  it('テンプレート・称号・prefix・suffixが全て同じ場合だけ同一スタックにする', () => {
    const base = {
      templateId: 'sword_long',
      titleId: 'masterwork' as const,
      prefixMod: { id: 'power' as const, tier: 9 as const },
      suffixMod: { id: 'vitality' as const, tier: 8 as const },
    }
    expect(EquipmentModService.isSameStack(base, { ...base })).toBe(true)
    expect(EquipmentModService.isSameStack(base, {
      ...base,
      suffixMod: { id: 'vitality', tier: 7 },
    })).toBe(false)
  })

  it('保存値はID・Tier・slotの整合性を検証して復元する', () => {
    expect(EquipmentModService.normalizeRoll({ id: 'power', tier: 9 }, 'prefix'))
      .toEqual({ id: 'power', tier: 9 })
    expect(EquipmentModService.normalizeRoll({ id: 'power', tier: 9 }, 'suffix')).toBeUndefined()
    expect(EquipmentModService.normalizeRoll({ id: 'power', tier: 0 }, 'prefix')).toBeUndefined()
  })
})
