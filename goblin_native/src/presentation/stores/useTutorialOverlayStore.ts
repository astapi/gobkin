import { create } from 'zustand'
import type { TutorialStep } from '../../shared/types/Tutorial'

export interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

export type SpotlightPlacement = 'above' | 'below' | 'auto'

export interface SpotlightEntry {
  id: string
  rect: SpotlightRect | null
  messageKey: string
  placement: SpotlightPlacement
  forStep: TutorialStep
  /** push 時刻。複数候補があるときは最新を採用 */
  pushedAt: number
}

interface TutorialOverlayState {
  entries: SpotlightEntry[]
  setEntry: (entry: Omit<SpotlightEntry, 'pushedAt'>) => void
  clearEntry: (id: string) => void
}

export const useTutorialOverlayStore = create<TutorialOverlayState>((set, get) => ({
  entries: [],
  setEntry: (entry) => {
    const next = get().entries.filter(e => e.id !== entry.id)
    next.push({ ...entry, pushedAt: Date.now() })
    set({ entries: next })
  },
  clearEntry: (id) => {
    set({ entries: get().entries.filter(e => e.id !== id) })
  },
}))

/** 現在のステップに対応する最新のエントリを返す */
export const selectActiveEntry = (
  entries: SpotlightEntry[],
  currentStep: TutorialStep,
): SpotlightEntry | null => {
  let latest: SpotlightEntry | null = null
  for (const entry of entries) {
    if (entry.forStep !== currentStep) continue
    if (!latest || entry.pushedAt > latest.pushedAt) {
      latest = entry
    }
  }
  return latest
}
