import { create } from 'zustand'

interface ToastDismissState {
  revision: number
  dismissAll: () => void
}

export const useToastDismissStore = create<ToastDismissState>()((set) => ({
  revision: 0,
  dismissAll: () => set(state => ({ revision: state.revision + 1 })),
}))
