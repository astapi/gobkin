import type { Goblin } from '../../shared/types'
import type { IPendingGoblinRepository } from '../../core/repositories/IPendingGoblinRepository'

const STORAGE_KEY = 'goblin-kingdom-pending-goblins'

export class JsonPendingGoblinRepositoryImpl implements IPendingGoblinRepository {
  private cache: Goblin[] | null = null

  async initialize(): Promise<void> {
    this.loadFromLocalStorage()
  }

  private loadFromLocalStorage(): void {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        this.cache = JSON.parse(saved) as Goblin[]
      } catch (error) {
        console.warn('Failed to load pending goblins from localStorage:', error)
        this.cache = []
      }
    } else {
      this.cache = []
    }
  }

  private saveToLocalStorage(): void {
    if (this.cache !== null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache))
    }
  }

  getPendingGoblins(): Goblin[] {
    if (this.cache === null) {
      this.loadFromLocalStorage()
    }
    return this.cache ? [...this.cache] : []
  }

  addPendingGoblin(goblin: Goblin): void {
    if (this.cache === null) {
      this.loadFromLocalStorage()
    }
    if (this.cache) {
      this.cache.push(goblin)
      this.saveToLocalStorage()
    }
  }

  removePendingGoblin(id: number): void {
    if (this.cache === null) {
      this.loadFromLocalStorage()
    }
    if (this.cache) {
      this.cache = this.cache.filter(g => g.id !== id)
      this.saveToLocalStorage()
    }
  }

  clearPendingGoblins(): void {
    this.cache = []
    this.saveToLocalStorage()
  }
}
