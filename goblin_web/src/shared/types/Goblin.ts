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
  experience: number
  avatar: string
  stats: GoblinStats
  factors?: string[]  // 獲得した因子IDの配列
  individualValue?: number  // 個体値 (1〜64)、未定義の場合は1として扱う
}
