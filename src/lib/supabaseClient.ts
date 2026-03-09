// src/services/supabaseClient.ts
// ─────────────────────────────────────────────────────────────
// Single source of truth for the Supabase client instance.
// Import `supabase` from here throughout the app — never call
// createClient() directly in a component or view again.
// ─────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { ServiceResult } from '../types'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars.')
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth Helpers ──────────────────────────────────────────────

/**
 * Returns the currently authenticated Supabase User, or null.
 * Use this (not a component prop) to validate identity in services.
 */
export async function getAuthUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

/**
 * Resolves the authenticated user and wraps a mutation in an
 * auth guard. If the user is not logged in, returns an error result
 * immediately. This is the standard pattern for every service mutation.
 *
 * Usage:
 *   return withAuth(async (user) => {
 *     // safe to use `user.id` here
 *   })
 */
export async function withAuth<T>(
  fn: (user: User) => Promise<ServiceResult<T>>
): Promise<ServiceResult<T>> {
  const user = await getAuthUser()
  if (!user) return { ok: false, error: 'Not authenticated. Please log in.' }
  return fn(user)
}

/**
 * Like withAuth, but additionally verifies the caller has the
 * `is_admin` flag set in the `profiles` table via a live DB check.
 * NEVER trust the client-side `profile.is_admin` for mutations.
 */
export async function withAdminAuth<T>(
  fn: (user: User) => Promise<ServiceResult<T>>
): Promise<ServiceResult<T>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (error || !data) return { ok: false, error: 'Could not verify identity.' }
    if (!data.is_admin) return { ok: false, error: 'Forbidden: Admin access required.' }

    return fn(user)
  })
}