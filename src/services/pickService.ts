// src/services/pickService.ts
// ─────────────────────────────────────────────────────────────
// All read/write operations for the `picks` table, including
// tiebreaker score persistence. Every mutation validates that
// the authenticated user is only writing their OWN picks —
// no admin escalation is needed here, but identity is enforced.
// ─────────────────────────────────────────────────────────────

import { supabase, withAuth } from './supabaseClient'
import type { Pick, ServiceResult } from '../types'

// ── Read ──────────────────────────────────────────────────────

/** Fetch all picks for the current authenticated user (all tournaments). */
export async function fetchMyPicks(): Promise<ServiceResult<Pick[]>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', user.id)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as Pick[] }
  })
}

/** Fetch all picks for a specific set of game IDs (used for leaderboard). */
export async function fetchPicksForGames(gameIds: string[]): Promise<ServiceResult<Pick[]>> {
  if (gameIds.length === 0) return { ok: true, data: [] }

  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .in('game_id', gameIds)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as Pick[] }
}

/** Fetch all picks across all users (admin leaderboard view). */
export async function fetchAllPicks(): Promise<ServiceResult<Pick[]>> {
  const { data, error } = await supabase
    .from('picks')
    .select('*')

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as Pick[] }
}

// ── Write ─────────────────────────────────────────────────────

/**
 * Upsert a pick for the authenticated user.
 * The `user_id` is sourced from the live session — never from
 * a client-supplied prop — preventing impersonation.
 */
export async function savePick(
  gameId: string,
  predictedWinner: string
): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('picks')
      .upsert(
        { user_id: user.id, game_id: gameId, predicted_winner: predictedWinner },
        { onConflict: 'user_id,game_id' }
      )
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Pick save failed' }
    return { ok: true, data: data as Pick }
  })
}

/**
 * Remove the authenticated user's pick for a given game.
 * Only deletes rows belonging to the current session's user.
 */
export async function deletePick(pickId: string): Promise<ServiceResult<true>> {
  return withAuth(async (user) => {
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('id', pickId)
      .eq('user_id', user.id) // Double-bind: row AND session user must match

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

// ── Tie-Breaker ───────────────────────────────────────────────

/**
 * Saves the tiebreaker score for the championship game pick.
 * Uses the same upsert pattern so it merges with an existing pick.
 *
 * Requires that a pick already exist for this game (the predicted_winner
 * is preserved). If none exists yet, the full pick must be saved first
 * via savePick(), then this can be called, OR use savePickWithTiebreaker()
 * for a single atomic operation.
 */
export async function saveTiebreakerScore(
  gameId: string,
  predictedWinner: string,
  tiebreakerScore: number
): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    if (!Number.isInteger(tiebreakerScore) || tiebreakerScore < 0) {
      return { ok: false, error: 'Tiebreaker score must be a non-negative integer.' }
    }

    const { data, error } = await supabase
      .from('picks')
      .upsert(
        {
          user_id:          user.id,
          game_id:          gameId,
          predicted_winner: predictedWinner,
          tiebreaker_score: tiebreakerScore,
        },
        { onConflict: 'user_id,game_id' }
      )
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Tiebreaker save failed' }
    return { ok: true, data: data as Pick }
  })
}

/**
 * Clears the tiebreaker score (sets it back to NULL) without
 * removing the pick itself.
 */
export async function clearTiebreakerScore(pickId: string): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('picks')
      .update({ tiebreaker_score: null })
      .eq('id', pickId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Clear tiebreaker failed' }
    return { ok: true, data: data as Pick }
  })
}