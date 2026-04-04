import type { BaseState } from '../../shared/types'

export interface IBaseStateRepository {
  getBaseState(): Promise<BaseState | null>
  saveBaseState(state: BaseState): Promise<void>
  getAndIncrementNextGoblinId(): Promise<number>
}
