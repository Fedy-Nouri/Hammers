import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authApi, type UserResponse } from '../lib/api/auth'
import { usersApi } from '../lib/api/users'

interface AuthState {
  user: UserResponse | null
  accessToken: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>
  logout: () => Promise<void>
  updateUser: (partial: Partial<UserResponse>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'authUser'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, isLoading: true })

  const setAuth = (accessToken: string, refreshToken: string, user: UserResponse) => {
    sessionStorage.setItem('accessToken', accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setState({ user, accessToken, isLoading: false })
  }

  const clearAuth = () => {
    sessionStorage.removeItem('accessToken')
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setState({ user: null, accessToken: null, isLoading: false })
  }

  // Restore session on mount via refresh token
  const bootstrap = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) { setState((s) => ({ ...s, isLoading: false })); return }
    try {
      const tokens = await authApi.refresh(refreshToken)
      sessionStorage.setItem('accessToken', tokens.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
      // Refresh the user (incl. role/plan) so the console/nav reflect current state; fall back to cache.
      const cachedUser = localStorage.getItem(USER_KEY)
      const cached: UserResponse | null = cachedUser ? (JSON.parse(cachedUser) as UserResponse) : null
      const user = await usersApi.getMe().catch(() => cached)
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
      setState({ user, accessToken: tokens.accessToken, isLoading: false })
    } catch {
      clearAuth()
    }
  }, [])

  useEffect(() => { void bootstrap() }, [bootstrap])

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password })
    setAuth(data.accessToken, data.refreshToken, data.user)
  }

  const register = async (input: { email: string; password: string; firstName?: string; lastName?: string }) => {
    const data = await authApi.register(input)
    setAuth(data.accessToken, data.refreshToken, data.user)
  }

  const logout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
  }

  const updateUser = (partial: Partial<UserResponse>) => {
    setState((s) => {
      const updated = s.user ? { ...s.user, ...partial } : s.user
      if (updated) localStorage.setItem(USER_KEY, JSON.stringify(updated))
      return { ...s, user: updated }
    })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
