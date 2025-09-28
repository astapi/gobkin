import type { Goblin, Dungeon } from '../types/index.ts'

export const goblinsData: Goblin[] = [
  {
    id: 0,
    name: 'グラッシュ',
    job: '戦士',
    level: 15,
    avatar: '👹',
    stats: { hp: 120, atk: 85, sp: 45, spd: 60, def: 75 }
  },
  {
    id: 1,
    name: 'ズィーク',
    job: '魔法使い',
    level: 12,
    avatar: '🧙',
    stats: { hp: 80, atk: 95, sp: 90, spd: 70, def: 45 }
  },
  {
    id: 2,
    name: 'シャープ',
    job: '弓使い',
    level: 13,
    avatar: '🏹',
    stats: { hp: 90, atk: 80, sp: 65, spd: 85, def: 55 }
  },
  {
    id: 3,
    name: 'ガード',
    job: '盾使い',
    level: 11,
    avatar: '🛡️',
    stats: { hp: 130, atk: 50, sp: 40, spd: 45, def: 95 }
  },
  {
    id: 4,
    name: 'スピード',
    job: '盗賊',
    level: 14,
    avatar: '⚡',
    stats: { hp: 85, atk: 75, sp: 70, spd: 95, def: 50 }
  }
]

export const dungeonsData: Dungeon[] = [
  {
    id: 1,
    name: '森の洞窟',
    icon: '🌲',
    difficulty: '★☆☆',
    difficultyLevel: 1,
    rewards: {
      gold: '50-100',
      item: '⚔️ 装備ドロップ'
    }
  },
  {
    id: 2,
    name: '岩山の遺跡',
    icon: '🗻',
    difficulty: '★★☆',
    difficultyLevel: 2,
    rewards: {
      gold: '100-200',
      item: '💎 宝石ドロップ'
    }
  },
  {
    id: 3,
    name: '火山の神殿',
    icon: '🌋',
    difficulty: '★★★',
    difficultyLevel: 3,
    rewards: {
      gold: '200-500',
      item: '🏆 レア装備'
    },
    disabled: true
  }
]