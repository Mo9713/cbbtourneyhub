// src/features/auth/model/useAuth.ts
//
// Session lifecycle + profile state hook.

import { useState, useEffect, useCallback } from 'react'
import { useQueryClient }                    from '@tanstack/react-query'
import type { User }                         from '@supabase/supabase-js'

import * as authService from '../../../shared/infra/authService'
import { fetchProfile } from '../../../entities/profile/api'
import {
  profileKeys,
  useUpdateUIModeMutation,
  useUpdateTimezoneMutation,
} from '../../../entities/profile/model/queries'
import type { Profile, UIMode } from '../../../shared/types'

// ── unwrap helper ─────────────────────────────────────────────

async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}

// ── Types ─────────────────────────────────────────────────────

export interface AuthState {
  user:            User | null
  profile:         Profile | null
  appLoading:      boolean
  setProfile:      (p: Profile | null) => void
  updateUIMode:    (mode: UIMode)      => Promise<string | null>
  updateTimezone:  (tz: string | null) => Promise<string | null>
  signOut:         ()                  => Promise<string | null>
}

// ── Hook ──────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const qc = useQueryClient()

  const [user,           setUser]           = useState<User | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  // ── Session lifecycle ─────────────────────────────────────
  // Validates the JWT on mount; listens for auth state changes.
  // Both operations are now routed through authService — no raw
  // supabase.auth.* access in this file.
  useEffect(() => {
    let cancelled = false

    authService.getAuthUser().then((u) => {
      if (!cancelled) {
        setUser(u)
        setSessionChecked(true)
      }
    })

    const unsubscribe = authService.subscribeToAuthChanges((u) => {
      if (!cancelled) setUser(u)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  // ── Profile query ─────────────────────────────────────────
  // Uses the entity-layer profileKeys for cache key consistency.
  // staleTime: Infinity — profile is managed exclusively via
  // optimistic mutation writes; never re-fetched in background.
  const profileKey     = profileKeys.me(user?.id)
  const profile        = qc.getQueryData<Profile>(profileKey) ?? null
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (!user) return

    const cached = qc.getQueryData<Profile>(profileKey)
    if (cached) return

    setProfileLoading(true)
    unwrap(fetchProfile(user.id))
      .then((data) => qc.setQueryData(profileKey, data))
      .catch(() => {/* handled by appLoading gate */})
      .finally(() => setProfileLoading(false))
    // profileKey is derived from user.id — stable for the session lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, qc])

  const appLoading = !sessionChecked || (!!user && profileLoading && !profile)

  // ── setProfile ────────────────────────────────────────────
  // Direct cache write — used by AuthContext and SettingsView
  // when the parent already has the new Profile shape in hand.
  const setProfile = useCallback(
    (p: Profile | null) => qc.setQueryData(profileKey, p),
    // profileKey changes only when user.id changes (i.e. sign-out/in)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, qc],
  )

  // ── Mutation hooks ────────────────────────────────────────
  // Structured optimistic mutations from the entity layer replace
  // the previous manual useCallback + setQueryData + rollback pattern.
  const updateUIModeM   = useUpdateUIModeMutation(user?.id)
  const updateTimezoneM = useUpdateTimezoneMutation(user?.id)

  const updateUIMode = useCallback(
    async (mode: UIMode): Promise<string | null> => {
      try {
        await updateUIModeM.mutateAsync(mode)
        return null
      } catch (err) {
        return err instanceof Error ? err.message : 'Failed to update UI mode.'
      }
    },
    [updateUIModeM],
  )

  const updateTimezone = useCallback(
    async (tz: string | null): Promise<string | null> => {
      try {
        await updateTimezoneM.mutateAsync(tz)
        return null
      } catch (err) {
        return err instanceof Error ? err.message : 'Failed to update timezone.'
      }
    },
    [updateTimezoneM],
  )

  // ── Sign Out ──────────────────────────────────────────────
  const signOut = useCallback(async (): Promise<string | null> => {
    const result = await authService.signOut()
    if (result.ok) {
      qc.removeQueries({ queryKey: profileKey })
    }
    return result.ok ? null : result.error
    // eslint-disable-next-line react-hooks/exhaustive-deps
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