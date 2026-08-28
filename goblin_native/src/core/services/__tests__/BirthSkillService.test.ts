import { BirthSkillService } from '../BirthSkillService'

function sequenceRng(values: number[]): () => number {
  let index = 0
  return () => values[index++] ?? 0
}

describe('BirthSkillService', () => {
  it('固定4枠を超えて追加しない', () => {
    const skills = BirthSkillService.rollPureGoblinBirthSkills({
      inheritedFactorIds: ['wolf'],
      rng: sequenceRng([0, 0, 0, 0]),
    })

    expect(skills.map((skill) => skill.id)).toEqual([
      'talent_accuracy_150',
      'attack_count_up_2',
      'equipment_accuracy_200',
      'additional_damage_13',
    ])
  })

  it('既存スキルと重複する候補は追加しない', () => {
    const skills = BirthSkillService.rollPureGoblinBirthSkills({
      inheritedFactorIds: ['wolf'],
      existingSkillIds: ['talent_accuracy_150'],
      rng: sequenceRng([0, 0, 0, 0]),
    })

    expect(skills.map((skill) => skill.id)).toEqual([
      'attack_count_up_2',
      'equipment_accuracy_200',
      'additional_damage_13',
    ])
  })
})
