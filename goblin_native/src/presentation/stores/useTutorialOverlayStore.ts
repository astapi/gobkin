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
  /** true の場合のみスポット範囲へのタップを背面に通す */
  allowThrough?: boolean
  /** push 時刻。複数候補があるときは最新を採用 */
  pushedAt: number
}

interface TutorialOverlayState {
  entries: SpotlightEntry[]
  setEntry: (entry: Omit<SpotlightEntry, 'pushedAt'>) => void
  clearEntry: (id: string) => void
  clearAll: () => void
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
  clearAll: () => {
    set({ entries: [] })
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

export const selectActiveEntries = (
  entries: SpotlightEntry[],
  currentStep: TutorialStep,
): SpotlightEntry[] => entries.filter(entry => entry.forStep === currentStep)

export const selectActionableEntry = (
  entries: SpotlightEntry[],
  currentStep: TutorialStep,
): SpotlightEntry | null => {
  let latest: SpotlightEntry | null = null
  for (const entry of entries) {
    if (entry.forStep !== currentStep) continue
    if (entry.allowThrough === false) continue
    if (!latest || entry.pushedAt > latest.pushedAt) {
      latest = entry
    }
  }
  return latest
}
