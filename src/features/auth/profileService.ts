// src/services/profileService.ts
// ─────────────────────────────────────────────────────────────
// Reads and writes the `profiles` table.
// Separated from auth concerns so components can import just
// the data they need without pulling in the full auth client.
//
// CHANGELOG (Phase 2 refactor):
//   - updateMyProfile now accepts ui_mode and timezone fields
//     so AuthContext actions can persist them without bypassing
//     the service layer.
//   - Added updateUIMode() and updateTimezone() typed helpers.
//   - updateDisplayName, updateTheme retained for call-site compat.
// ─────────────────────────────────────────────────────────────

import { supabase, withAuth } from './supabaseClient'
import type { Profile, ThemeKey, UIMode, ServiceResult } from '../types'

// ── Read ──────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<ServiceResult<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Profile not found' }
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

// ── Update ────────────────────────────────────────────────────

/**
 * Update the authenticated user's own profile.
 *
 * Accepts any subset of the user-editable profile fields.
 * The `id` and `is_admin` fields are intentionally excluded —
 * identity and permissions are never client-writable.
 */
export async function updateMyProfile(
  updates: Partial<Pick<
    Profile,
    | 'display_name'
    | 'theme'
    | 'avatar_url'
    | 'favorite_team'
    | 'ui_mode'       // ← NEW: light/dark mode preference
    | 'timezone'      // ← NEW: IANA display timezone (UI-only, never used in lock math)
  >>
): Promise<ServiceResult<Profile>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Profile update failed' }
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

/**
 * Update UI mode (light/dark) for the authenticated user.
 *
 * AuthContext calls this and optimistically updates local state
 * before the async call resolves, reverting on failure.
 */
export async function updateUIMode(mode: UIMode): Promise<ServiceResult<Profile>> {
  return updateMyProfile({ ui_mode: mode })
}

/**
 * Update the display timezone preference for the authenticated user.
 *
 * ⚠️  DISPLAY ONLY — this IANA string is never passed into lock/unlock
 *     math (isPicksLocked, msUntilLock, etc.). It only controls how
 *     timestamps are formatted in the UI.
 *
 * Pass null to reset to the app default (America/Chicago).
 */
export async function updateTimezone(tz: string | null): Promise<ServiceResult<Profile>> {
  return updateMyProfile({ timezone: tz })
}
