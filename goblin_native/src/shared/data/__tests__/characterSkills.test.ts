import type { CharacterSkill } from '../../types'
import {
  getActionOrderMultiplierFromSkills,
  describeCharacterSkill,
  getAdditionalDamageFromSkills,
  getExpeditionTimeMultiplierFromSkills,
  getFactorDropBonusPercentFromSkills,
  getFactorDropMultiplierFromSkills,
  getPartyRareMultiplierFromSkills,
  getPartyTitleMultiplierFromSkills,
  getCharacterSkillEffectDescriptions,
  getCriticalDamageBonusFromSkills,
  getLearnedSpellsFromSkills,
  getMagicDamageFollowUpFromSkills,
  getMagicDamageReductionFromSkills,
  getPartyMagicDamageMultiplierFromSkills,
  getCounterAttackAvoidanceRateFromSkills,
  getPhysicalCounterAttackFromSkills,
  getPhysicalDamagePercentFromSkills,
  getPhysicalDamageReductionFromSkills,
  getPureGoblinPartyStatBonusPercentFromSkills,
  getRearAllyDamageMultiplierFromSkills,
  getRearMagicProtectionMultiplierFromSkills,
  getRearProtectionMultiplierFromSkills,
  getRowDamageMultiplierFromSkills,
  getSpellTakenMultiplierFromSkills,
  getSpellDamageMultiplierFromSkills,
  getSkillStatBonuses,
  getSkillBaseAttributeBonuses,
  getSkillStatMultipliers,
  hasCoverLowHpAllySkill,
  hasTwoColumnAttackSkill,
  hasActTwicePerTurnSkill,
  hasImmediateReviveSkill,
  hasRecoverRandomUsedSpellOnDefendSkill,
  hasSurviveLethalDamageAtHp1Skill,
  getUniqueSkillsById,
  getCharacterSkillDescription,
  applySkillBonusesToEquipmentBonuses,
} from '../characterSkills'
import { getCharacterSkill } from '../skillCatalog'
import { getDefaultSkillsForRace } from '../raceSkills'

describe('characterSkills - 物理ダメージ軽減', () => {
  it('物理ダメージ軽減スキルの値を合算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'physical_1', physicalDamageReductionPercent: 3 },
      { id: 'physical_2', physicalDamageReductionPercent: 6 },
      { id: 'other', additionalDamage: 13 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(9)
  })

  it('物理ダメージ軽減がない場合は0を返す', () => {
    const skills: CharacterSkill[] = [
      { id: 'other', additionalDamage: 13 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(0)
  })

  it('同じidの物理ダメージ軽減スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'physical_shared', physicalDamageReductionPercent: 1 },
      { id: 'physical_shared', physicalDamageReductionPercent: 1 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(1)
  })

  it('攻撃に強いスキルは被物理ダメージ倍率を軽減率へ変換する', () => {
    const skills: CharacterSkill[] = [
      { id: 'attack_resistant_1_2', physicalDamageTakenMultiplier: 1 / 2 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(50)
  })

  it('攻撃に強いスキル同士は乗算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'attack_resistant_1_2', physicalDamageTakenMultiplier: 1 / 2 },
      { id: 'attack_resistant_2_3', physicalDamageTakenMultiplier: 2 / 3 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(67)
  })

  it('攻撃に強いスキルと物理ダメージ軽減スキルを合成する', () => {
    const skills: CharacterSkill[] = [
      { id: 'attack_resistant_1_2', physicalDamageTakenMultiplier: 1 / 2 },
      { id: 'attack_resistant_2_3', physicalDamageTakenMultiplier: 2 / 3 },
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(71)
  })

  it('同じidの攻撃に強いスキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'attack_resistant_1_2', physicalDamageTakenMultiplier: 1 / 2 },
      { id: 'attack_resistant_1_2', physicalDamageTakenMultiplier: 1 / 2 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(50)
  })

  it('魔法ダメージ軽減スキルの値を合算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'magic_reduction_3', magicDamageReductionPercent: 3 },
      { id: 'magic_reduction_6', magicDamageReductionPercent: 6 },
      { id: 'other', additionalDamage: 13 },
    ]

    expect(getMagicDamageReductionFromSkills(skills)).toBe(9)
  })

  it('魔法に強いスキルは被魔法ダメージ倍率を軽減率へ変換する', () => {
    const skills: CharacterSkill[] = [
      { id: 'magic_resistant_1_2', magicDamageTakenMultiplier: 1 / 2 },
    ]

    expect(getMagicDamageReductionFromSkills(skills)).toBe(50)
  })

  it('魔法に強いスキル同士は乗算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'magic_resistant_1_2', magicDamageTakenMultiplier: 1 / 2 },
      { id: 'magic_resistant_2_3', magicDamageTakenMultiplier: 2 / 3 },
    ]

    expect(getMagicDamageReductionFromSkills(skills)).toBe(67)
  })

  it('魔法に強いスキルと魔法ダメージ軽減スキルを合成する', () => {
    const skills: CharacterSkill[] = [
      { id: 'magic_resistant_1_2', magicDamageTakenMultiplier: 1 / 2 },
      { id: 'magic_resistant_2_3', magicDamageTakenMultiplier: 2 / 3 },
      { id: 'magic_reduction_10', magicDamageReductionPercent: 10 },
    ]

    expect(getMagicDamageReductionFromSkills(skills)).toBe(71)
  })

  it('同じidの魔法に強いスキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'magic_resistant_1_2', magicDamageTakenMultiplier: 1 / 2 },
      { id: 'magic_resistant_1_2', magicDamageTakenMultiplier: 1 / 2 },
    ]

    expect(getMagicDamageReductionFromSkills(skills)).toBe(50)
  })

  it('同じidの攻撃回数スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'claw_shared', statBonuses: { attackCount: 1 } },
      { id: 'claw_shared', statBonuses: { attackCount: 1 } },
    ]

    expect(getSkillStatBonuses(skills).attackCount).toBe(1)
  })

  it('同じidの追加ダメージスキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'damage_shared', additionalDamage: 13 },
      { id: 'damage_shared', additionalDamage: 13 },
    ]

    expect(getAdditionalDamageFromSkills(skills)).toBe(13)
  })

  it('物理威力スキルの値を合算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'physical_damage_10', physicalDamagePercent: 10 },
      { id: 'physical_damage_20', physicalDamagePercent: 20 },
      { id: 'other', additionalDamage: 13 },
    ]

    expect(getPhysicalDamagePercentFromSkills(skills)).toBe(30)
  })

  it('同じidの物理威力スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'physical_damage_shared', physicalDamagePercent: 10 },
      { id: 'physical_damage_shared', physicalDamagePercent: 10 },
    ]

    expect(getPhysicalDamagePercentFromSkills(skills)).toBe(10)
  })

  it('会心威力スキルの値を合算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'critical_damage_6', criticalDamageBonusPercent: 6 },
      { id: 'critical_damage_7', criticalDamageBonusPercent: 7 },
      { id: 'other', additionalDamage: 13 },
    ]

    expect(getCriticalDamageBonusFromSkills(skills)).toBe(13)
  })

  it('同じidの会心威力スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'critical_damage_shared', criticalDamageBonusPercent: 10 },
      { id: 'critical_damage_shared', criticalDamageBonusPercent: 10 },
    ]

    expect(getCriticalDamageBonusFromSkills(skills)).toBe(10)
  })

  it('同じidの後列保護スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'rear_shared', protectRearAllyNormalAttackMultiplier: 0.8 },
      { id: 'rear_shared', protectRearAllyNormalAttackMultiplier: 0.8 },
    ]

    expect(getRearProtectionMultiplierFromSkills(skills)).toBe(0.8)
  })

  it('同じidの魔法保護スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'magic_rear_guard', protectRearAllyMagicDamageMultiplier: 2 / 3 },
      { id: 'magic_rear_guard', protectRearAllyMagicDamageMultiplier: 2 / 3 },
    ]

    expect(getRearMagicProtectionMultiplierFromSkills(skills)).toBeCloseTo(2 / 3)
  })

  it('同じidの後列与ダメージ上昇スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'inspire_shared', rearAllyDamageMultiplier: 1.5 },
      { id: 'inspire_shared', rearAllyDamageMultiplier: 1.5 },
    ]

    expect(getRearAllyDamageMultiplierFromSkills(skills)).toBe(1.5)
  })

  it('2列攻撃スキルの有無を判定できる', () => {
    expect(hasTwoColumnAttackSkill([{ id: 'two_column_attack', twoColumnAttack: true }])).toBe(true)
    expect(hasTwoColumnAttackSkill([{ id: 'other' }])).toBe(false)
  })

  it('遠征時間倍率スキルはPT内で重複せず乗算される', () => {
    const skills: CharacterSkill[] = [
      { id: 'light_footed_4_5', expeditionTimeMultiplier: 0.8 },
      { id: 'light_footed_4_5', expeditionTimeMultiplier: 0.8 },
      { id: 'other_time_0_5', expeditionTimeMultiplier: 0.5 },
    ]

    expect(getExpeditionTimeMultiplierFromSkills(skills)).toBeCloseTo(0.4)
  })

  it('呪文ごとの被ダメ倍率は対象呪文だけ乗算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball_taken_0_6', spellTakenMultipliers: { fireball: 0.6 } },
      { id: 'fireball_taken_1_5', spellTakenMultipliers: { fireball: 1.5 } },
      { id: 'magic_arrow_taken_2_0', spellTakenMultipliers: { magic_arrow: 2.0 } },
    ]

    expect(getSpellTakenMultiplierFromSkills(skills, 'fireball')).toBeCloseTo(0.9)
    expect(getSpellTakenMultiplierFromSkills(skills, 'magic_arrow')).toBeCloseTo(2.0)
    expect(getSpellTakenMultiplierFromSkills(skills, 'blizzard')).toBeCloseTo(1.0)
  })

  it('同じidの呪文被ダメ倍率スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball_taken_shared', spellTakenMultipliers: { fireball: 0.6 } },
      { id: 'fireball_taken_shared', spellTakenMultipliers: { fireball: 0.6 } },
    ]

    expect(getSpellTakenMultiplierFromSkills(skills, 'fireball')).toBeCloseTo(0.6)
  })

  it('近距離攻撃スキルは前列ほど高い隊列補正を返す', () => {
    const skills: CharacterSkill[] = [
      { id: 'weapon_melee_attack', enablesMeleeRowDamagePenalty: true },
    ]

    expect(getRowDamageMultiplierFromSkills(skills, 0)).toBeCloseTo(1.0)
    expect(getRowDamageMultiplierFromSkills(skills, 5)).toBeCloseTo(0.44)
  })

  it('遠距離攻撃スキルは後列ほど高い隊列補正を返す', () => {
    const skills: CharacterSkill[] = [
      { id: 'weapon_ranged_attack', enablesRangedRowDamagePenalty: true },
    ]

    expect(getRowDamageMultiplierFromSkills(skills, 0)).toBeCloseTo(0.44)
    expect(getRowDamageMultiplierFromSkills(skills, 5)).toBeCloseTo(1.0)
  })

  it('遠近両方ある場合は全列で0.44倍になる', () => {
    const skills: CharacterSkill[] = [
      { id: 'weapon_melee_attack', enablesMeleeRowDamagePenalty: true },
      { id: 'weapon_ranged_attack', enablesRangedRowDamagePenalty: true },
    ]

    expect(getRowDamageMultiplierFromSkills(skills, 0)).toBeCloseTo(0.44)
    expect(getRowDamageMultiplierFromSkills(skills, 5)).toBeCloseTo(0.44)
  })

  it('ステータス倍率スキルを集計できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'initiative', actionOrderMultiplier: 1.5 },
      { id: 'evasion_up', statMultipliers: { evasion: 1.5 } },
      { id: 'hp_multiplier_10', statMultipliers: { hp: 1.1 } },
    ]

    expect(getSkillStatMultipliers(skills).evasion).toBeCloseTo(1.5)
    expect(getSkillStatMultipliers(skills).hp).toBeCloseTo(1.1)
    expect(getActionOrderMultiplierFromSkills(skills)).toBeCloseTo(1.5)
  })

  it('基本能力値加算スキルを集計できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'power', baseAttributeBonuses: { power: 3 } },
      { id: 'wisdom_luck', baseAttributeBonuses: { wisdom: 2, luck: 1 } },
      { id: 'power', baseAttributeBonuses: { power: 3 } },
    ]

    expect(getSkillBaseAttributeBonuses(skills)).toEqual({
      power: 3,
      wisdom: 2,
      luck: 1,
    })
  })

  it('PT報酬倍率スキルを乗算できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'rare', partyRareMultiplier: 1.1 },
      { id: 'title', partyTitleMultiplier: 1.25 },
      { id: 'rare_2', partyRareMultiplier: 1.5 },
    ]

    expect(getPartyRareMultiplierFromSkills(skills)).toBeCloseTo(1.65)
    expect(getPartyTitleMultiplierFromSkills(skills)).toBeCloseTo(1.25)
  })

  it('因子獲得倍率スキルを集計できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'factor_drop_bonus_10', factorDropBonusPercent: 10 },
      { id: 'factor_drop_bonus_20', factorDropBonusPercent: 20 },
      { id: 'factor_drop_bonus_50', factorDropBonusPercent: 50 },
      { id: 'factor_drop_bonus_50', factorDropBonusPercent: 50 },
      { id: 'factor_drop_mult_1_5', factorDropMultiplier: 1.5 },
      { id: 'factor_drop_mult_1_2', factorDropMultiplier: 1.2 },
    ]

    expect(getFactorDropBonusPercentFromSkills(skills)).toBe(80)
    expect(getFactorDropMultiplierFromSkills(skills)).toBeCloseTo(1.8)
  })

  it('基本能力値加算とPT報酬倍率のカタログを取得できる', () => {
    expect(getCharacterSkill('abnormal_marku')).toMatchObject({
      baseAttributeBonuses: { power: 3, wisdom: 3, luck: 3 },
      partyRareMultiplier: 1.1,
      partyTitleMultiplier: 1.1,
    })
    expect(getCharacterSkillEffectDescriptions(getCharacterSkill('abnormal_marku'))).toEqual([
      '[+3]力',
      '[+3]知恵',
      '[+3]運',
      '[1.10倍]アイテム獲得率',
      '[1.10倍]称号付与率',
    ])
    expect(getCharacterSkillDescription(getCharacterSkill('abnormal_marku'))).toBe(
      '[+3]力\n[+3]知恵\n[+3]運\n[1.10倍]アイテム獲得率\n[1.10倍]称号付与率',
    )

    for (const stat of ['power', 'wisdom', 'spirit', 'vitality', 'agility', 'luck']) {
      for (let value = 1; value <= 10; value++) {
        expect(getCharacterSkill(`base_${stat}_up_${value}`).baseAttributeBonuses).toEqual({ [stat]: value })
      }
    }

    for (const suffix of ['1_05', '1_1', '1_25', '1_3', '1_5']) {
      expect(getCharacterSkill(`party_rare_mult_${suffix}`).partyRareMultiplier).toBeGreaterThan(1)
      expect(getCharacterSkill(`party_title_mult_${suffix}`).partyTitleMultiplier).toBeGreaterThan(1)
    }

    for (const value of [10, 20, 30, 50]) {
      expect(getCharacterSkill(`factor_drop_bonus_${value}`).factorDropBonusPercent).toBe(value)
    }

    for (const value of [6, 7, 8, 9, 10, 11, 12, 13]) {
      expect(getCharacterSkill(`additional_damage_${value}`).additionalDamage).toBe(value)
    }

    for (const [suffix, value] of [['1_2', 1.2], ['1_3', 1.3], ['1_5', 1.5]] as const) {
      expect(getCharacterSkill(`factor_drop_mult_${suffix}`).factorDropMultiplier).toBe(value)
    }
  })

  it('装備倍率スキルはステータス補正の小数点以下を切り捨てる', () => {
    const skills: CharacterSkill[] = [
      { id: 'armor_mastery', equipmentCategoryMultiplier: { armor: 1.3 } },
    ]
    const bonuses = applySkillBonusesToEquipmentBonuses(skills, [
      { stat: 'def_flat', value: 11, sourceCategory: 'armor' },
    ])

    expect(bonuses[0].value).toBe(14)
  })

  it('装備倍率スキルはマイナス補正も絶対値側で切り捨てる', () => {
    const skills: CharacterSkill[] = [
      { id: 'armor_mastery', equipmentCategoryMultiplier: { armor: 1.2 } },
    ]
    const bonuses = applySkillBonusesToEquipmentBonuses(skills, [
      { stat: 'damage_reduction', value: -2, sourceCategory: 'armor' },
    ])

    expect(bonuses[0].value).toBe(-2)
  })

  it('剣装備倍率スキルは剣サブカテゴリ装備だけを強化する', () => {
    const skills: CharacterSkill[] = [
      { id: 'sword_mastery', weaponSubCategoryMultiplier: { sword: 1.5 } },
    ]
    const bonuses = applySkillBonusesToEquipmentBonuses(skills, [
      { stat: 'atk_flat', value: 10, sourceCategory: 'weapon', sourceSubCategory: 'sword' },
      { stat: 'atk_flat', value: 10, sourceCategory: 'weapon', sourceSubCategory: 'bow' },
    ])

    expect(bonuses[0].value).toBe(15)
    expect(bonuses[1].value).toBe(10)
  })

  it('爪装備倍率スキルは爪サブカテゴリ装備だけを強化する', () => {
    const skills: CharacterSkill[] = [
      { id: 'claw_mastery', weaponSubCategoryMultiplier: { claw: 1.5 } },
    ]
    const bonuses = applySkillBonusesToEquipmentBonuses(skills, [
      { stat: 'atk_flat', value: 10, sourceCategory: 'weapon', sourceSubCategory: 'claw' },
      { stat: 'atk_flat', value: 10, sourceCategory: 'weapon', sourceSubCategory: 'sword' },
    ])

    expect(bonuses[0].value).toBe(15)
    expect(bonuses[1].value).toBe(10)
  })

  it('ワンド装備倍率スキルはワンドカテゴリ装備だけを強化する', () => {
    const skills: CharacterSkill[] = [
      { id: 'wand_mastery', equipmentCategoryMultiplier: { wand: 1.5 } },
    ]
    const bonuses = applySkillBonusesToEquipmentBonuses(skills, [
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'wand' },
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'rod' },
    ])

    expect(bonuses[0].value).toBe(15)
    expect(bonuses[1].value).toBe(10)
  })

  it('アイテム魔法攻撃力スキルは装備由来の魔法攻撃力だけを強化する', () => {
    const skills: CharacterSkill[] = [
      { id: 'equipment_magic_atk', equipmentStatMultipliers: { magic_atk_flat: 2 } },
    ]
    const bonuses = applySkillBonusesToEquipmentBonuses(skills, [
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'wand' },
      { stat: 'accuracy_flat', value: 10, sourceCategory: 'wand' },
    ])

    expect(bonuses[0].value).toBe(20)
    expect(bonuses[1].value).toBe(10)
  })

  it('ロッド装備倍率スキルはロッドカテゴリ装備だけを強化する', () => {
    const skills: CharacterSkill[] = [
      { id: 'rod_mastery', equipmentCategoryMultiplier: { rod: 1.5 } },
    ]
    const bonuses = applySkillBonusesToEquipmentBonuses(skills, [
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'rod' },
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'wand' },
    ])

    expect(bonuses[0].value).toBe(15)
    expect(bonuses[1].value).toBe(10)
  })

  it('かばうスキルを判定できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'cover', coverLowHpAlly: true },
    ]

    expect(hasCoverLowHpAllySkill(skills)).toBe(true)
  })

  it('気合いスキルを判定できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'guts', surviveLethalDamageAtHp1: true },
    ]

    expect(hasSurviveLethalDamageAtHp1Skill(skills)).toBe(true)
  })

  it('2回行動スキルを判定できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'two_actions', actTwicePerTurn: true },
    ]

    expect(hasActTwicePerTurnSkill(skills)).toBe(true)
  })

  it('魔力回復スキルを判定できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'mana_recovery', recoverRandomUsedSpellOnDefend: true },
    ]

    expect(hasRecoverRandomUsedSpellOnDefendSkill(skills)).toBe(true)
  })

  it('即時蘇生スキルを判定できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'instant_revive', immediateReviveOnAllyDeath: true },
    ]

    expect(hasImmediateReviveSkill(skills)).toBe(true)
  })

  it('魔法支援スキルの追撃設定を取得できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'magic_support', magicDamageFollowUp: { attackCountMultiplier: 0.7, criticalRateMultiplier: 0.5 } },
    ]

    expect(getMagicDamageFollowUpFromSkills(skills)).toEqual({ attackCountMultiplier: 0.7, criticalRateMultiplier: 0.5 })
    expect(getMagicDamageFollowUpFromSkills([{ id: 'plain' }])).toBeUndefined()
  })

  it('PT魔法ダメージ倍率は最大値を取得する', () => {
    const skills: CharacterSkill[] = [
      { id: 'magic_field', partyMagicDamageMultiplier: 1.5 },
      { id: 'magic_field_weak', partyMagicDamageMultiplier: 1.2 },
    ]

    expect(getPartyMagicDamageMultiplierFromSkills(skills)).toBe(1.5)
    expect(getPartyMagicDamageMultiplierFromSkills([{ id: 'plain' }])).toBe(1)
  })

  it('打ち合いスキルの反撃設定を取得できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'counter_attack', physicalCounterAttack: { attackCountMultiplier: 0.3, criticalRateMultiplier: 0.5 } },
    ]

    expect(getPhysicalCounterAttackFromSkills(skills)).toEqual({ attackCountMultiplier: 0.3, criticalRateMultiplier: 0.5 })
    expect(getPhysicalCounterAttackFromSkills([{ id: 'plain' }])).toBeUndefined()
  })

  it('反撃回避スキルの最大回避率を取得できる', () => {
    const skills = [
      getCharacterSkill('counter_avoidance_1_2'),
      getCharacterSkill('counter_avoidance_2_3'),
    ]

    expect(getCounterAttackAvoidanceRateFromSkills(skills)).toBeCloseTo(2 / 3)
    expect(getCounterAttackAvoidanceRateFromSkills([{ id: 'plain' }])).toBe(0)
  })

  it('群れスキルの純粋ゴブリン人数補正を取得できる', () => {
    expect(getPureGoblinPartyStatBonusPercentFromSkills([getCharacterSkill('goblin_pack_tactics')])).toBe(5)
    expect(getPureGoblinPartyStatBonusPercentFromSkills([{ id: 'plain' }])).toBe(0)
  })

  it('純粋なゴブリンのデフォルトスキルに群れを含める', () => {
    expect(getDefaultSkillsForRace('ゴブリン').map((skill) => skill.id)).toContain('goblin_pack_tactics')
    expect(getDefaultSkillsForRace('始祖ゴブリン').map((skill) => skill.id)).toEqual(
      expect.arrayContaining(['exp_bonus_40', 'goblin_pack_tactics']),
    )
    expect(getDefaultSkillsForRace('ウルフゴブリン').map((skill) => skill.id)).not.toContain('goblin_pack_tactics')
  })

  it('スケイルゴブリンのデフォルトスキルに2列攻撃を含める', () => {
    expect(getDefaultSkillsForRace('スケイルゴブリン').map((skill) => skill.id)).toContain('two_column_attack')
  })

  it('スキル一覧取得時も同じidは1件にまとまる', () => {
    const skills: CharacterSkill[] = [
      { id: 'shared' },
      { id: 'shared' },
      { id: 'other' },
    ]

    expect(getUniqueSkillsById(skills)).toHaveLength(2)
  })

  it('物理ダメージ軽減スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'physical_10',
      physicalDamageReductionPercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[-10%] 物理ダメージ軽減(%)')
  })

  it('ブレスダメージ軽減スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'breath_10',
      breathDamageReductionPercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[-10%] ブレスダメージ軽減(%)')
  })

  it('ブレスに強いスキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'breath_4_5',
      breathDamageMultiplier: 0.8,
    }

    expect(describeCharacterSkill(skill)).toBe('[4/5]ブレスに強い')
  })

  it('攻撃に強いスキルの説明文を表記ルールどおり返す', () => {
    const skill = getCharacterSkill('attack_resistant_2_3')

    expect(describeCharacterSkill(skill)).toBe('[2/3]攻撃に強い')
  })

  it('魔法ダメージ軽減スキルの説明文を表記ルールどおり返す', () => {
    const skill = getCharacterSkill('magic_reduction_10')

    expect(describeCharacterSkill(skill)).toBe('[-10%] 魔法ダメージ軽減(%)')
  })

  it('魔法に強いスキルの説明文を表記ルールどおり返す', () => {
    const skill = getCharacterSkill('magic_resistant_2_3')

    expect(describeCharacterSkill(skill)).toBe('[2/3]魔法に強い')
  })

  it('魔法威力スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'spell_damage_10',
      spellDamagePercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[+10%]魔法威力の増減(%)')
  })

  it('物理威力スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'physical_damage_10',
      physicalDamagePercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[+10%]攻撃威力の増減(%)')
  })

  it('剣装備スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'sword_mastery_150',
      weaponSubCategoryMultiplier: { sword: 1.5 },
    }

    expect(describeCharacterSkill(skill)).toBe('剣カテゴリ装備の能力値が×1.5')
  })

  it('爪装備スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'claw_mastery_150',
      weaponSubCategoryMultiplier: { claw: 1.5 },
    }

    expect(describeCharacterSkill(skill)).toBe('爪カテゴリ装備の能力値が×1.5')
  })

  it('ワンド装備スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'wand_mastery_150',
      equipmentCategoryMultiplier: { wand: 1.5 },
    }

    expect(describeCharacterSkill(skill)).toBe('ワンドカテゴリ装備の能力値が×1.5')
  })

  it('ロッド装備スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'rod_mastery_150',
      equipmentCategoryMultiplier: { rod: 1.5 },
    }

    expect(describeCharacterSkill(skill)).toBe('ロッドカテゴリ装備の能力値が×1.5')
  })

  it('アイテム魔法攻撃力スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'equipment_magic_atk_200',
      equipmentStatMultipliers: { magic_atk_flat: 2 },
    }

    expect(describeCharacterSkill(skill)).toBe('装備由来の魔法攻撃力補正が×2.0')
  })

  it('攻撃回数スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'attack_count_11',
      statBonuses: { attackCount: 11 },
    }

    expect(describeCharacterSkill(skill)).toBe('[+11]攻撃回数')
  })

  it('回避能力スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'evasion_20',
      statBonuses: { evasion: 20 },
    }

    expect(describeCharacterSkill(skill)).toBe('[+20]回避能力')
  })

  it('必殺率スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'critical_rate_10',
      criticalRateBonusPercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[+10]必殺率')
  })

  it('魔法回復量HP変換スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'magic_heal_to_hp_10',
      magicHealToHpPercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[10%]魔法回復量→HP')
  })

  it('行動順倍率スキルの説明文を返す', () => {
    const skill: CharacterSkill = {
      id: 'initiative',
      actionOrderMultiplier: 1.5,
    }

    expect(describeCharacterSkill(skill)).toBe('行動順を決める速さが1.5倍に上昇する')
  })

  it('気合いスキルの説明文を返す', () => {
    const skill: CharacterSkill = {
      id: 'guts',
      surviveLethalDamageAtHp1: true,
    }

    expect(describeCharacterSkill(skill)).toBe('HPが0になる攻撃を受けてもHP1で耐える')
  })

  it('2回行動スキルの説明文を返す', () => {
    const skill: CharacterSkill = {
      id: 'two_actions',
      actTwicePerTurn: true,
    }

    expect(describeCharacterSkill(skill)).toBe('1ターンに2回行動する')
  })

  it('魔力回復スキルの説明文を返す', () => {
    const skill: CharacterSkill = {
      id: 'mana_recovery',
      recoverRandomUsedSpellOnDefend: true,
    }

    expect(describeCharacterSkill(skill)).toBe('防御すると使用済みの呪文をランダムで1つ回復する')
  })

  it('即時蘇生スキルの説明文を返す', () => {
    const skill: CharacterSkill = {
      id: 'instant_revive',
      immediateReviveOnAllyDeath: true,
    }

    expect(describeCharacterSkill(skill)).toBe('未行動なら味方が倒れた直後に回復魔法で蘇生し、そのターンは行動済みになる')
  })

  it('魔法支援スキルの説明文を返す', () => {
    expect(describeCharacterSkill(getCharacterSkill('magic_support'))).toContain('追撃')
  })

  it('最大HP上昇スキルの説明文を表記ルールどおり返す', () => {
    expect(describeCharacterSkill(getCharacterSkill('hp_multiplier_10'))).toBe('[+10%] 最大HP上昇(%)')
  })

  it('打ち合いスキルの説明文を返す', () => {
    expect(describeCharacterSkill(getCharacterSkill('counter_attack'))).toContain('反撃')
  })

  it('魔法保護スキルの説明文を返す', () => {
    expect(describeCharacterSkill(getCharacterSkill('magic_rear_guard'))).toContain('魔法ダメージ')
  })

  it('反撃回避スキルの説明文を返す', () => {
    expect(describeCharacterSkill(getCharacterSkill('counter_avoidance_1_2'))).toContain('1/2')
  })

  it('群れスキルの説明文を返す', () => {
    expect(describeCharacterSkill(getCharacterSkill('goblin_pack_tactics'))).toContain('亜種ではないゴブリン')
  })

  it('カタログ定義の説明キーからスキル説明文を返す', () => {
    expect(getCharacterSkillDescription(getCharacterSkill('light_footed_4_5'))).toBe(
      'PTに1人でもいると探索時間が4/5になります。複数いても重複しません。',
    )
    expect(getCharacterSkillDescription(getCharacterSkill('weapon_melee_attack'))).toBe(
      '隊列の後ろに行くほど通常攻撃のダメージが低下します。',
    )
    expect(getCharacterSkillDescription(getCharacterSkill('weapon_ranged_attack'))).toBe(
      '隊列の前に行くほど通常攻撃のダメージが低下します。',
    )
  })

  it('呪文付与スキルからLearnedSpellへ変換できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball', grantsSpellId: 'fireball' },
      { id: 'fireball_twice', spellChargeBonusForId: 'fireball', extraSpellCharges: 1 },
    ]

    expect(getLearnedSpellsFromSkills(skills)).toEqual([
      { spellId: 'fireball', extraCharges: 1 },
    ])
  })

  it('魔法使い魔法スキルからレベルに応じたLearnedSpellへ変換できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'mage_magic_lv7', mageMagicLevel: 7 },
    ]

    expect(getLearnedSpellsFromSkills(skills, 6)).toEqual([
      { spellId: 'magic_arrow' },
      { spellId: 'sleep_mist' },
    ])
    expect(getLearnedSpellsFromSkills(skills, 13)).toEqual([
      { spellId: 'magic_arrow' },
      { spellId: 'sleep_mist' },
      { spellId: 'fireball' },
      { spellId: 'blizzard' },
      { spellId: 'attack_up' },
    ])
    expect(getLearnedSpellsFromSkills(skills, 15)).toEqual([
      { spellId: 'magic_arrow' },
      { spellId: 'sleep_mist' },
      { spellId: 'fireball' },
      { spellId: 'blizzard' },
      { spellId: 'attack_up' },
    ])
  })

  it('基礎呪文がない場合、追加回数スキルだけではLearnedSpellにならない', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball_twice', spellChargeBonusForId: 'fireball', extraSpellCharges: 1 },
    ]

    expect(getLearnedSpellsFromSkills(skills)).toEqual([])
  })
})

describe('characterSkills - 呪文別ダメージ倍率', () => {
  it('指定呪文の与ダメージ倍率を乗算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball_damage_120', spellDamageMultipliers: { fireball: 1.2 } },
      { id: 'fireball_damage_150', spellDamageMultipliers: { fireball: 1.5 } },
      { id: 'magic_arrow_damage_200', spellDamageMultipliers: { magic_arrow: 2 } },
    ]

    expect(getSpellDamageMultiplierFromSkills(skills, 'fireball')).toBeCloseTo(1.8)
    expect(getSpellDamageMultiplierFromSkills(skills, 'magic_arrow')).toBe(2)
    expect(getSpellDamageMultiplierFromSkills(skills, 'blizzard')).toBe(1)
  })

  it('同じidの呪文別ダメージ倍率スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball_damage_120', spellDamageMultipliers: { fireball: 1.2 } },
      { id: 'fireball_damage_120', spellDamageMultipliers: { fireball: 1.2 } },
    ]

    expect(getSpellDamageMultiplierFromSkills(skills, 'fireball')).toBe(1.2)
  })
})
