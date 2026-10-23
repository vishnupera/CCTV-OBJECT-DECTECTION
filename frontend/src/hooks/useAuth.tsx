import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'

interface User {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'operator' | 'viewer'
  totp_enabled: boolean
  last_login: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, totp?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/me', { withCredentials: true })
      setUser(res.data)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  const login = async (email: string, password: string, totp?: string) => {
    await axios.post('/api/auth/login', { email, password, totp_code: totp }, { withCredentials: true })
    await refreshUser()
  }

  const logout = async () => {
    await axios.post('/api/auth/logout', {}, { withCredentials: true })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
