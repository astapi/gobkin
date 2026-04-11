import type { CharacterSkill } from '../../types'
import {
  getActionOrderMultiplierFromSkills,
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
  getCharacterSkillDescription,
} from '../characterSkills'
import { getCharacterSkill } from '../skillCatalog'

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

  it('同じidの後列保護スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'rear_shared', protectRearAllyNormalAttackMultiplier: 0.8 },
      { id: 'rear_shared', protectRearAllyNormalAttackMultiplier: 0.8 },
    ]

    expect(getRearProtectionMultiplierFromSkills(skills)).toBe(0.8)
  })

  it('同じidの後列与ダメージ上昇スキルは重複計算しない', () => {
    const skills: CharacterSkill[] = [
      { id: 'inspire_shared', rearAllyDamageMultiplier: 1.5 },
      { id: 'inspire_shared', rearAllyDamageMultiplier: 1.5 },
    ]

    expect(getRearAllyDamageMultiplierFromSkills(skills)).toBe(1.5)
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
    ]

    expect(getSkillStatMultipliers(skills).evasion).toBeCloseTo(1.5)
    expect(getActionOrderMultiplierFromSkills(skills)).toBeCloseTo(1.5)
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

  it('魔法威力スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'spell_damage_10',
      spellDamagePercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[+10%]魔法威力の増減(%)')
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

  it('カタログ定義の説明キーからスキル説明文を返す', () => {
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

  it('基礎呪文がない場合、追加回数スキルだけではLearnedSpellにならない', () => {
    const skills: CharacterSkill[] = [
      { id: 'fireball_twice', spellChargeBonusForId: 'fireball', extraSpellCharges: 1 },
    ]

    expect(getLearnedSpellsFromSkills(skills)).toEqual([])
  })
})
