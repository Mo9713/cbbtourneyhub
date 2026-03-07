// src/services/tournamentService.ts
// ─────────────────────────────────────────────────────────────
// All mutations that CREATE, UPDATE, PUBLISH, LOCK, or DELETE
// a tournament. Every write goes through withAdminAuth() — the
// server-side is_admin check — so no client prop can bypass it.
// ─────────────────────────────────────────────────────────────

import { supabase, withAdminAuth } from './supabaseClient'
import type { Tournament, TournamentStatus, ScoringConfig, ServiceResult, TemplateKey } from '../types'
import { generateStandardTemplate, generateBigDanceTemplate, linkTemplateSlots } from './templateService.ts'

// ── Read ──────────────────────────────────────────────────────

/** Fetch all tournaments, ordered by creation date descending. */
export async function fetchTournaments(): Promise<ServiceResult<Tournament[]>> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as Tournament[] }
}

// ── Create ────────────────────────────────────────────────────

export interface CreateTournamentOptions {
  name:       string
  template:   TemplateKey
  teamCount?: number
}

/**
 * Creates a tournament record, then generates the bracket template
 * if one was requested. Returns the new Tournament on success.
 */
export async function createTournament(
  opts: CreateTournamentOptions
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
      const teamCount = opts.teamCount ?? 16
      const genResult = await generateStandardTemplate(t.id, teamCount)
      if (!genResult.ok) return genResult
      const linkResult = await linkTemplateSlots(t.id)
      if (!linkResult.ok) return linkResult
    } else if (opts.template === 'bigdance') {
      const genResult = await generateBigDanceTemplate(t.id)
      if (!genResult.ok) return genResult
      const linkResult = await linkTemplateSlots(t.id)
      if (!linkResult.ok) return linkResult
    }

    return { ok: true, data: t }
  })
}

// ── Update ────────────────────────────────────────────────────

/** Generic field update (name, schedule, round_names, scoring_config, etc.) */
export async function updateTournament(
  id: string,
  updates: Partial<Pick<Tournament,
    | 'name'
    | 'unlocks_at'
    | 'locks_at'
    | 'round_names'
    | 'scoring_config'
    | 'requires_tiebreaker'
  >>
): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Update failed' }
    return { ok: true, data: data as Tournament }
  })
}

/** Set a tournament's status. */
export async function setTournamentStatus(
  id: string,
  status: TournamentStatus
): Promise<ServiceResult<Tournament>> {
  return updateTournament(id, { } as any) // delegate through the full update path
    .then(() => withAdminAuth(async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error || !data) return { ok: false, error: error?.message ?? 'Status update failed' }
      return { ok: true, data: data as Tournament }
    }))
}

/** Publish a draft tournament (status → 'open'). */
export async function publishTournament(id: string): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status: 'open' as TournamentStatus })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Publish failed' }
    return { ok: true, data: data as Tournament }
  })
}

/** Lock a tournament (status → 'locked'). Picks will no longer be accepted. */
export async function lockTournament(id: string): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status: 'locked' as TournamentStatus })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Lock failed' }
    return { ok: true, data: data as Tournament }
  })
}

// ── Scoring Config Helpers ────────────────────────────────────

/** Convenience wrapper: update only the scoring config for a tournament. */
export async function updateScoringConfig(
  id: string,
  config: ScoringConfig | null
): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ scoring_config: config })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Scoring config update failed' }
    return { ok: true, data: data as Tournament }
  })
}

/** Convenience wrapper: update only the round_names array. */
export async function updateRoundNames(
  id: string,
  roundNames: string[]
): Promise<ServiceResult<Tournament>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ round_names: roundNames })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Round names update failed' }
    return { ok: true, data: data as Tournament }
  })
}

// ── Delete ────────────────────────────────────────────────────

/**
 * Permanently deletes a tournament and all associated games/picks.
 * This is a cascading operation — order matters.
 */
export async function deleteTournament(
  tournamentId: string,
  gameIds: string[]
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    if (gameIds.length > 0) {
      const { error: picksErr } = await supabase
        .from('picks')
        .delete()
        .in('game_id', gameIds)
      if (picksErr) return { ok: false, error: picksErr.message }
    }

    const { error: gamesErr } = await supabase
      .from('games')
      .delete()
      .eq('tournament_id', tournamentId)
    if (gamesErr) return { ok: false, error: gamesErr.message }

    const { error: tErr } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournamentId)
    if (tErr) return { ok: false, error: tErr.message }

    return { ok: true, data: true }
  })
}