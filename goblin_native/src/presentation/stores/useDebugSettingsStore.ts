import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

const STORAGE_KEY = 'debug-settings'

interface DebugSettingsState {
  isLoading: boolean
  instantDungeonExploration: boolean
  instantGoldenAcorn: boolean
}

interface DebugSettingsActions {
  initialize: () => Promise<void>
  setInstantDungeonExploration: (enabled: boolean) => Promise<void>
  setInstantGoldenAcorn: (enabled: boolean) => Promise<void>
}

type PersistedSettings = Partial<Pick<DebugSettingsState, 'instantDungeonExploration' | 'instantGoldenAcorn'>>

const persist = async (settings: PersistedSettings): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const useDebugSettingsStore = create<DebugSettingsState & DebugSettingsActions>()((set, get) => ({
  isLoading: true,
  instantDungeonExploration: false,
  instantGoldenAcorn: false,

  initialize: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) {
        set({ isLoading: false })
        return
      }

      const parsed = JSON.parse(raw) as PersistedSettings
      set({
        instantDungeonExploration: parsed.instantDungeonExploration ?? false,
        instantGoldenAcorn: parsed.instantGoldenAcorn ?? false,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  setInstantDungeonExploration: async (enabled: boolean) => {
    set({ instantDungeonExploration: enabled })
    await persist({
      instantDungeonExploration: enabled,
      instantGoldenAcorn: get().instantGoldenAcorn,
    })
  },

  setInstantGoldenAcorn: async (enabled: boolean) => {
    set({ instantGoldenAcorn: enabled })
    await persist({
      instantDungeonExploration: get().instantDungeonExploration,
      instantGoldenAcorn: enabled,
    })
  },
}))
