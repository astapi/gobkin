import type { CharacterSkill } from '../../types'
import {
  describeCharacterSkill,
  getPhysicalDamageReductionFromSkills,
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

  it('物理ダメージ軽減スキルの説明文を表記ルールどおり返す', () => {
    const skill: CharacterSkill = {
      id: 'physical_10',
      name: 'dummy',
      physicalDamageReductionPercent: 10,
    }

    expect(describeCharacterSkill(skill)).toBe('[-10%] 物理ダメージ軽減(%)')
  })
})
