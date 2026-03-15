// src/entities/tournament/api/index.ts
//
// completeTournament added (this PR) — sets status to 'completed',
// signalling results are final. Distinct from lockTournament ('locked')
// so the UI can show a "Finished" badge and the admin can clearly
// distinguish an in-progress lock from a resolved tournament.
//
// updateTournament's Partial Pick now includes 'status' so the mutation
// layer can drive status transitions generically if needed.

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
  return { ok: true, data: data as Game[] }
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
    if (gameIds.length > 0) {
      const { error } = await supabase.from('picks').delete().in('game_id', gameIds)
      if (error) return { ok: false, error: error.message }
    }

    const { error: gErr } = await supabase
      .from('games').delete().eq('tournament_id', tournamentId)
    if (gErr) return { ok: false, error: gErr.message }

    const { error: tErr } = await supabase
      .from('tournaments').delete().eq('id', tournamentId)
    if (tErr) return { ok: false, error: tErr.message }

    return { ok: true, data: true }
  })
}