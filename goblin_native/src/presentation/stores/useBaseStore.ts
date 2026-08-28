import { create } from 'zustand'
import type { BaseState, Goblin } from '../../shared/types'
import { baseStateRepository, pendingGoblinRepository } from '../di/repositories'
import { performRankUp as executeRankUp, checkRankUpAvailable } from '../../core/services/BaseRankSystem'

interface BaseStoreState {
  baseState: BaseState | null
  pendingGoblins: Goblin[]
  isLoading: boolean
}

interface BaseStoreActions {
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  performRankUp: () => Promise<{ success: true; state: BaseState } | { success: false; error: string }>
  getNextGoblinId: () => Promise<number>
  updateBaseState: (updates: Partial<BaseState>) => Promise<void>
  /** 最新残高を基準にGoldを差分更新する。負残高になる場合は false を返す。 */
  addGold: (delta: number) => Promise<boolean>
  addPendingGoblin: (goblin: Goblin) => Promise<void>
  removePendingGoblin: (id: number) => Promise<void>
  clearPendingGoblins: () => Promise<void>
  refreshPendingGoblins: () => Promise<void>
}

export const useBaseStore = create<BaseStoreState & BaseStoreActions>()((set, get) => {
  const refreshBase = async () => {
    const state = await baseStateRepository.getBaseState()
    set({ baseState: state })
  }

  const refreshPending = async () => {
    const goblins = await pendingGoblinRepository.getPendingGoblins()
    set({ pendingGoblins: goblins })
  }

  return {
    baseState: null,
    pendingGoblins: [],
    isLoading: true,

    initialize: async () => {
      const [state, pending] = await Promise.all([
        baseStateRepository.getBaseState(),
        pendingGoblinRepository.getPendingGoblins(),
      ])
      set({ baseState: state, pendingGoblins: pending, isLoading: false })
    },

    refresh: async () => {
      await Promise.all([refreshBase(), refreshPending()])
    },

    performRankUp: async () => {
      const { baseState } = get()
      if (!baseState) {
        return { success: false, error: '拠点状態が読み込まれていません' }
      }
      const result = executeRankUp(baseState)
      if (result.success) {
        await baseStateRepository.saveBaseState(result.state)
        set({ baseState: result.state })
      }
      return result
    },

    getNextGoblinId: async () => {
      return baseStateRepository.getAndIncrementNextGoblinId()
    },

    updateBaseState: async (updates: Partial<BaseState>) => {
      const { baseState } = get()
      if (!baseState) return
      const newState: BaseState = { ...baseState, ...updates }
      await baseStateRepository.saveBaseState(newState)
      set({ baseState: newState })
    },

    addGold: async (delta: number) => {
      // クロージャの古い値ではなく最新stateを読んで加算する
      const { baseState } = get()
      if (!baseState) return false
      const newGold = baseState.gold + delta
      if (newGold < 0) return false
      const newState: BaseState = { ...baseState, gold: newGold }
      await baseStateRepository.saveBaseState(newState)
      set({ baseState: newState })
      return true
    },

    addPendingGoblin: async (goblin: Goblin) => {
      await pendingGoblinRepository.addPendingGoblin(goblin)
      await refreshPending()
    },

    removePendingGoblin: async (id: number) => {
      await pendingGoblinRepository.removePendingGoblin(id)
      await refreshPending()
    },

    clearPendingGoblins: async () => {
      await pendingGoblinRepository.clearPendingGoblins()
      set({ pendingGoblins: [] })
    },

    refreshPendingGoblins: refreshPending,
  }
})

/** computed selectors */
export const selectRank = (s: BaseStoreState) => s.baseState?.rank ?? 1
export const selectMaxGoblins = (s: BaseStoreState) => s.baseState?.currentMaxGoblins ?? 10
export const selectMaxParties = (s: BaseStoreState) => s.baseState?.currentMaxParties ?? 1
export const selectGold = (s: BaseStoreState) => s.baseState?.gold ?? 0
export const selectCapacity = (s: BaseStoreState) => s.baseState?.capacity ?? 10
export const selectCanRankUp = (s: BaseStoreState) =>
  s.baseState ? checkRankUpAvailable(s.baseState).canRankUp : false

/** UseCase等にリポジトリを渡す必要がある場合に使用 */
export const getBaseStateRepository = () => baseStateRepository
