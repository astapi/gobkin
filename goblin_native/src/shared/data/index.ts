import type { Goblin, Dungeon } from '../types'
import allAreaJson from './expeditionArea/allArea.json'

export const goblinsData: Goblin[] = [
  {
    id: 0,
    name: 'グラッシュ',
    race: 'ゴブリン',
    level: 15,
    experience: 0,
    avatar: '/src/assets/goblin/goblin.png',
    stats: { hp: 100, atk: 70, sp: 45, spd: 60, def: 65, attackCount: 2, accuracy: 25, evasion: 20 }
  }
]

export const areasData: Dungeon[] = allAreaJson.areas
