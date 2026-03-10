// src/features/auth/model/useAuth.ts
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient }          from '@tanstack/react-query'
import type { User }                         from '@supabase/supabase-js'

import { supabase }        from '../../../shared/infra/supabaseClient'
import * as profileService from '../api/profileService'
import type { Profile, UIMode } from '../../../shared/types'

const profileKeys = {
  me: (userId: string | null | undefined) => 
    ['profile', 'me', userId ?? 'guest'] as const,
}

// Helper to handle service results in useQuery
async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}

export interface AuthState {
  user: User | null
  profile: Profile | null
  appLoading: boolean
  setProfile: (p: Profile | null) => void
  updateUIMode: (mode: UIMode) => Promise<string | null>
  updateTimezone: (tz: string | null) => Promise<string | null>
  signOut: () => Promise<string | null>
}

export function useAuth(): AuthState {
  const qc = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  // Session lifecycle: validates JWT on mount and listens for changes
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
  }, [])

  // Profile query with automatic retry and caching
  const { data: queryProfile, isLoading: profileLoading } = useQuery({
    queryKey: profileKeys.me(user?.id),
    queryFn:  () => unwrap(profileService.fetchProfile(user!.id)),
    enabled:  !!user,
    retry:    2,
    staleTime: Infinity,
  })

  const profile = queryProfile ?? null
  const appLoading = !sessionChecked || (!!user && profileLoading)

  const setProfile = useCallback((p: Profile | null) => {
    qc.setQueryData(profileKeys.me(user?.id), p)
  }, [user?.id, qc])

  // Optimistic update for UI mode
  const updateUIMode = useCallback(async (mode: UIMode): Promise<string | null> => {
    if (!profile) return 'Not authenticated'
    const key = profileKeys.me(user?.id)
    const prev = profile
    qc.setQueryData(key, { ...profile, ui_mode: mode }) 

    const result = await profileService.updateUIMode(mode)
    if (result.ok) {
      qc.setQueryData(key, result.data)
      return null
    } else {
      qc.setQueryData(key, prev)
      return result.error
    }
  }, [profile, user?.id, qc])

  // Optimistic update for Timezone
  const updateTimezone = useCallback(async (tz: string | null): Promise<string | null> => {
    if (!profile) return 'Not authenticated'
    const key = profileKeys.me(user?.id)
    const prev = profile
    qc.setQueryData(key, { ...profile, timezone: tz })

    const result = await profileService.updateTimezone(tz)
    if (result.ok) {
      qc.setQueryData(key, result.data)
      return null
    } else {
      qc.setQueryData(key, prev)
      return result.error
    }
  }, [profile, user?.id, qc])

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