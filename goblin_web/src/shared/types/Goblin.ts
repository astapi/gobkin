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
  equipment: EquipmentSlot[]
}

export type EquipmentSlot = {
  slotIndex: number
  itemId: string | null
}
