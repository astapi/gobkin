import type { Goblin } from '../shared/types'
import type { GoblinRepository } from './GoblinRepository.ts'

export class JsonGoblinRepositoryImpl implements GoblinRepository {
  private goblins: Goblin[] = [
    {
      id: 0,
      name: 'グラッシュ',
      race: 'ゴブリン',
      level: 15,
      avatar: '/src/assets/goblin/goblin.png',
      stats: { hp: 120, atk: 85, sp: 45, spd: 60, def: 75 },
      equipment: [
        { slotIndex: 0, itemId: null },
        { slotIndex: 1, itemId: null },
        { slotIndex: 2, itemId: null }
      ]
    },
    {
      id: 1,
      name: 'ズィーク',
      race: 'ゴブリン',
      level: 12,
      avatar: '/src/assets/goblin/goblin.png',
      stats: { hp: 80, atk: 95, sp: 90, spd: 70, def: 45 },
      equipment: [
        { slotIndex: 0, itemId: null },
        { slotIndex: 1, itemId: null },
        { slotIndex: 2, itemId: null }
      ]
    },
    {
      id: 2,
      name: 'シャープ',
      race: 'ゴブリン',
      level: 13,
      avatar: '/src/assets/goblin/goblin.png',
      stats: { hp: 90, atk: 80, sp: 65, spd: 85, def: 55 },
      equipment: [
        { slotIndex: 0, itemId: null },
        { slotIndex: 1, itemId: null },
        { slotIndex: 2, itemId: null }
      ]
    },
    {
      id: 3,
      name: 'ガード',
      race: 'ゴブリン',
      level: 11,
      avatar: '/src/assets/goblin/goblin.png',
      stats: { hp: 130, atk: 50, sp: 40, spd: 45, def: 95 },
      equipment: [
        { slotIndex: 0, itemId: null },
        { slotIndex: 1, itemId: null },
        { slotIndex: 2, itemId: null }
      ]
    },
    {
      id: 4,
      name: 'スピード',
      race: 'ゴブリン',
      level: 14,
      avatar: '/src/assets/goblin/goblin.png',
      stats: { hp: 85, atk: 75, sp: 70, spd: 95, def: 50 },
      equipment: [
        { slotIndex: 0, itemId: null },
        { slotIndex: 1, itemId: null },
        { slotIndex: 2, itemId: null }
      ]
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

  equipItem(goblinId: number, slotIndex: number, itemId: string): void {
    const goblin = this.getGoblin(goblinId)
    if (goblin) {
      goblin.equipment[slotIndex] = { slotIndex, itemId }
      this.saveGoblin(goblin)
    }
  }

  unequipItem(goblinId: number, slotIndex: number): void {
    const goblin = this.getGoblin(goblinId)
    if (goblin) {
      goblin.equipment[slotIndex] = { slotIndex, itemId: null }
      this.saveGoblin(goblin)
    }
  }
}
