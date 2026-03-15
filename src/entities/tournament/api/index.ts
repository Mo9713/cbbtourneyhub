// src/entities/tournament/api/index.ts
//
// completeTournament added — sets status to 'completed', signalling results
// are final. Distinct from lockTournament ('locked') so the UI can show a
// "Finished" badge and the admin can clearly distinguish an in-progress lock
// from a resolved tournament.
//
// updateTournament's Partial Pick includes 'status' so the mutation layer
// can drive status transitions generically if needed.
//
// FIX (Faulty Seed Arithmetic): fetchGames now coerces team1_seed and
// team2_seed to integers at the data boundary using parseInt. If the
// database stores a legacy string-based seed like "11a" (First Four play-in
// notation), parseInt("11a", 10) returns 11 rather than propagating NaN
// into all downstream arithmetic (seed scores, leaderboard, bracket display).
// Seeds that cannot be parsed to a valid number are coerced to null.

import { supabase, withAdminAuth } from '../../../shared/infra/supabaseClient'
import {
  generateStandardTemplate,
  generateBigDanceTemplate,
  linkTemplateSlots,
} from './templateService'
import type {
  Tournament,
  Game,
  TournamentStatus,
  ServiceResult,
  TemplateKey,
} from '../../../shared/types'

// ── Reads ─────────────────────────────────────────────────────

export async function fetchTournaments(): Promise<ServiceResult<Tournament[]>> {
  const { data, error } = await supabase.from('tournaments').select('*')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as Tournament[] }
}

export async function fetchGames(tournamentId: string): Promise<ServiceResult<Game[]>> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_num', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) return { ok: false, error: error.message }

  // FIX (Faulty Seed Arithmetic): Coerce seed values to integers at the data
  // boundary. parseInt handles both numeric columns (DB returns number → String()
  // is a no-op) and legacy string seeds like "11a" (First Four) returning 11.
  // Values that fail to parse (NaN) are normalised to null so no downstream
  // arithmetic receives NaN and no string concatenation can occur.
  const games = (data as Game[]).map(g => ({
    ...g,
    team1_seed: g.team1_seed != null
      ? (parseInt(String(g.team1_seed), 10) || null)
      : null,
    team2_seed: g.team2_seed != null
      ? (parseInt(String(g.team2_seed), 10) || null)
      : null,
  }))

  return { ok: true, data: games }
}

// ── Mutations ─────────────────────────────────────────────────

export interface CreateTournamentOptions {
  name:       string
  template:   TemplateKey
  teamCount?: number
  group_id?:  string | null
  game_type?: 'bracket' | 'survivor'
  teamsData?: any[]
}

export async function createTournament(
  opts: CreateTournamentOptions,
): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name:                      opts.name,
        status:                    'draft' as TournamentStatus,
        round_names:               [],
        scoring_config:            null,
        requires_tiebreaker:       false,
        group_id:                  opts.group_id ?? null,
        game_type:                 opts.game_type ?? 'bracket',
        survivor_elimination_rule: 'end_early',
      })
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed.' }
    const t = data as Tournament

    if (opts.template === 'standard') {
      const gen = await generateStandardTemplate(t.id, opts.teamCount ?? 16)
      if (!gen.ok) return gen
      const link = await linkTemplateSlots(t.id)
      if (!link.ok) return link
    } else if (opts.template === 'bigdance') {
      const gen = await generateBigDanceTemplate(t.id, opts.teamsData)
      if (!gen.ok) return gen
      const link = await linkTemplateSlots(t.id)
      if (!link.ok) return link
    }

    return { ok: true, data: t }
  })
}

/**
 * updateTournament — accepts any editable subset of Tournament fields.
 * 'status' is included so callers can drive generic status transitions.
 */
export async function updateTournament(
  id:      string,
  updates: Partial<Pick<Tournament,
    | 'name'
    | 'status'
    | 'unlocks_at'
    | 'locks_at'
    | 'round_names'
    | 'scoring_config'
    | 'requires_tiebreaker'
    | 'survivor_elimination_rule'
    | 'round_locks'
    | 'show_game_numbers'
  >>,
): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Update failed.' }
    return { ok: true, data: data as Tournament }
  })
}

export async function publishTournament(id: string): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status: 'open' as TournamentStatus })
      .eq('id', id)
      .select()
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Publish failed.' }
    return { ok: true, data: data as Tournament }
  })
}

export async function lockTournament(id: string): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status: 'locked' as TournamentStatus })
      .eq('id', id)
      .select()
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Lock failed.' }
    return { ok: true, data: data as Tournament }
  })
}

/**
 * completeTournament — marks a tournament as fully resolved.
 * Distinct from 'locked': signals results are final and renders a
 * "Finished" badge in the UI rather than the generic "Locked" state.
 */
export async function completeTournament(id: string): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status: 'completed' as TournamentStatus })
      .eq('id', id)
      .select()
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Complete failed.' }
    return { ok: true, data: data as Tournament }
  })
}

export async function deleteTournament(
  tournamentId: string,
  gameIds:      string[],
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    
    // 1. Delete associated picks
    if (gameIds.length > 0) {
      const { error } = await supabase.from('picks').delete().in('game_id', gameIds)
      if (error) return { ok: false, error: error.message }
    }

    // 2. Delete associated games
    const { error: gErr } = await supabase
      .from('games').delete().eq('tournament_id', tournamentId)
    if (gErr) return { ok: false, error: gErr.message }

    // 3. Attempt to delete orphaned teams safely
    // Since the teams table acts as a global registry and may not have a tournament_id,
    // this will fail gracefully without blocking the tournament deletion.
    const { error: teamErr } = await supabase
      .from('teams').delete().eq('tournament_id', tournamentId)
    
    if (teamErr) {
      console.warn('Skipping team deletion (teams table is likely global or missing tournament_id):', teamErr.message)
    }

    // 4. Finally, delete the tournament
    const { error: tErr } = await supabase
      .from('tournaments').delete().eq('id', tournamentId)
    if (tErr) return { ok: false, error: tErr.message }

    return { ok: true, data: true }
  })
}