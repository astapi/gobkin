import type { AreaConfig } from '../types'

export const areasConfig: AreaConfig[] = [
  {
    id: "slime_cave",
    name: "スライムの洞窟",
    floors: 2,
    baseDurationSec: 45,
    moveSpeedScale: 1.1,
    encounter: {
      perFloorEvents: 2,
      eventWeights: {
        battle: 80,
        exploring: 15,
        trap: 0,
        npc: 5
      },
      pityTimerSec: 3
    },
    enemyTable: [
      { id: "tutorial_slime", weight: 80, lvl: 1 },
      { id: "sticky_slime", weight: 20, lvl: 2 }
    ],
    boss: { id: "slime_mother", lvl: 3 },
    rewards: {
      xpFloor: [4, 6],
      xpBoss: 15,
      captureBonus: 0.12
    },
    unlockNext: "forest_outskirts"
  },
  {
    id: "forest_outskirts",
    name: "周辺の森",
    floors: 3,
    baseDurationSec: 60,
    moveSpeedScale: 1.0,
    encounter: {
      perFloorEvents: 2,
      eventWeights: {
        battle: 60,
        exploring: 25,
        trap: 10,
        npc: 5
      },
      pityTimerSec: 4
    },
    enemyTable: [
      { id: "slime", weight: 40, lvl: 1 },
      { id: "goblin_scout", weight: 30, lvl: 1 },
      { id: "forest_wolf", weight: 20, lvl: 2 },
      { id: "wild_boar", weight: 10, lvl: 2 }
    ],
    boss: { id: "forest_guardian", lvl: 3 },
    rewards: {
      xpFloor: [8, 10, 12],
      xpBoss: 30,
      captureBonus: 0.05
    },
    unlockNext: "mossy_cave"
  },
  {
    id: "mossy_cave",
    name: "苔むした洞窟",
    floors: 5,
    baseDurationSec: 120,
    moveSpeedScale: 0.9,
    encounter: {
      perFloorEvents: 3,
      eventWeights: {
        battle: 70,
        exploring: 20,
        trap: 8,
        npc: 2
      },
      pityTimerSec: 5
    },
    enemyTable: [
      { id: "cave_slime", weight: 35, lvl: 2 },
      { id: "bat_swarm", weight: 30, lvl: 2 },
      { id: "skeleton", weight: 20, lvl: 3 },
      { id: "cave_spider", weight: 15, lvl: 3 }
    ],
    boss: { id: "slime_king", lvl: 5 },
    rewards: {
      xpFloor: [10, 12, 14, 16, 18],
      xpBoss: 50,
      captureBonus: 0.08
    },
    unlockNext: "old_mine"
  },
  {
    id: "old_mine",
    name: "古びた採掘跡",
    floors: 7,
    baseDurationSec: 240,
    moveSpeedScale: 0.8,
    encounter: {
      perFloorEvents: 3,
      eventWeights: {
        battle: 65,
        exploring: 25,
        trap: 8,
        npc: 2
      },
      pityTimerSec: 6
    },
    enemyTable: [
      { id: "rock_golem", weight: 30, lvl: 4 },
      { id: "mine_ghost", weight: 25, lvl: 3 },
      { id: "crystal_spider", weight: 25, lvl: 4 },
      { id: "earth_elemental", weight: 20, lvl: 5 }
    ],
    boss: { id: "ancient_golem", lvl: 7 },
    rewards: {
      xpFloor: [12, 14, 16, 18, 20, 22, 24],
      xpBoss: 80,
      captureBonus: 0.06
    }
  }
]

// 敵データの定義
export const enemyDatabase = {
  "tutorial_slime": { name: "スライム", baseHP: 12, baseATK: 5, baseDEF: 2 },
  "sticky_slime": { name: "ぷるぷるスライム", baseHP: 16, baseATK: 6, baseDEF: 3 },
  "slime_mother": { name: "大きなスライム", baseHP: 40, baseATK: 8, baseDEF: 5 },
  "slime": { name: "スライム", baseHP: 20, baseATK: 8, baseDEF: 3 },
  "goblin_scout": { name: "ゴブリン斥候", baseHP: 25, baseATK: 12, baseDEF: 5 },
  "forest_wolf": { name: "森の狼", baseHP: 35, baseATK: 15, baseDEF: 8 },
  "wild_boar": { name: "野生の猪", baseHP: 45, baseATK: 18, baseDEF: 12 },
  "forest_guardian": { name: "森の守護者", baseHP: 120, baseATK: 25, baseDEF: 15 },
  "cave_slime": { name: "洞窟スライム", baseHP: 30, baseATK: 10, baseDEF: 4 },
  "bat_swarm": { name: "コウモリの群れ", baseHP: 20, baseATK: 12, baseDEF: 2 },
  "skeleton": { name: "骸骨", baseHP: 40, baseATK: 16, baseDEF: 10 },
  "cave_spider": { name: "洞窟蜘蛛", baseHP: 25, baseATK: 14, baseDEF: 6 },
  "slime_king": { name: "スライムキング", baseHP: 180, baseATK: 30, baseDEF: 20 },
  "rock_golem": { name: "岩石ゴーレム", baseHP: 80, baseATK: 20, baseDEF: 25 },
  "mine_ghost": { name: "鉱山の亡霊", baseHP: 50, baseATK: 18, baseDEF: 8 },
  "crystal_spider": { name: "水晶蜘蛛", baseHP: 35, baseATK: 22, baseDEF: 12 },
  "earth_elemental": { name: "土の精霊", baseHP: 70, baseATK: 24, baseDEF: 18 },
  "ancient_golem": { name: "古代ゴーレム", baseHP: 300, baseATK: 40, baseDEF: 35 }
}