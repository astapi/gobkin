import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

export interface AuthContextType {
  user: User | null
  loading: boolean
  signInAnonymous: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
