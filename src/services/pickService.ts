// src/services/pickService.ts
import { supabase, withAuth, withAdminAuth } from './supabaseClient'
import type { Pick, ServiceResult } from '../types'

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

/** Fetch all picks for a specific set of game IDs. */
export async function fetchPicksForGames(gameIds: string[]): Promise<ServiceResult<Pick[]>> {
  if (gameIds.length === 0) return { ok: true, data: [] }

  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .in('game_id', gameIds)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as Pick[] }
}

/** Fetch all picks across all users. Admin-only. */
export async function fetchAllPicks(): Promise<ServiceResult<Pick[]>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase.from('picks').select('*')
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as Pick[] }
  })
}

/** Upsert a pick for the authenticated user. */
export async function savePick(
  gameId:          string,
  predictedWinner: string,
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

/** Remove the authenticated user's pick for a given game. */
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

/** Cascade-delete all current user's picks for a set of downstream game IDs. */
export async function deletePicksForGames(gameIds: string[]): Promise<ServiceResult<string[]>> {
  if (gameIds.length === 0) return { ok: true, data: [] }
  return withAuth(async (user) => {
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('user_id', user.id)
      .in('game_id', gameIds)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: gameIds }
  })
}

/** Save or update the tiebreaker score on the championship pick. */
export async function saveTiebreakerScore(
  gameId:           string,
  predictedWinner:  string,
  tiebreakerScore:  number,
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

/** Clear the tiebreaker score (set to NULL) without removing the pick. */
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