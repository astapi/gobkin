import type { FactorDropConfig } from './Factor'

export interface EquipmentDropConfig {
  templateId: string   // EquipmentTemplate.id
  probability: number  // 0.0〜1.0
}

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
  attackCount: number  // 攻撃回数
  accuracy: number     // 命中精度
  evasion: number      // 回避能力
  exp: number
  gold: number
  factorDrops?: FactorDropConfig[]      // この敵を倒すと得られる可能性のある因子
  equipmentDrops?: EquipmentDropConfig[] // この敵を倒すと得られる可能性のある装備
}

export interface EnemyPattern {
  id: string
  floors: number[]
  enemies: string[][]  // enemies[row][slotIndex] = enemyId（2D配列で隊列を表現）
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
