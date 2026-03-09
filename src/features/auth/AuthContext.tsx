// src.context.AuthContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'

import { ThemeCtx, THEMES }      from '../../shared/utils/theme'
import { useAuth, type AuthState } from './useAuth'

import AuthForm from './AuthForm'

import { supabase }  from '../../lib/supabaseClient'

type AuthContextValue = AuthState

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth()

  const { profile, appLoading } = auth

  const appliedModeRef = useRef<'light' | 'dark' | null>(null)

  useEffect(() => {
    const mode = profile?.ui_mode ?? 'dark'
    const html  = document.documentElement

    // Remove the previously applied mode class (if any)
    if (appliedModeRef.current) {
      html.classList.remove(appliedModeRef.current)
    }

    // Apply the current mode
    html.classList.add(mode)
    appliedModeRef.current = mode

    // Cleanup on unmount: remove the class we added
    return () => {
      if (appliedModeRef.current) {
        html.classList.remove(appliedModeRef.current)
      }
    }
  }, [profile?.ui_mode])

  // ── Derive the active ThemeConfig ────────────────────────
 
  const currentTheme =
    (profile?.theme && THEMES[profile.theme]) ? THEMES[profile.theme] : THEMES.ember

  // ── Loading gate ──────────────────────────────────────────

  if (appLoading) {
    return (
      <div
        className="min-h-screen bg-slate-950 flex items-center justify-center"
        role="status"
        aria-label="Loading application"
      >
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  // ── Auth gate ─────────────────────────────────────────────

  if (!auth.user || !auth.profile) {
    return (
      <AuthContext.Provider value={auth}>
        <AuthForm
          onAuth={() => {
            // The onAuthStateChange subscription will fire SIGNED_IN
            // and cascade: user → profile fetch → appLoading false.
            // We call getUser() here as a belt-and-suspenders nudge
            // in case the component re-renders before the subscription
            // event is processed (extremely rare but defensive).
            supabase.auth.getUser().then(({ data }) => {
              if (data.user) {
                // The subscription will handle setUser — no direct call needed.
                // This is intentionally a no-op trigger.
              }
            })
          }}
        />
      </AuthContext.Provider>
    )
  }

  // ── Authenticated render ──────────────────────────────────

  return (
    <AuthContext.Provider value={auth}>
      <ThemeCtx.Provider value={currentTheme}>
        {children}
      </ThemeCtx.Provider>
    </AuthContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error(
      'useAuthContext() was called outside of <AuthProvider>.\n' +
      'Ensure <AuthProvider> wraps your component tree in main.tsx.'
    )
  }
  return ctx
}

export function useProfile(): NonNullable<AuthState['profile']> {
  const { profile } = useAuthContext()

  return profile!
}



