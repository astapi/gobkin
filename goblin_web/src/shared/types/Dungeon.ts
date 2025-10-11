export type Dungeon = {
  id: string
  name: string
  floors: number
  exploration_time_sec_first: number
  exploration_time_sec: number
  description: string
  cleared?: boolean
  icon?: string
  difficulty?: string
  unlockNext?: string
}
