import type { BaseState } from '../../shared/types'
import type { IBaseStateRepository } from '../../core/repositories/IBaseStateRepository'

const STORAGE_KEY = 'goblin-kingdom-base-state'

const createDefaultBaseState = (): BaseState => {
  return {
    capacity: 8,
    rank: 1,
  }
}

export class JsonBaseStateRepositoryImpl implements IBaseStateRepository {
  private cache: BaseState | null = null

  async initialize(): Promise<void> {
    this.loadFromLocalStorage()
  }

  private loadFromLocalStorage(): void {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        this.cache = JSON.parse(saved) as BaseState
      } catch (error) {
        console.warn('Failed to load base state from localStorage:', error)
        this.cache = createDefaultBaseState()
        this.saveToLocalStorage()
      }
    } else {
      this.cache = createDefaultBaseState()
      this.saveToLocalStorage()
    }
  }

  private saveToLocalStorage(): void {
    if (this.cache !== null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache))
    }
  }

  getBaseState(): BaseState | null {
    if (this.cache === null) {
      this.loadFromLocalStorage()
    }
    return this.cache ? { ...this.cache } : null
  }

  saveBaseState(state: BaseState): void {
    this.cache = { ...state }
    this.saveToLocalStorage()
  }
}
