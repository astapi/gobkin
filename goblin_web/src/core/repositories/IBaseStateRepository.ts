import type { BaseState } from '../../shared/types'

export interface IBaseStateRepository {
  getBaseState(): BaseState | null
  saveBaseState(state: BaseState): void
  updateLastSpawnTime(timestamp: number): void
}
