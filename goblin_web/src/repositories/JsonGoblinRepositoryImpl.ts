import type { Goblin } from '../types/index.ts'
import type { GoblinRepository } from './GoblinRepository.ts'

export class JsonGoblinRepositoryImpl implements GoblinRepository {
  private goblins: Goblin[] = [
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

  getGoblins(): Goblin[] {
    return this.goblins
  }

  getGoblin(id: number): Goblin | null {
    return this.goblins.find(g => g.id === id) || null
  }

  saveGoblin(goblin: Goblin): void {
    const index = this.goblins.findIndex(g => g.id === goblin.id)
    if (index >= 0) {
      this.goblins[index] = goblin
    } else {
      this.goblins.push(goblin)
    }
  }

  deleteGoblin(id: number): void {
    this.goblins = this.goblins.filter(g => g.id !== id)
  }

  updateGoblinStats(id: number, stats: Goblin['stats']): void {
    const goblin = this.getGoblin(id)
    if (goblin) {
      goblin.stats = stats
      this.saveGoblin(goblin)
    }
  }

  updateGoblinLevel(id: number, level: number): void {
    const goblin = this.getGoblin(id)
    if (goblin) {
      goblin.level = level
      this.saveGoblin(goblin)
    }
  }
}
