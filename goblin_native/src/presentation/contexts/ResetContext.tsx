import { createContext, useContext, type ReactNode } from 'react'

interface ResetContextValue {
  resetAndReinitialize: () => Promise<void>
}

const ResetContext = createContext<ResetContextValue | null>(null)

export function ResetProvider({
  resetAndReinitialize,
  children,
}: {
  resetAndReinitialize: () => Promise<void>
  children: ReactNode
}) {
  return (
    <ResetContext.Provider value={{ resetAndReinitialize }}>
      {children}
    </ResetContext.Provider>
  )
}

export function useReset(): ResetContextValue {
  const ctx = useContext(ResetContext)
  if (!ctx) throw new Error('useReset must be used within ResetProvider')
  return ctx
}
