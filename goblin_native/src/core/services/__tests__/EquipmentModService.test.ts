import { EquipmentModService } from '../EquipmentModService'
import { EquipmentService } from '../EquipmentService'
import { getEquipmentModDef } from '../../../shared/data/equipmentModConfig'
import {
  getPhysicalDamagePercentFromSkills,
  getSkillStatMultipliers,
} from '../../../shared/data/characterSkills'

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
    expect(result.prefixMod).toEqual({ id: 'power', tier: 3 })
    expect(result.suffixMod).toEqual({ id: 'hp_multiplier', tier: 1 })
  })

  it('基本能力MODはT5から解禁し、T5=+1・T4=+2・T3=+3までにする', () => {
    expect(EquipmentModService.rollMod('prefix', 89, 0, () => 0))
      .toEqual({ id: 'attack', tier: 6 })
    expect(EquipmentModService.rollMod('prefix', 90, 0, () => 0))
      .toEqual({ id: 'power', tier: 5 })
    expect(EquipmentModService.rollMod('prefix', 105, 0, () => 0))
      .toEqual({ id: 'power', tier: 4 })
    expect(EquipmentModService.rollMod('prefix', 120, 0, () => 0))
      .toEqual({ id: 'power', tier: 3 })

    expect(EquipmentModService.getValue({ id: 'power', tier: 5 })).toBe(1)
    expect(EquipmentModService.getValue({ id: 'power', tier: 4 })).toBe(2)
    expect(EquipmentModService.getValue({ id: 'power', tier: 3 })).toBe(3)
    // 旧セーブのT1/T10も値を1〜3に収める。
    expect(EquipmentModService.getValue({ id: 'power', tier: 1 })).toBe(3)
    expect(EquipmentModService.getValue({ id: 'power', tier: 10 })).toBe(1)
  })

  it('基本能力MODと称号MODの抽選ウェイトを低くする', () => {
    expect(getEquipmentModDef('power')!.weight).toBeLessThan(getEquipmentModDef('attack')!.weight)
    expect(getEquipmentModDef('title_bonus')!.weight).toBeLessThan(getEquipmentModDef('exp_bonus')!.weight)
    expect(getEquipmentModDef('title_multiplier')!.weight).toBeLessThan(getEquipmentModDef('gold_multiplier')!.weight)
  })

  it('MOD種別をウェイト付きで抽選する', () => {
    const rolls = [121 / 620, 0.99]
    let index = 0
    expect(EquipmentModService.rollMod('prefix', 150, 0, () => rolls[index++]))
      .toEqual({ id: 'attack', tier: 10 })
  })

  it('実数値MODを装備ステータスへ変換する', () => {
    expect(EquipmentModService.toStatBonus({ id: 'accuracy', tier: 1 })).toMatchObject({
      stat: 'accuracy_flat',
      value: 10,
      sourceModSlot: 'prefix',
    })
    expect(EquipmentModService.toStatBonus({ id: 'hp', tier: 1 })).toMatchObject({
      stat: 'hp_flat',
      value: 10,
      sourceModSlot: 'prefix',
    })
  })

  it('倍率・報酬MODをTier値に応じた装備スキルへ変換する', () => {
    expect(EquipmentModService.toGrantedSkill({ id: 'hp_multiplier', tier: 1 }, 'eq-1'))
      .toMatchObject({ isEquipmentModEffect: true, statMultipliers: { hp: 1.1 } })
    expect(EquipmentModService.toGrantedSkill({ id: 'physical_damage', tier: 5 }, 'eq-1'))
      .toMatchObject({ physicalDamagePercent: 6 })
    expect(EquipmentModService.toGrantedSkill({ id: 'exp_multiplier', tier: 10 }, 'eq-1'))
      .toMatchObject({ expMultiplier: 1.01 })
    expect(EquipmentModService.toGrantedSkill({ id: 'title_bonus', tier: 3 }, 'eq-1'))
      .toMatchObject({ partyTitleBonusPercent: 8 })
    expect(EquipmentModService.toGrantedSkill({ id: 'title_multiplier', tier: 2 }, 'eq-1'))
      .toMatchObject({ partyTitleMultiplier: 1.09 })
    expect(EquipmentModService.toGrantedSkill({ id: 'gold_multiplier', tier: 4 }, 'eq-1'))
      .toMatchObject({ goldMultiplier: 1.07 })
  })

  it('同じ力+1 MODを2つ装備すると力+2として合算する', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      {
        id: 'eq-power-1',
        templateId: 'sword_long',
        slotIndex: 0,
        goblinId: 1,
        prefixMod: { id: 'power', tier: 5 },
      },
      {
        id: 'eq-power-2',
        templateId: 'sword_long',
        slotIndex: 1,
        goblinId: 1,
        prefixMod: { id: 'power', tier: 5 },
      },
    ])

    const powerModTotal = bonuses
      .filter(bonus => bonus.sourceModId === 'power')
      .reduce((sum, bonus) => sum + bonus.value, 0)
    expect(powerModTotal).toBe(2)
  })

  it('装備MODスキルは装備インスタンスごとに別IDで収集して重複可能にする', () => {
    const skills = EquipmentService.collectGrantedSkills([
      {
        id: 'eq-1',
        templateId: 'sword_long',
        slotIndex: 0,
        goblinId: 1,
        suffixMod: { id: 'physical_damage', tier: 10 },
      },
      {
        id: 'eq-2',
        templateId: 'sword_long',
        slotIndex: 1,
        goblinId: 1,
        suffixMod: { id: 'physical_damage', tier: 10 },
      },
    ])

    const modSkills = skills.filter(skill => skill.physicalDamagePercent !== undefined)
    expect(modSkills).toHaveLength(2)
    expect(modSkills[0].id).not.toBe(modSkills[1].id)
    expect(getPhysicalDamagePercentFromSkills(modSkills)).toBe(2)
  })

  it('同じHP倍率MODを2つ装備すると増加率を加算する', () => {
    const skills = EquipmentService.collectGrantedSkills([
      {
        id: 'eq-hp-1',
        templateId: 'sword_long',
        slotIndex: 0,
        goblinId: 1,
        suffixMod: { id: 'hp_multiplier', tier: 1 },
      },
      {
        id: 'eq-hp-2',
        templateId: 'sword_long',
        slotIndex: 1,
        goblinId: 1,
        suffixMod: { id: 'hp_multiplier', tier: 1 },
      },
    ])

    expect(getSkillStatMultipliers(skills).hp).toBeCloseTo(1.2)
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
    expect(EquipmentModService.normalizeRoll({ id: 'vitality', tier: 9 }, 'suffix'))
      .toEqual({ id: 'vitality', tier: 9 })
    expect(EquipmentModService.normalizeRoll({ id: 'power', tier: 0 }, 'prefix')).toBeUndefined()
  })
})
