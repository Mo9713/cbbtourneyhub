// src/shared/infra/authService.ts
//
// Single source of truth for all supabase.auth.* calls.
// No component, hook, or feature-layer file should ever import
// `supabase` directly for auth operations — use this module instead.
//
// All functions return a typed ServiceResult so callers can handle
// errors uniformly without try/catch at the call site.

import { supabase } from './supabaseClient'
import type { User } from '@supabase/supabase-js'
import type { ServiceResult } from '../types'

// Re-export User so consumers get the Supabase type without importing
// directly from the Supabase SDK.
export type { User }

// ── Session ───────────────────────────────────────────────────

/**
 * Returns the currently authenticated Supabase User, or null.
 * Validates the JWT against the Supabase server — not from local storage alone.
 */
export async function getAuthUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

/**
 * Subscribes to auth state changes (sign-in, sign-out, token refresh).
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 *
 * Usage:
 *   useEffect(() => {
 *     return authService.subscribeToAuthChanges((user) => setUser(user))
 *   }, [])
 */
export function subscribeToAuthChanges(
  callback: (user: User | null) => void,
): () => void {
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => sub.subscription.unsubscribe()
}

// ── Sign In ───────────────────────────────────────────────────

/**
 * Authenticates with email + password.
 * Used by AuthForm (initial sign-in) and SettingsView (password re-verify).
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<ServiceResult<User>> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { ok: false, error: error?.message ?? 'Sign in failed.' }
  return { ok: true, data: data.user }
}

// ── Sign Up ───────────────────────────────────────────────────

/**
 * Creates a new Supabase Auth user. Triggers a confirmation email.
 * `displayName` is written to `user_metadata.display_name` and picked
 * up by the DB trigger that creates the `profiles` row.
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<ServiceResult<true>> {
  const trimmed = displayName.trim()
  if (!trimmed) return { ok: false, error: 'Display name is required.' }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: trimmed } },
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

// ── Sign Out ──────────────────────────────────────────────────

/**
 * Signs out the current user and invalidates the local session.
 * Cache cleanup (removing profile/game queries) is the caller's responsibility.
 */
export async function signOut(): Promise<ServiceResult<true>> {
  const { error } = await supabase.auth.signOut()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

// ── Password Management ───────────────────────────────────────

/**
 * Sends a password reset email to the provided address.
 */
export async function resetPasswordForEmail(email: string): Promise<ServiceResult<true>> {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

/**
 * Updates the authenticated user's password.
 * Callers are responsible for re-verifying the current password via
 * `signInWithPassword` before calling this — Supabase does not enforce
 * current-password confirmation on `updateUser`.
 */
export async function updatePassword(newPassword: string): Promise<ServiceResult<true>> {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' }
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}