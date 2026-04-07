import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

const STORAGE_KEY = 'debug-settings'

interface DebugSettingsState {
  isLoading: boolean
  instantDungeonExploration: boolean
}

interface DebugSettingsActions {
  initialize: () => Promise<void>
  setInstantDungeonExploration: (enabled: boolean) => Promise<void>
}

export const useDebugSettingsStore = create<DebugSettingsState & DebugSettingsActions>()((set) => ({
  isLoading: true,
  instantDungeonExploration: false,

  initialize: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) {
        set({ isLoading: false })
        return
      }

      const parsed = JSON.parse(raw) as Partial<Pick<DebugSettingsState, 'instantDungeonExploration'>>
      set({
        instantDungeonExploration: parsed.instantDungeonExploration ?? false,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  setInstantDungeonExploration: async (enabled: boolean) => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ instantDungeonExploration: enabled }),
    )
    set({ instantDungeonExploration: enabled })
  },
}))
