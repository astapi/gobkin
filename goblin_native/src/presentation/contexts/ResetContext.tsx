import { createContext, useContext, type ReactNode } from 'react'

interface ResetContextValue {
  resetAndReinitialize: () => Promise<void>
  reloadAfterImport: () => Promise<void>
}

const ResetContext = createContext<ResetContextValue | null>(null)

export function ResetProvider({
  resetAndReinitialize,
  reloadAfterImport,
  children,
}: {
  resetAndReinitialize: () => Promise<void>
  reloadAfterImport: () => Promise<void>
  children: ReactNode
}) {
  return (
    <ResetContext.Provider value={{ resetAndReinitialize, reloadAfterImport }}>
      {children}
    </ResetContext.Provider>
  )
}

export function useReset(): ResetContextValue {
  const ctx = useContext(ResetContext)
  if (!ctx) throw new Error('useReset must be used within ResetProvider')
  return ctx
}
