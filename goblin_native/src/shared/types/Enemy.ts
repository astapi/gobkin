import type { FactorDropConfig } from './Factor'

export interface Enemy {
  id: string
  name: string
  raceTags: string[]
  level: number
  hp: number
  atk: number
  def: number
  spd: number
  sp: number
  exp: number
  gold: number
  factorDrops?: FactorDropConfig[]  // この敵を倒すと得られる可能性のある因子
}

export interface EnemyPattern {
  id: string
  floors: number[]
  enemies: string[]
  isBoss?: boolean
}

export interface EnemyDatabase {
  enemies: Enemy[]
  patterns: EnemyPattern[]
}

export interface EnemySnap {
  id: string
  name: string
  lvl: number
  count: number
  gold: number
}
