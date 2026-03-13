// src/entities/profile/model/queries.ts
//
// TanStack Query hooks for the profile entity.
//
// ── Key Design ────────────────────────────────────────────────
// `profileKeys` is the single source of truth for profile cache keys.
// The legacy local copy in `src/features/auth/model/useAuth.ts` must
// be deleted and replaced with an import from this file.
//
// ── Mutation Strategy ─────────────────────────────────────────
// `updateUIMode` and `updateTimezone` use optimistic updates with
// structured rollback via `onMutate`/`onError`/`onSettled`. Profile
// data is set to `staleTime: Infinity` — it is managed exclusively via
// mutation writes and never re-fetched in the background.

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import * as profileApi from '../api'
import type { Profile, UIMode } from '../../../shared/types'

// ── Query Keys ────────────────────────────────────────────────
// Exported in full so any slice can invalidate or write to the profile
// cache without duplicating key shapes.

export const profileKeys = {
  /**
   * Profile for a specific user (or 'guest' if unauthenticated).
   * Use `userId` from the Supabase User object.
   */
  me: (userId: string | null | undefined) =>
    ['profile', 'me', userId ?? 'guest'] as const,
} as const

// ── unwrap helper ─────────────────────────────────────────────

async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}

// ── Queries ───────────────────────────────────────────────────

/**
 * Fetches and caches the authenticated user's profile.
 *
 * staleTime is `Infinity` — profile data is managed exclusively via
 * mutation writes (optimistic updates + server confirmation). No
 * background refetch needed.
 */
export function useProfileQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.me(userId),
    queryFn:  () => unwrap(profileApi.fetchProfile(userId!)),
    enabled:  !!userId,
    retry:    2,
    staleTime: Infinity,
  })
}

// ── Mutations ─────────────────────────────────────────────────

/**
 * Updates the current user's display name and/or avatar URL.
 * Invalidates the profile cache on success — full re-fetch since these
 * are not optimistic (they require server confirmation of the new values).
 */
export function useUpdateProfileMutation(userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'theme'>>) =>
      unwrap(profileApi.updateMyProfile(updates)),
    onSuccess: (updatedProfile) => {
      qc.setQueryData(profileKeys.me(userId), updatedProfile)
    },
  })
}

/**
 * Optimistically updates the authenticated user's UI mode (light/dark).
 *
 * Flow:
 *   1. `onMutate` — write new mode to cache immediately (zero-lag UI).
 *   2. `onError`  — roll back to the snapshot captured in `onMutate`.
 *   3. `onSettled`— write confirmed server data to cache (or leave
 *                   optimistic value in place if `onError` ran).
 */
export function useUpdateUIModeMutation(userId: string | null | undefined) {
  const qc = useQueryClient()
  const key = profileKeys.me(userId)

  return useMutation({
    mutationFn: (mode: UIMode) => unwrap(profileApi.updateUIMode(mode)),

    onMutate: async (mode) => {
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueryData<Profile>(key)
      if (snapshot) {
        qc.setQueryData<Profile>(key, { ...snapshot, ui_mode: mode })
      }
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
 * Same optimistic pattern as `useUpdateUIModeMutation`.
 */
export function useUpdateTimezoneMutation(userId: string | null | undefined) {
  const qc = useQueryClient()
  const key = profileKeys.me(userId)

  return useMutation({
    mutationFn: (tz: string | null) => unwrap(profileApi.updateTimezone(tz)),

    onMutate: async (tz) => {
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueryData<Profile>(key)
      if (snapshot) {
        qc.setQueryData<Profile>(key, { ...snapshot, timezone: tz })
      }
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