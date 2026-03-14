// src/features/auth/model/useAuth.ts

import { useState, useEffect, useCallback } from 'react'
import { useQueryClient }                    from '@tanstack/react-query'
import type { User }                         from '@supabase/supabase-js'

import { unwrap }           from '../../../shared/lib/unwrap'
import * as authService     from '../../../shared/infra/authService'
import { fetchProfile }     from '../../../entities/profile/api'
import {
  profileKeys,
  useUpdateUIModeMutation,
  useUpdateTimezoneMutation,
} from '../../../entities/profile/model/queries'
import type { Profile, UIMode } from '../../../shared/types'

// ── Types ─────────────────────────────────────────────────────

export interface AuthState {
  user:           User | null
  profile:        Profile | null
  appLoading:     boolean
  setProfile:     (p: Profile | null) => void
  updateUIMode:   (mode: UIMode)      => Promise<string | null>
  updateTimezone: (tz: string | null) => Promise<string | null>
  signOut:        ()                  => Promise<string | null>
}

// ── Hook ──────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const qc = useQueryClient()

  const [user,           setUser]           = useState<User | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

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

  const profileKey      = profileKeys.me(user?.id)
  const profile         = qc.getQueryData<Profile>(profileKey) ?? null
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (!user) return

    const cached = qc.getQueryData<Profile>(profileKey)
    if (cached) return

    setProfileLoading(true)
    // Explicit `Profile` annotation on the `.then` callback — fixes the
    // `data: any` error that occurred when unwrap.ts failed as a module.
    unwrap(fetchProfile(user.id))
      .then((data: Profile) => qc.setQueryData(profileKey, data))
      .catch(() => { /* appLoading gate handles the failure state */ })
      .finally(() => setProfileLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, qc])

  const appLoading = !sessionChecked || (!!user && profileLoading && !profile)

  const setProfile = useCallback(
    (p: Profile | null) => qc.setQueryData(profileKey, p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, qc],
  )

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

  const signOut = useCallback(async (): Promise<string | null> => {
    const result = await authService.signOut()
    if (result.ok) qc.removeQueries({ queryKey: profileKey })
    return result.ok ? null : result.error
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, qc])

  return { user, profile, appLoading, setProfile, updateUIMode, updateTimezone, signOut }
}