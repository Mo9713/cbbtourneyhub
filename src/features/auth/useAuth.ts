// src/hooks/useAuth.ts
// ─────────────────────────────────────────────────────────────
// Internal hook that owns the complete auth + profile lifecycle.
//
// Consumed exclusively by AuthContext.tsx — do not import this
// hook directly in components or views. Use useAuthContext()
// from AuthContext.tsx instead.
//
// Responsibilities:
//   1. Supabase session lifecycle  (subscribe, unsubscribe, sign-out)
//   2. Profile hydration           (fetch on login, clear on logout)
//   3. Optimistic profile updates  (ui_mode, timezone, arbitrary fields)
//   4. appLoading gate             (blocks render until session is known)
//
// What this hook does NOT do:
//   - Apply CSS classes to the DOM  (AuthContext.tsx owns that side-effect)
//   - Know about ThemeCtx           (AuthContext.tsx composes the providers)
//   - Know about routing/views      (TournamentContext.tsx owns activeView)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import type { User }                        from '@supabase/supabase-js'

import { supabase }        from '../services/supabaseClient'
import * as profileService from '../services/profileService'

import type { Profile, UIMode } from '../types'

// ── Public shape ──────────────────────────────────────────────

export interface AuthState {
  /** The raw Supabase User object, or null when logged out. */
  user:        User | null

  /**
   * The app-level Profile record from the `profiles` table.
   * null during loading or when the user is logged out.
   */
  profile:     Profile | null

  /**
   * True only during the initial session check on mount and during
   * the subsequent profile fetch. Consumers should render a loading
   * screen while this is true to avoid auth-state flicker.
   */
  appLoading:  boolean

  /**
   * Direct setter for callers that already have the full updated
   * Profile object (e.g. SettingsView after a successful save).
   * Prefer the typed action helpers below for single-field updates.
   */
  setProfile:  (p: Profile | null) => void

  /**
   * Persists a ui_mode change to Supabase and updates local state.
   * Uses an optimistic update: local state changes immediately and
   * reverts if the Supabase call fails.
   *
   * @returns error string on failure, null on success
   */
  updateUIMode: (mode: UIMode) => Promise<string | null>

  /**
   * Persists a timezone preference to Supabase and updates local state.
   * Uses an optimistic update pattern (same as updateUIMode).
   *
   * DISPLAY ONLY — this value must never be passed into isPicksLocked()
   * or any epoch comparison. See src/utils/time.ts for the architecture rule.
   *
   * @param tz  IANA timezone string, or null to reset to app default
   * @returns   error string on failure, null on success
   */
  updateTimezone: (tz: string | null) => Promise<string | null>

  /**
   * Signs the user out via Supabase. The onAuthStateChange subscription
   * handles cascading user → null → profile → null cleanup automatically.
   *
   * @returns error string on failure, null on success
   */
  signOut: () => Promise<string | null>
}

// ── Hook implementation ───────────────────────────────────────

export function useAuth(): AuthState {
  const [user,        setUser]        = useState<User | null>(null)
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [appLoading,  setAppLoading]  = useState(true)

  // ── Session lifecycle ─────────────────────────────────────
  //
  // Strategy: one canonical subscription drives all auth state.
  //
  // We call getUser() once on mount to seed the initial state
  // synchronously from the local storage cache (fast path, no
  // network round-trip needed for returning users). The subscription
  // then handles every subsequent state change (sign-in, sign-out,
  // token refresh, session expiry) for the lifetime of the app.
  //
  // We do NOT use getSession() because it does not re-validate the
  // JWT against the Supabase server. getUser() does, which prevents
  // a tampered local storage token from passing as authenticated.
  useEffect(() => {
    let cancelled = false  // guard against state updates after unmount

    // ── Initial check ──────────────────────────────────────
    // getUser() validates the token with the Supabase server.
    // If no valid session exists, data.user will be null and
    // appLoading will resolve quickly.
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUser(data.user ?? null)
    })

    // ── Realtime subscription ──────────────────────────────
    // Covers: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED,
    // PASSWORD_RECOVERY, MFA_CHALLENGE_VERIFIED.
    // We only care about the session's user, so we normalise all
    // events down to a single `setUser` call.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, []) // runs once — the subscription covers the full lifetime

  // ── Profile hydration ─────────────────────────────────────
  //
  // Whenever `user` changes:
  //   • null  → clear profile, stop loading (auth screen will render)
  //   • User  → fetch profile from Supabase, then stop loading
  //
  // setAppLoading(true) before the async fetch ensures no child
  // context (TournamentContext, BracketContext) tries to boot
  // with a stale or missing profile.
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setAppLoading(false)
      return
    }

    let cancelled = false
    setAppLoading(true)

    profileService.fetchProfile(user.id).then(result => {
      if (cancelled) return
      if (result.ok) setProfile(result.data)
      // If fetch fails we still stop loading — the app can render
      // an error state. Failing silently here would freeze the UI.
      setAppLoading(false)
    })

    return () => { cancelled = true }
  }, [user])

  // ── Action: updateUIMode ──────────────────────────────────
  //
  // Optimistic update pattern:
  //   1. Snapshot the previous profile value.
  //   2. Apply the change to local state immediately (instant UI).
  //   3. Persist to Supabase.
  //   4a. On success: replace local state with the server-confirmed
  //       Profile (ensures any server-side defaults are reflected).
  //   4b. On failure: revert to the snapshot and return the error.
  const updateUIMode = useCallback(async (mode: UIMode): Promise<string | null> => {
    if (!profile) return 'Not authenticated'

    // 1 + 2: snapshot + optimistic apply
    const prev = profile
    setProfile({ ...profile, ui_mode: mode })

    // 3: persist
    const result = await profileService.updateUIMode(mode)

    if (result.ok) {
      // 4a: replace with server-confirmed version
      setProfile(result.data)
      return null
    } else {
      // 4b: revert
      setProfile(prev)
      return result.error
    }
  }, [profile])

  // ── Action: updateTimezone ────────────────────────────────
  //
  // Same optimistic-update pattern as updateUIMode.
  // The timezone value is validated by the SettingsView before
  // calling this — we do not re-validate the IANA string here.
  const updateTimezone = useCallback(async (tz: string | null): Promise<string | null> => {
    if (!profile) return 'Not authenticated'

    const prev = profile
    setProfile({ ...profile, timezone: tz })

    const result = await profileService.updateTimezone(tz)

    if (result.ok) {
      setProfile(result.data)
      return null
    } else {
      setProfile(prev)
      return result.error
    }
  }, [profile])

  // ── Action: signOut ───────────────────────────────────────
  //
  // We only call supabase.auth.signOut() here. We intentionally
  // do NOT manually call setUser(null) or setProfile(null) —
  // the onAuthStateChange subscription fires SIGNED_OUT immediately
  // after signOut() resolves, which triggers setUser(null), which
  // triggers the profile useEffect above that clears the profile.
  // Manual clearing here would cause a double state update.
  const signOut = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.signOut()
    return error ? error.message : null
  }, [])

  return {
    user,
    profile,
    appLoading,
    setProfile,
    updateUIMode,
    updateTimezone,
    signOut,
  }
}
