export type ItemEffect = {
  hp?: number
  atk?: number
  sp?: number
  spd?: number
  def?: number
}

export type Item = {
  id: string
  name: string
  description: string
  effect: ItemEffect
  icon?: string
}

export interface Drop {
  id: string
  qty: number
}
