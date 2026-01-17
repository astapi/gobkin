export interface BattleLogEntry {
  turn: number
  actorId: string
  actorName: string
  action: string
  targetId?: string
  targetName?: string
  damage?: number
  healing?: number
  isAlly: boolean
  targetDefeated?: boolean
  actorHP?: number
  targetHP?: number
  turnState?: {
    allies: Array<{ id: string; name: string; currentHP: number; maxHP: number }>
    enemies: Array<{ id: string; name: string; currentHP: number; maxHP: number }>
  }
}

export interface CombatReplay {
  rounds: number
  outcome: "win" | "lose" | "escape"
  allyHPDelta: number[]
  enemyDefeated: number
  detailedLog?: BattleLogEntry[]
}
