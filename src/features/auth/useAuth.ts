// src/features/auth/useAuth.ts
// ─────────────────────────────────────────────────────────────
// Internal hook that owns the complete auth + profile lifecycle.
//
// Consumed exclusively by AuthContext.tsx — do not import this
// hook directly in components or views. Use useAuthContext()
// from AuthContext.tsx instead.
//
// Responsibilities:
//   1. Supabase session lifecycle  (subscribe, unsubscribe, sign-out)
//   2. Profile hydration           (React Query — replaces manual useEffect)
//   3. Optimistic profile updates  (ui_mode, timezone — via qc.setQueryData)
//   4. appLoading gate             (blocks render until session + profile known)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient }          from '@tanstack/react-query'
import type { User }                         from '@supabase/supabase-js'

import { supabase }        from '../../lib/supabaseClient'
import * as profileService from './profileService'

import type { Profile, UIMode } from '../../shared/types'

// ── Profile query key factory ─────────────────────────────────
//
// Keyed on userId so that switching accounts in the same browser
// session never serves stale data from the previous user's cache.
// Defined here (not in profileService) because this is the only
// consumer — no barrel export needed.
const profileKeys = {
  me: (userId: string | null | undefined) =>
    ['profile', 'me', userId ?? 'guest'] as const,
}

// ── Unwrap helper ─────────────────────────────────────────────

async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}

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
   * Writes directly to the React Query cache — triggers a re-render
   * in all consumers on the next tick.
   */
  setProfile:  (p: Profile | null) => void

  /**
   * Persists a ui_mode change to Supabase and updates local state.
   * Uses an optimistic update: cache updates immediately and reverts
   * if the Supabase call fails.
   *
   * @returns error string on failure, null on success
   */
  updateUIMode: (mode: UIMode) => Promise<string | null>

  /**
   * Persists a timezone preference to Supabase and updates local state.
   * Uses an optimistic update pattern (same as updateUIMode).
   *
   * DISPLAY ONLY — this value must never be passed into isPicksLocked()
   * or any epoch comparison. See src/shared/utils/time.ts for the rule.
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
  const qc = useQueryClient()

  const [user,           setUser]           = useState<User | null>(null)

  // sessionChecked: false until the initial getUser() call resolves.
  // Required to distinguish "app just booted, session unknown" from
  // "checked and no user" — prevents appLoading from resolving to
  // false before we actually know whether a session exists.
  const [sessionChecked, setSessionChecked] = useState(false)

  // ── Session lifecycle ─────────────────────────────────────
  //
  // Strategy: one canonical subscription drives all auth state.
  //
  // We call getUser() once on mount to validate the JWT with the
  // Supabase server (getSession() does NOT re-validate — it accepts
  // a tampered local-storage token). The subscription handles every
  // subsequent event for the lifetime of the app.
  useEffect(() => {
    let cancelled = false

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user ?? null)
        setSessionChecked(true)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, []) // runs once — the subscription covers the full lifetime

  // ── Profile query ─────────────────────────────────────────
  //
  // FIX: The previous implementation used a manual useEffect +
  // profileService.fetchProfile() call to hydrate the profile, managing
  // loading state with a local useState. This had several failure modes:
  //
  //   • On a transient network error, fetchProfile() would silently fail.
  //     appLoading dropped to false but profile stayed null — the user
  //     saw the AuthForm even though they were authenticated, with no
  //     indication of what went wrong and no retry attempt.
  //
  //   • Profile data was invisible to React Query DevTools.
  //
  //   • Optimistic updates in updateUIMode / updateTimezone required
  //     manual snapshot/revert logic against a local useState variable,
  //     rather than using qc.setQueryData against the canonical cache.
  //
  // Now uses useQuery. Benefits:
  //   • Automatic retry (2 attempts) on transient failure.
  //   • Visible in DevTools as ['profile', 'me', userId].
  //   • Optimistic updates are cache writes (qc.setQueryData).
  //   • signOut() calls qc.removeQueries() to evict the entry,
  //     preventing stale data from bleeding into the next login.
  //
  // staleTime: Infinity — profile data only changes when the user
  // explicitly saves in SettingsView. Background refetches would
  // overwrite in-flight optimistic updates.
  const {
    data:      queryProfile,
    isLoading: profileLoading,
  } = useQuery({
    queryKey: profileKeys.me(user?.id),
    queryFn:  () => unwrap(profileService.fetchProfile(user!.id)),
    enabled:  !!user,
    retry:    2,
    staleTime: Infinity,
  })

  const profile = queryProfile ?? null

  // appLoading truth table:
  //   !sessionChecked                         → true  (still doing initial getUser())
  //   sessionChecked && !user                 → false (definitely logged out)
  //   sessionChecked && user && profileLoading → true  (profile fetch in flight)
  //   sessionChecked && user && !profileLoading → false (profile ready or errored)
  //
  // Note: TanStack Query v5 defines `isLoading = isPending && isFetching`.
  // When `enabled: false` (user is null), isFetching is false, so
  // profileLoading is false — no false positive on the logged-out path.
  const appLoading = !sessionChecked || (!!user && profileLoading)

  // ── Action: setProfile ────────────────────────────────────
  //
  // Direct cache write. Used by SettingsView after saving a full
  // profile update (display name, avatar, etc.) so the context
  // reflects the server-confirmed state without a refetch.
  const setProfile = useCallback((p: Profile | null) => {
    qc.setQueryData(profileKeys.me(user?.id), p)
  }, [user?.id, qc])

  // ── Action: updateUIMode ──────────────────────────────────
  //
  // Optimistic update pattern via the query cache:
  //   1. Snapshot the previous cache value.
  //   2. Write the optimistic value immediately (instant UI response).
  //   3. Persist to Supabase.
  //   4a. On success: write the server-confirmed Profile to cache.
  //   4b. On failure: restore the snapshot and return the error.
  const updateUIMode = useCallback(async (mode: UIMode): Promise<string | null> => {
    if (!profile) return 'Not authenticated'

    const key  = profileKeys.me(user?.id)
    const prev = profile
    qc.setQueryData(key, { ...profile, ui_mode: mode })       // optimistic

    const result = await profileService.updateUIMode(mode)

    if (result.ok) {
      qc.setQueryData(key, result.data)                       // server-confirmed
      return null
    } else {
      qc.setQueryData(key, prev)                              // revert
      return result.error
    }
  }, [profile, user?.id, qc])

  // ── Action: updateTimezone ────────────────────────────────
  //
  // Same optimistic-update pattern as updateUIMode.
  // The timezone value is validated by SettingsView before calling
  // this — we do not re-validate the IANA string here.
  const updateTimezone = useCallback(async (tz: string | null): Promise<string | null> => {
    if (!profile) return 'Not authenticated'

    const key  = profileKeys.me(user?.id)
    const prev = profile
    qc.setQueryData(key, { ...profile, timezone: tz })        // optimistic

    const result = await profileService.updateTimezone(tz)

    if (result.ok) {
      qc.setQueryData(key, result.data)                       // server-confirmed
      return null
    } else {
      qc.setQueryData(key, prev)                              // revert
      return result.error
    }
  }, [profile, user?.id, qc])

  // ── Action: signOut ───────────────────────────────────────
  //
  // We only call supabase.auth.signOut() here. We do NOT manually
  // setUser(null) — the onAuthStateChange subscription fires
  // SIGNED_OUT immediately, which triggers setUser(null).
  //
  // We DO evict the profile cache entry on success. This prevents
  // stale profile data from being served if a different user logs
  // into the same browser session (dev scenario, shared computers).
  const signOut = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      qc.removeQueries({ queryKey: profileKeys.me(user?.id) })
    }
    return error ? error.message : null
  }, [user?.id, qc])

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