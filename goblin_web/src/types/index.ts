export type GoblinStats = {
  hp: number
  atk: number
  sp: number
  spd: number
  def: number
}

export type Goblin = {
  id: number
  name: string
  race: string
  level: number
  avatar: string
  stats: GoblinStats
}

export type Dungeon = {
  id: number
  name: string
  floors: number
  exploration_time_sec_first: number
  exploration_time_sec: number
  description: string
  cleared?: boolean
}

export type Party = {
  id: number
  name: string
  memberIds: number[]
}