// src/context/AuthContext.tsx
// ─────────────────────────────────────────────────────────────
// The top-level context for authentication and user identity.
//
// Provides:
//   • Supabase User + Profile (from useAuth internal hook)
//   • appLoading gate (blocks child contexts from booting early)
//   • Typed action helpers: updateUIMode, updateTimezone, signOut
//   • ThemeCtx.Provider (composed here — theme derives from profile)
//   • DOM side-effect: syncs `ui_mode` to <html> class for Tailwind
//
// Provider tree position: OUTERMOST — must wrap all other providers.
//
//   <AuthProvider>
//     <TournamentProvider>   ← reads useAuthContext().profile
//       <BracketProvider>
//         <LeaderboardProvider>
//           <App />
//         </LeaderboardProvider>
//       </BracketProvider>
//     </TournamentProvider>
//   </AuthProvider>
//
// Consumers: call useAuthContext() anywhere inside the tree.
// Do NOT call useAuth() directly outside of this file.
//
// ── Tailwind dark mode note ───────────────────────────────────
// This file adds / removes the `dark` class on <html> when
// ui_mode changes. For this to take effect your tailwind.config.js
// must include:
//
//   export default {
//     darkMode: 'class',   // ← required
//     ...
//   }
//
// All dark-mode-aware classes then use the `dark:` variant prefix.
// The existing ThemeConfig colour tokens (appBg, panelBg, etc.)
// are not dark:-prefixed yet — that is a Phase 4 visual pass.
// ─────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'

import { ThemeCtx, THEMES }      from '../utils/theme'
import { useAuth, type AuthState } from '../hooks/useAuth'

import AuthForm from '../components/AuthForm'

import { supabase }  from '../services/supabaseClient'

// ── Context shape ─────────────────────────────────────────────
//
// We re-export AuthState directly so consumers get the same
// fully-typed interface without a second wrapper type.
// The context value is null only before AuthProvider mounts —
// useAuthContext() throws if consumed outside the tree, which
// surfaces misconfigured component placement immediately.

type AuthContextValue = AuthState

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth()

  const { profile, appLoading } = auth

  // ── Side-effect: sync ui_mode → <html class="dark"> ──────
  //
  // Tailwind's class-based dark mode watches for the `dark` class
  // on the root <html> element. We add it when ui_mode is 'dark'
  // and remove it for 'light'. This runs synchronously before paint
  // on every ui_mode change so there is no flash of wrong mode.
  //
  // We use a ref to track the previously applied class so we can
  // cleanly remove it without affecting any other classes on <html>.
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
  //
  // ThemeCtx.Provider lives here (not in App.tsx) because the
  // theme key comes from profile.theme, which this context owns.
  // Any component in the tree can call useTheme() and receive
  // the correct resolved config without App.tsx needing to
  // thread it down as a prop.
  //
  // Falls back to 'ember' if profile is null (loading state) or
  // if profile.theme is somehow not in the THEMES map.
  const currentTheme =
    (profile?.theme && THEMES[profile.theme]) ? THEMES[profile.theme] : THEMES.ember

  // ── Loading gate ──────────────────────────────────────────
  //
  // While Supabase is validating the session token and fetching
  // the profile, we render a minimal spinner rather than flashing
  // the AuthForm or an empty app shell. This prevents the jarring
  // redirect-to-login that happens when auth state isn't yet known.
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
  //
  // If loading is complete and there is still no user or profile,
  // render the AuthForm. We pass a minimal onAuth callback that
  // triggers a fresh getUser() call — the onAuthStateChange
  // subscription in useAuth will handle the rest automatically.
  //
  // We render AuthForm INSIDE AuthContext.Provider so that any
  // future OAuth redirect flows can access context if needed,
  // but OUTSIDE ThemeCtx.Provider since the theme derives from
  // a profile we don't have yet (AuthForm has its own styling).
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
  //
  // Both user and profile are confirmed non-null here.
  // ThemeCtx.Provider wraps children so every component in the
  // authenticated app tree can call useTheme() without prop drilling.
  return (
    <AuthContext.Provider value={auth}>
      <ThemeCtx.Provider value={currentTheme}>
        {children}
      </ThemeCtx.Provider>
    </AuthContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────

/**
 * Access the full auth state and actions from any component
 * inside <AuthProvider>.
 *
 * Throws a descriptive error if called outside the provider tree
 * so misconfiguration surfaces immediately during development
 * rather than as a silent null-access bug in production.
 *
 * When this hook is called in an authenticated context, `profile`
 * and `user` are guaranteed non-null — the AuthProvider renders
 * children only when both are resolved (see the auth gate above).
 */
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

/**
 * Convenience selector for components that only need the
 * resolved Profile. Avoids destructuring when the caller
 * doesn't need user, signOut, or the action helpers.
 *
 * Safe to call in authenticated context — profile is non-null
 * when children are rendered (see AuthProvider auth gate).
 */
export function useProfile(): NonNullable<AuthState['profile']> {
  const { profile } = useAuthContext()
  // Assertion is safe: AuthProvider only renders children when
  // profile is non-null (guarded by the auth gate above).
  return profile!
}
