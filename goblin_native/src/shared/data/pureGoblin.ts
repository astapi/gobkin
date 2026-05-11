import type { GoblinBaseAttributes } from '../types'

export type PureGoblinSeed = {
  baseAttributes: GoblinBaseAttributes
  hpCoefficient: number
  defaultSkillIds: string[]
}

export const pureGoblinSeed: PureGoblinSeed = {
  baseAttributes: {
    power: 10,
    wisdom: 10,
    spirit: 10,
    vitality: 10,
    agility: 10,
    luck: 10
  },
  hpCoefficient: 0.8,
  defaultSkillIds: [
    "exp_bonus_70",
    "goblin_pack_tactics"
  ]
}
