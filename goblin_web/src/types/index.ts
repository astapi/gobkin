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
  job: string
  level: number
  avatar: string
  stats: GoblinStats
}

export type Dungeon = {
  id: number
  name: string
  icon: string
  difficulty: string
  difficultyLevel: number
  rewards: {
    gold: string
    item: string
  }
  disabled?: boolean
}

export type Party = {
  id: number
  name: string
  memberIds: number[]
}