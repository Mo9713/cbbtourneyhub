// src/services/profileService.ts
// ─────────────────────────────────────────────────────────────
// Reads and writes the `profiles` table.
// Separated from auth concerns so components can import just
// the data they need without pulling in the full auth client.
// ─────────────────────────────────────────────────────────────

import { supabase, withAuth } from './supabaseClient'
import type { Profile, ThemeKey, ServiceResult } from '../types'

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

/** Update the authenticated user's own profile. */
export async function updateMyProfile(
  updates: Partial<Pick<Profile, 'display_name' | 'theme' | 'avatar_url' | 'favorite_team'>>
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

/** Update display name for the authenticated user. */
export async function updateDisplayName(name: string): Promise<ServiceResult<Profile>> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Display name cannot be empty.' }
  return updateMyProfile({ display_name: trimmed })
}

/** Update theme for the authenticated user. */
export async function updateTheme(theme: ThemeKey): Promise<ServiceResult<Profile>> {
  return updateMyProfile({ theme })
}