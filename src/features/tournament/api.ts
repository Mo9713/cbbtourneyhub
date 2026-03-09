// src/features/tournament/api.ts
// Direct Supabase calls only. No classes, no abstraction layers.
import { supabase, withAdminAuth } from '../../lib/supabaseClient'
import {
  generateStandardTemplate,
  generateBigDanceTemplate,
  linkTemplateSlots,
} from './templateService'
import type {
  Tournament, Game, TournamentStatus,
  ServiceResult, TemplateKey,
} from '../../shared/types'

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
}

export async function createTournament(
  opts: CreateTournamentOptions,
): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name:                opts.name,
        status:              'draft' as TournamentStatus,
        round_names:         [],
        scoring_config:      null,
        requires_tiebreaker: false,
      })
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' }
    const t = data as Tournament

    if (opts.template === 'standard') {
      const gen = await generateStandardTemplate(t.id, opts.teamCount ?? 16)
      if (!gen.ok) return gen
      const link = await linkTemplateSlots(t.id)
      if (!link.ok) return link
    } else if (opts.template === 'bigdance') {
      const gen = await generateBigDanceTemplate(t.id)
      if (!gen.ok) return gen
      const link = await linkTemplateSlots(t.id)
      if (!link.ok) return link
    }

    return { ok: true, data: t }
  })
}

export async function updateTournament(
  id:      string,
  updates: Partial<Pick<Tournament,
    | 'name' | 'unlocks_at' | 'locks_at'
    | 'round_names' | 'scoring_config' | 'requires_tiebreaker'
  >>,
): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments').update(updates).eq('id', id).select().single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Update failed' }
    return { ok: true, data: data as Tournament }
  })
}

export async function publishTournament(id: string): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments').update({ status: 'open' as TournamentStatus }).eq('id', id).select().single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Publish failed' }
    return { ok: true, data: data as Tournament }
  })
}

export async function lockTournament(id: string): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments').update({ status: 'locked' as TournamentStatus }).eq('id', id).select().single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Lock failed' }
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
    const { error: gErr } = await supabase.from('games').delete().eq('tournament_id', tournamentId)
    if (gErr) return { ok: false, error: gErr.message }
    const { error: tErr } = await supabase.from('tournaments').delete().eq('id', tournamentId)
    if (tErr) return { ok: false, error: tErr.message }
    return { ok: true, data: true }
  })
}
