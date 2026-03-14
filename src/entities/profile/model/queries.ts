// src/entities/profile/model/queries.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { unwrap }      from '../../../shared/lib/unwrap'
import * as profileApi from '../api'
import type { Profile, UIMode } from '../../../shared/types'

// ── Query Keys ────────────────────────────────────────────────

export const profileKeys = {
  me: (userId: string | null | undefined) =>
    ['profile', 'me', userId ?? 'guest'] as const,
} as const

// ── Queries ───────────────────────────────────────────────────

export function useProfileQuery(userId: string | null | undefined) {
  return useQuery<Profile, Error, Profile>({
    queryKey:  profileKeys.me(userId),
    queryFn:   () => unwrap(profileApi.fetchProfile(userId!)),
    enabled:   !!userId,
    retry:     2,
    staleTime: Infinity,
  })
}

// ── Mutations ─────────────────────────────────────────────────

type UpdateProfileVars = Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'theme'>>

export function useUpdateProfileMutation(userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation<Profile, Error, UpdateProfileVars>({
    mutationFn: (updates) => unwrap(profileApi.updateMyProfile(updates)),
    onSuccess: (updatedProfile) => {
      // `updatedProfile` is correctly typed as Profile — cascades to SettingsView
      qc.setQueryData(profileKeys.me(userId), updatedProfile)
    },
  })
}

/**
 * Optimistically updates the authenticated user's UI mode (light/dark).
 */
export function useUpdateUIModeMutation(userId: string | null | undefined) {
  const qc  = useQueryClient()
  const key = profileKeys.me(userId)

  return useMutation<Profile, Error, UIMode, { snapshot: Profile | undefined }>({
    mutationFn: (mode) => unwrap(profileApi.updateUIMode(mode)),

    onMutate: async (mode): Promise<{ snapshot: Profile | undefined }> => {
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueryData<Profile>(key)
      if (snapshot) qc.setQueryData<Profile>(key, { ...snapshot, ui_mode: mode })
      return { snapshot }
    },

    onError: (_err, _mode, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(key, ctx.snapshot)
    },

    onSuccess: (updatedProfile) => {
      qc.setQueryData(key, updatedProfile)
    },
  })
}

/**
 * Optimistically updates the authenticated user's display timezone.
 */
export function useUpdateTimezoneMutation(userId: string | null | undefined) {
  const qc  = useQueryClient()
  const key = profileKeys.me(userId)

  return useMutation<Profile, Error, string | null, { snapshot: Profile | undefined }>({
    mutationFn: (tz) => unwrap(profileApi.updateTimezone(tz)),

    onMutate: async (tz): Promise<{ snapshot: Profile | undefined }> => {
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueryData<Profile>(key)
      if (snapshot) qc.setQueryData<Profile>(key, { ...snapshot, timezone: tz })
      return { snapshot }
    },

    onError: (_err, _tz, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(key, ctx.snapshot)
    },

    onSuccess: (updatedProfile) => {
      qc.setQueryData(key, updatedProfile)
    },
  })
}