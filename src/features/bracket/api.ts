// src/features/bracket/api.ts
import { supabase, withAuth } from '../../services/supabaseClient'
import type { Pick, ServiceResult } from '../../types'

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

// ── Mutations ─────────────────────────────────────────────────

export async function savePick(
  gameId: string,
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
    if (error || !data) return { ok: false, error: error?.message ?? 'Pick save failed' }
    return { ok: true, data: data as Pick }
  })
}

export async function deletePick(pickId: string): Promise<ServiceResult<true>> {
  return withAuth(async (user) => {
    const { error } = await supabase
      .from('picks').delete().eq('id', pickId).eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

export async function deletePicksForGames(gameIds: string[]): Promise<ServiceResult<true>> {
  if (gameIds.length === 0) return { ok: true, data: true }
  return withAuth(async (user) => {
    const { error } = await supabase
      .from('picks').delete().eq('user_id', user.id).in('game_id', gameIds)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

export async function saveTiebreakerScore(
  gameId: string,
  predictedWinner: string,
  score: number,
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
    if (error || !data) return { ok: false, error: error?.message ?? 'Tiebreaker save failed' }
    return { ok: true, data: data as Pick }
  })
}