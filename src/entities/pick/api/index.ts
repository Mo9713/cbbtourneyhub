// src/entities/pick/api/index.ts
//
// Raw Supabase DB calls for the pick entity.
// No TanStack hooks, no React, no Context. Pure async functions only.
// All operations are scoped to the authenticated user via `withAuth`.

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
  overrideUserId?: string
): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    const targetUserId = overrideUserId || user.id
    const { data, error } = await supabase
      .from('picks')
      .upsert(
        { user_id: targetUserId, game_id: gameId, predicted_winner: predictedWinner },
        { onConflict: 'user_id,game_id' },
      )
      .select()
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Pick save failed.' }
    return { ok: true, data: data as Pick }
  })
}

export async function deletePick(pickId: string, overrideUserId?: string): Promise<ServiceResult<true>> {
  return withAuth(async (user) => {
    const targetUserId = overrideUserId || user.id
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('id', pickId)
      .eq('user_id', targetUserId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

export async function deletePicksForGames(gameIds: string[], overrideUserId?: string): Promise<ServiceResult<true>> {
  if (gameIds.length === 0) return { ok: true, data: true }
  return withAuth(async (user) => {
    const targetUserId = overrideUserId || user.id
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('user_id', targetUserId)
      .in('game_id', gameIds)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

export async function saveTiebreakerScore(
  gameId:          string,
  predictedWinner: string,
  score:           number,
  overrideUserId?: string
): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    const targetUserId = overrideUserId || user.id
    const { data, error } = await supabase
      .from('picks')
      .upsert(
        {
          user_id:          targetUserId,
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

export async function deleteSurvivorPickForRound(
  roundGameIds:  string[],
  overrideUserId?: string
): Promise<ServiceResult<true>> {
  if (roundGameIds.length === 0) return { ok: true, data: true }
  return withAuth(async (user) => {
    const targetUserId = overrideUserId || user.id
    const { error } = await supabase
      .from('picks')
      .delete()
      .eq('user_id', targetUserId)
      .in('game_id', roundGameIds) // ── TARGETED BY EXACT ROUND GAMES, NO ROUND_NUM REQUIRED
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: true }
  })
}

export async function saveSurvivorPick(
  gameId:          string,
  predictedWinner: string,
  roundNum:        number,
  overrideUserId?: string
): Promise<ServiceResult<Pick>> {
  return withAuth(async (user) => {
    const targetUserId = overrideUserId || user.id
    const { data, error } = await supabase
      .from('picks')
      .insert({
        user_id:          targetUserId,
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