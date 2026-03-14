// src/entities/pick/api/index.ts
//
// Raw Supabase DB calls for the pick entity.
// No TanStack hooks, no React, no Context. Pure async functions only.
// All operations are scoped to the authenticated user via `withAuth`.
//
// ── Survivor contract ─────────────────────────────────────────
// The two survivor-specific functions at the bottom replace the
// previous raw supabase calls that lived inside the feature mutation.
// The caller is required to supply `gameIds` derived from cached query
// data (useGames). This eliminates the N+1 DB round-trip that
// previously existed inside useMakeSurvivorPickMutation (finding C-06).

import { supabase, withAuth } from '../../../shared/infra/supabaseClient'
import type { Pick, ServiceResult } from '../../../shared/types'

// ── Reads ─────────────────────────────────────────────────────

export async function fetchMyPicksForTournament(
  gameIds: string[],
): Promise<ServiceResult<Pick[]>> {
  if (gameIds.length === 0) return { ok: true, data: [] }
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('picks')
      .select('*')
      .in('game_id', gameIds)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as Pick[] }
  })
}

export async function fetchAllMyPicks(): Promise<ServiceResult<Pick[]>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as Pick[] }
  })
}

// ── Standard bracket mutations ────────────────────────────────

export async function savePick(
  gameId:          string,
  predictedWinner: string,
): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('picks')
      .upsert(
        { user_id: user.id, game_id: gameId, predicted_winner: predictedWinner },
        { onConflict: 'user_id,game_id' },
      )
      .select()
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Pick save failed.' }
    return { ok: true, data: data as Pick }
  })
}

export async function deletePick(pickId: string): Promise<ServiceResult<true>> {
  return withAuth(async (user) => {
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('id', pickId)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

export async function deletePicksForGames(gameIds: string[]): Promise<ServiceResult<true>> {
  if (gameIds.length === 0) return { ok: true, data: true }
  return withAuth(async (user) => {
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('user_id', user.id)
      .in('game_id', gameIds)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

export async function saveTiebreakerScore(
  gameId:          string,
  predictedWinner: string,
  score:           number,
): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('picks')
      .upsert(
        {
          user_id:          user.id,
          game_id:          gameId,
          predicted_winner: predictedWinner,
          tiebreaker_score: score,
        },
        { onConflict: 'user_id,game_id' },
      )
      .select()
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Tiebreaker save failed.' }
    return { ok: true, data: data as Pick }
  })
}

// ── Survivor-specific mutations ───────────────────────────────

/**
 * Deletes any existing survivor pick for a given round, scoped to the
 * supplied game IDs. Enforces the one-pick-per-round constraint.
 *
 * The caller derives gameIds from cached `useGames()` data, so no DB
 * round-trip to fetch them is needed inside the mutation (fixes C-06).
 */
export async function deleteSurvivorPickForRound(
  roundNum: number,
  gameIds:  string[],
): Promise<ServiceResult<true>> {
  if (gameIds.length === 0) return { ok: true, data: true }
  return withAuth(async (user) => {
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('user_id', user.id)
      .eq('round_num', roundNum)
      .in('game_id', gameIds)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

/**
 * Inserts a new survivor pick with round_num stored on the row.
 * Uses insert (not upsert) because `deleteSurvivorPickForRound` has
 * already cleared any conflicting row for this round before this runs.
 */
export async function saveSurvivorPick(
  gameId:          string,
  predictedWinner: string,
  roundNum:        number,
): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    const { data, error } = await supabase
      .from('picks')
      .insert({
        user_id:          user.id,
        game_id:          gameId,
        predicted_winner: predictedWinner,
        round_num:        roundNum,
      })
      .select()
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Survivor pick save failed.' }
    return { ok: true, data: data as Pick }
  })
}