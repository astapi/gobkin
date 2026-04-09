import type { CharacterSkill } from '../../types'
import {
  describeCharacterSkill,
  getAdditionalDamageFromSkills,
  getLearnedSpellsFromSkills,
  getPhysicalDamageReductionFromSkills,
  getRearAllyDamageMultiplierFromSkills,
  getRearProtectionMultiplierFromSkills,
  getRowDamageMultiplierFromSkills,
  getSkillStatBonuses,
  getSkillStatMultipliers,
  hasCoverLowHpAllySkill,
  hasSurviveLethalDamageAtHp1Skill,
  getUniqueSkillsById,
} from '../characterSkills'

describe('characterSkills - 物理ダメージ軽減', () => {
  it('物理ダメージ軽減スキルの値を合算する', () => {
    const skills: CharacterSkill[] = [
      { id: 'physical_1', name: '[-3%] 物理ダメージ軽減(%)', physicalDamageReductionPercent: 3 },
      { id: 'physical_2', name: '[-6%] 物理ダメージ軽減(%)', physicalDamageReductionPercent: 6 },
      { id: 'other', name: '[+13]追加ダメージ', additionalDamage: 13 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(9)
  })

  it('物理ダメージ軽減がない場合は0を返す', () => {
    const skills: CharacterSkill[] = [
      { id: 'other', name: '[+13]追加ダメージ', additionalDamage: 13 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(0)
  })

  it('同じidの物理ダメージ軽減スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'physical_shared', name: '[-1%] 物理ダメージ軽減(%)', physicalDamageReductionPercent: 1 },
      { id: 'physical_shared', name: '[-1%] 物理ダメージ軽減(%)', physicalDamageReductionPercent: 1 },
    ]

    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(1)
  })

  it('同じidの攻撃回数スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'claw_shared', name: '[+1]攻撃回数', statBonuses: { attackCount: 1 } },
      { id: 'claw_shared', name: '[+1]攻撃回数', statBonuses: { attackCount: 1 } },
    ]

    expect(getSkillStatBonuses(skills).attackCount).toBe(1)
  })

  it('同じidの追加ダメージスキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'damage_shared', name: '[+13]追加ダメージ', additionalDamage: 13 },
      { id: 'damage_shared', name: '[+13]追加ダメージ', additionalDamage: 13 },
    ]

    expect(getAdditionalDamageFromSkills(skills)).toBe(13)
  })

  it('同じidの後列保護スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'rear_shared', name: '後列保護', protectRearAllyNormalAttackMultiplier: 0.8 },
      { id: 'rear_shared', name: '後列保護', protectRearAllyNormalAttackMultiplier: 0.8 },
    ]

    expect(getRearProtectionMultiplierFromSkills(skills)).toBe(0.8)
  })

  it('同じidの後列与ダメージ上昇スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'inspire_shared', name: '鼓舞', rearAllyDamageMultiplier: 1.5 },
      { id: 'inspire_shared', name: '鼓舞', rearAllyDamageMultiplier: 1.5 },
    ]

    expect(getRearAllyDamageMultiplierFromSkills(skills)).toBe(1.5)
  })

  it('近距離攻撃スキルは前列ほど高い隊列補正を返す', () => {
    const skills: CharacterSkill[] = [
      { id: 'weapon_melee_attack', name: '[武器]近距離攻撃', enablesMeleeRowDamagePenalty: true },
    ]

    expect(getRowDamageMultiplierFromSkills(skills, 0)).toBeCloseTo(1.0)
    expect(getRowDamageMultiplierFromSkills(skills, 5)).toBeCloseTo(0.44)
  })

  it('遠距離攻撃スキルは後列ほど高い隊列補正を返す', () => {
    const skills: CharacterSkill[] = [
      { id: 'weapon_ranged_attack', name: '[武器]遠距離攻撃', enablesRangedRowDamagePenalty: true },
    ]

    expect(getRowDamageMultiplierFromSkills(skills, 0)).toBeCloseTo(0.44)
    expect(getRowDamageMultiplierFromSkills(skills, 5)).toBeCloseTo(1.0)
  })

  it('遠近両方ある場合は全列で0.44倍になる', () => {
    const skills: CharacterSkill[] = [
      { id: 'weapon_melee_attack', name: '[武器]近距離攻撃', enablesMeleeRowDamagePenalty: true },
      { id: 'weapon_ranged_attack', name: '[武器]遠距離攻撃', enablesRangedRowDamagePenalty: true },
    ]

    expect(getRowDamageMultiplierFromSkills(skills, 0)).toBeCloseTo(0.44)
    expect(getRowDamageMultiplierFromSkills(skills, 5)).toBeCloseTo(0.44)
  })

  it('ステータス倍率スキルを集計できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'spd_up', name: '先制攻撃', statMultipliers: { spd: 1.2 } },
      { id: 'evasion_up', name: '回避適正', statMultipliers: { evasion: 1.5 } },
    ]

    expect(getSkillStatMultipliers(skills).spd).toBeCloseTo(1.2)
    expect(getSkillStatMultipliers(skills).evasion).toBeCloseTo(1.5)
  })

  it('かばうスキルを判定できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'cover', name: 'かばう', coverLowHpAlly: true },
    ]

    expect(hasCoverLowHpAllySkill(skills)).toBe(true)
  })

  it('気合いスキルを判定できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'guts', name: '気合い', surviveLethalDamageAtHp1: true },
    ]

    expect(hasSurviveLethalDamageAtHp1Skill(skills)).toBe(true)
  })

  it('スキル一覧取得時も同じidは1件にまとまる', () => {
    const skills: CharacterSkill[] = [
      { id: 'shared', name: 'A' },
      { id: 'shared', name: 'A' },
      { id: 'other', name: 'B' },
    ]

    expect(getUniqueSkillsById(skills)).toHaveLength(2)
  })

  it('物理ダメージ軽減スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'physical_10',
      name: 'dummy',
      physicalDamageReductionPercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[-10%] 物理ダメージ軽減(%)')
  })

  it('攻撃回数スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'attack_count_11',
      name: '[+11]攻撃回数',
      statBonuses: { attackCount: 11 },
    }

    expect(describeCharacterSkill(skill)).toBe('[+11]攻撃回数')
  })

  it('SPD倍率スキルの説明文を返す', () => {
    const skill: CharacterSkill = {
      id: 'spd_up',
      name: '先制攻撃',
      statMultipliers: { spd: 1.2 },
    }

    expect(describeCharacterSkill(skill)).toBe('SPDが×1.2')
  })

  it('気合いスキルの説明文を返す', () => {
    const skill: CharacterSkill = {
      id: 'guts',
      name: '気合い',
      surviveLethalDamageAtHp1: true,
    }

    expect(describeCharacterSkill(skill)).toBe('HPが0になる攻撃を受けてもHP1で耐える')
  })

  it('呪文付与スキルからLearnedSpellへ変換できる', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball', name: 'ファイヤーボール', grantsSpellId: 'fireball' },
      { id: 'fireball_twice', name: 'ファイヤーボール2回', spellChargeBonusForId: 'fireball', extraSpellCharges: 1 },
    ]

    expect(getLearnedSpellsFromSkills(skills)).toEqual([
      { spellId: 'fireball', extraCharges: 1 },
    ])
  })

  it('基礎呪文がない場合、追加回数スキルだけではLearnedSpellにならない', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball_twice', name: 'ファイヤーボール2回', spellChargeBonusForId: 'fireball', extraSpellCharges: 1 },
    ]

    expect(getLearnedSpellsFromSkills(skills)).toEqual([])
  })
})
