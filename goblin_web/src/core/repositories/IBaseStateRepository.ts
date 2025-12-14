import type { BaseState } from '../../shared/types'

export interface IBaseStateRepository {
  initialize(): Promise<void>
  getBaseState(): BaseState | null
  saveBaseState(state: BaseState): void
}
