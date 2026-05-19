import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '../lib/api'
import type { User } from '@shared/types'

const TOKEN_KEY = 'dnl_token'

interface AuthContextValue {
  user: User | null
  loading: boolean
  apiAvailable: boolean
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setLoading(false); return }
    api.auth.getCurrentUser()
      .then(u => setUser(u))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  async function refreshUser() {
    try {
      const u = await api.auth.getCurrentUser()
      setUser(u)
    } catch (e) {
      console.error('[Auth] Erro ao recuperar usuário:', e)
    }
  }

  async function login(email: string, senha: string) {
    try {
      const result = await api.auth.login(email, senha)
      if (result.success && result.token) {
        localStorage.setItem(TOKEN_KEY, result.token)
        await refreshUser()
        return { success: true }
      }
      return { success: false, error: result.error || 'Falha no login' }
    } catch (e: any) {
      return { success: false, error: e.message || 'Erro de conexão' }
    }
  }

  async function logout() {
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, loading, apiAvailable: true, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider')
  return ctx
}
