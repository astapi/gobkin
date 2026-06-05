import type { GoblinRaceId } from '../types/Race'

export type FounderGoblinSeedStats = {
  hp: number
  atk: number
  def: number
  attackCount: number
  accuracy: number
  evasion: number
}

export type FounderGoblinSeed = {
  id: number
  name: string
  race: string
  raceId: GoblinRaceId
  level: number
  experience: number
  avatar: string
  stats: FounderGoblinSeedStats
  defaultSkillIds: string[]
}

export const founderGoblinSeed: FounderGoblinSeed = {
  id: 0,
  name: "マルク",
  race: "始祖ゴブリン",
  raceId: "founder",
  level: 1,
  experience: 0,
  avatar: "/src/assets/goblin/marku.png",
  stats: {
    hp: 68,
    atk: 13,
    def: 11,
    attackCount: 2,
    accuracy: 160,
    evasion: 15
  },
  defaultSkillIds: [
    "exp_bonus_40",
    "goblin_pack_tactics",
    "factor_drop_bonus_50"
  ]
}
