// src/entities/profile/api/index.ts
//
// Raw Supabase DB calls for the profile entity.
// No TanStack hooks, no React, no Context. Pure async functions only.
// All writes are scoped to the authenticated user via `withAuth`.
// `is_admin` and `id` are never client-writable.

import { supabase, withAuth } from '../../../shared/infra/supabaseClient'
import type { Profile, ThemeKey, UIMode, ServiceResult } from '../../../shared/types'

// ── Reads ─────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<ServiceResult<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Profile not found.' }
  return { ok: true, data: data as Profile }
}

export async function fetchAllProfiles(): Promise<ServiceResult<Profile[]>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as Profile[] }
}

// ── Writes ────────────────────────────────────────────────────

/**
 * Update the authenticated user's own profile.
 *
 * Accepts any subset of the user-editable profile fields.
 * `id` and `is_admin` are intentionally excluded — identity and
 * permissions are never client-writable.
 */
export async function updateMyProfile(
  updates: Partial<Pick<
    Profile,
    | 'display_name'
    | 'theme'
    | 'avatar_url'
    | 'ui_mode'
    | 'timezone'
  >>,
): Promise<ServiceResult<Profile>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Profile update failed.' }
    return { ok: true, data: data as Profile }
  })
}

// ── Typed Field Helpers ───────────────────────────────────────
// One helper per field so call sites are explicit and refactor-safe.
// All delegate to updateMyProfile so auth validation is centralised.

/** Update display name for the authenticated user. */
export async function updateDisplayName(name: string): Promise<ServiceResult<Profile>> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Display name cannot be empty.' }
  return updateMyProfile({ display_name: trimmed })
}

/** Update color theme for the authenticated user. */
export async function updateTheme(theme: ThemeKey): Promise<ServiceResult<Profile>> {
  return updateMyProfile({ theme })
}

/** Update light/dark mode preference for the authenticated user. */
export async function updateUIMode(mode: UIMode): Promise<ServiceResult<Profile>> {
  return updateMyProfile({ ui_mode: mode })
}

/** Update IANA display timezone for the authenticated user. */
export async function updateTimezone(tz: string | null): Promise<ServiceResult<Profile>> {
  return updateMyProfile({ timezone: tz })
}