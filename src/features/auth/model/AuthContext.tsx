// src/features/auth/model/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react'

import { ThemeCtx, THEMES }       from '../../../shared/lib/theme'
import { useAuth, type AuthState } from './useAuth'

import AuthForm from '../ui/AuthForm'

type AuthContextValue = AuthState

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth()
  const { profile, appLoading } = auth

  /**
   * Syncs the user's UI mode preference to the document root.
   * Strictly uses classList to avoid imperative style manipulation.
   */
  useEffect(() => {
    const mode = profile?.ui_mode ?? 'dark'
    const html = document.documentElement

    if (mode === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [profile?.ui_mode])

  // ── Derive the active ThemeConfig ─────────────────────────

  const currentTheme =
    (profile?.theme && THEMES[profile.theme]) ? THEMES[profile.theme] : THEMES.ember

  // ── Loading gate ───────────────────────────────────────────

  if (appLoading) {
    return (
      <div
        className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors duration-300"
        role="status"
        aria-label="Loading application"
      >
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading…</p>
        </div>
      </div>
    )
  }

  // ── Auth gate ──────────────────────────────────────────────

  if (!auth.user || !auth.profile) {
    return (
      <AuthContext.Provider value={auth}>
        <AuthForm onAuth={() => {}} />
      </AuthContext.Provider>
    )
  }

  // ── Authenticated render ───────────────────────────────────

  return (
    <AuthContext.Provider value={auth}>
      <ThemeCtx.Provider value={currentTheme}>
        {children}
      </ThemeCtx.Provider>
    </AuthContext.Provider>
  )
}

// ── Consumer hooks ─────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthContext() was called outside of <AuthProvider>.')
  }
  return ctx
}

export function useProfile(): NonNullable<AuthState['profile']> {
  const { profile } = useAuthContext()
  return profile!
}