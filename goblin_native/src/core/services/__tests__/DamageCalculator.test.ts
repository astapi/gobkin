import { DamageCalculator, type Combatant, type Skill } from '../DamageCalculator'
import { getCharacterSkill } from '../../../shared/data/skillCatalog'
import { races } from '../../../shared/data/races'

function skillBuff(skillId: string) {
  const skill = getCharacterSkill(skillId)
  return {
    id: skill.id,
    name: skill.id,
    raceBonus: skill.raceBonus,
  }
}

describe('DamageCalculator race slayer', () => {
  const attacker: Combatant = {
    id: 'attacker',
    name: 'attacker',
    atk: 100,
    def: 10,
    attackCount: 1,
    accuracy: 10,
    evasion: 10,
    raceTags: ['goblin'],
    items: [],
    buffs: [],
  }

  const defender: Combatant = {
    id: 'defender',
    name: 'defender',
    atk: 10,
    def: 0,
    attackCount: 1,
    accuracy: 10,
    evasion: 10,
    raceTags: ['beast'],
    items: [],
    buffs: [],
  }

  const baseSkill: Skill = {
    id: 'base',
    name: 'base',
    power: 1,
  }

  it('同系統の特攻スキルを複数持つと乗算で効く', () => {
    const calculator = new DamageCalculator(() => 0)
    const damage = calculator.calcDamage(
      races,
      {
        ...attacker,
        buffs: [
          skillBuff('beast_slayer_2_0'),
          skillBuff('beast_slayer_1_2'),
        ],
      },
      defender,
      baseSkill,
      { defConstant: 100, randomMin: 1, randomMax: 1 },
      () => 0,
    )

    expect(damage).toBe(240)
  })

  it('対象タグを持たない相手には特攻が乗らない', () => {
    const calculator = new DamageCalculator(() => 0)
    const damage = calculator.calcDamage(
      races,
      {
        ...attacker,
        buffs: [
          skillBuff('dragon_slayer_2_0'),
        ],
      },
      defender,
      baseSkill,
      { defConstant: 100, randomMin: 1, randomMax: 1 },
      () => 0,
    )

    expect(damage).toBe(100)
  })

  it('特攻は魔法攻撃には適用しない', () => {
    const calculator = new DamageCalculator(() => 0)
    const damage = calculator.calcDamage(
      races,
      {
        ...attacker,
        magicAtk: 100,
        buffs: [
          skillBuff('beast_slayer_2_0'),
          skillBuff('beast_slayer_1_2'),
        ],
      },
      {
        ...defender,
        magicDef: 0,
      },
      baseSkill,
      { defConstant: 100, randomMin: 1, randomMax: 1, isMagic: true },
      () => 0,
    )

    expect(damage).toBe(100)
  })
})
