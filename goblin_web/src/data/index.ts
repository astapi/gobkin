import type { Goblin, Dungeon } from '../types/index.ts'
import dungeonJson from './dungeon.json'
import allAreaJson from './expeditionArea/allArea.json'

export const goblinsData: Goblin[] = [
  {
    id: 0,
    name: 'グラッシュ',
    race: 'ゴブリン',
    level: 15,
    avatar: '/src/assets/goblin/goblin.png',
    stats: { hp: 120, atk: 85, sp: 45, spd: 60, def: 75 }
  },
  {
    id: 1,
    name: 'ズィーク',
    race: 'ゴブリン',
    level: 12,
    avatar: '/src/assets/goblin/goblin.png',
    stats: { hp: 80, atk: 95, sp: 90, spd: 70, def: 45 }
  },
  {
    id: 2,
    name: 'シャープ',
    race: 'ゴブリン',
    level: 13,
    avatar: '/src/assets/goblin/goblin.png',
    stats: { hp: 90, atk: 80, sp: 65, spd: 85, def: 55 }
  },
  {
    id: 3,
    name: 'ガード',
    race: 'ゴブリン',
    level: 11,
    avatar: '/src/assets/goblin/goblin.png',
    stats: { hp: 130, atk: 50, sp: 40, spd: 45, def: 95 }
  },
  {
    id: 4,
    name: 'スピード',
    race: 'ゴブリン',
    level: 14,
    avatar: '/src/assets/goblin/goblin.png',
    stats: { hp: 85, atk: 75, sp: 70, spd: 95, def: 50 }
  }
]

export const dungeonsData: Dungeon[] = dungeonJson.dungeons

export const areasData: Dungeon[] = allAreaJson.areas