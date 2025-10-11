import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { type User, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../config/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInAnonymous: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const signInAnonymous = async () => {
    try {
      await signInAnonymously(auth)
    } catch (error) {
      console.error('匿名認証エラー:', error)
      throw error
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user)
        setLoading(false)
      } else {
        try {
          await signInAnonymously(auth)
        } catch (error) {
          console.error('自動匿名認証エラー:', error)
          setLoading(false)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  const value = {
    user,
    loading,
    signInAnonymous
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}