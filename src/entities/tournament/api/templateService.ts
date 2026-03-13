// src/entities/tournament/api/templateService.ts

import { supabase }                from '../../../shared/infra/supabaseClient'
import type { Game, ServiceResult } from '../../../shared/types'

const BD_REGIONS = ['East', 'West', 'South', 'Midwest', 'Final Four']

// ── Standard (N-team single elimination) ──────────────────────

/**
 * Generates a standard single-elimination bracket for `teamCount` teams.
 * teamCount must be a power of 2 (e.g. 4, 8, 16, 32, 64).
 * Games are created from the highest round down to Round 1,
 * with next_game_id links wired as each layer is inserted.
 */
export async function generateStandardTemplate(
  tournamentId: string,
  teamCount:    number,
): Promise<ServiceResult<true>> {
  const rounds = Math.log2(teamCount)
  if (!Number.isInteger(rounds) || rounds < 1) {
    return { ok: false, error: `teamCount must be a power of 2 (got ${teamCount})` }
  }

  let prevIds: string[] = []

  for (let r = rounds; r >= 1; r--) {
    const count = Math.pow(2, rounds - r)
    const rows = Array.from({ length: count }, (_, i) => ({
      tournament_id: tournamentId,
      round_num:     r,
      team1_name:    r === 1 ? `Team ${i * 2 + 1}` : 'TBD',
      team2_name:    r === 1 ? `Team ${i * 2 + 2}` : 'TBD',
      next_game_id:  prevIds[Math.floor(i / 2)] ?? null,
      sort_order:    i,
    }))
    const { data, error } = await supabase.from('games').insert(rows).select('id')
    if (error || !data) return { ok: false, error: error?.message ?? 'Game insert failed' }
    prevIds = (data as { id: string }[]).map(g => g.id)
  }

  return { ok: true, data: true }
}

// ── Big Dance (NCAA 64-team bracket) ─────────────────────────

export async function generateBigDanceTemplate(
  tournamentId: string,
): Promise<ServiceResult<true>> {
  const regions = BD_REGIONS.slice(0, 4) // East, West, South, Midwest

  // ── Round 6: Championship (1 game) ──────────────────────────
  const { data: champData, error: champErr } = await supabase
    .from('games')
    .insert([{
      tournament_id: tournamentId, round_num: 6,
      team1_name: 'TBD', team2_name: 'TBD',
      region: 'Final Four', sort_order: 0,
    }])
    .select('id')
  if (champErr || !champData) return { ok: false, error: champErr?.message ?? 'Championship insert failed' }
  // FIX N-2: Cast narrowed from `any` to the exact shape returned by select('id').
  const champId = (champData as { id: string }[])[0].id

  // ── Round 5: Final Four (2 games → championship) ─────────────
  const { data: ff, error: ffErr } = await supabase
    .from('games')
    .insert([
      { tournament_id: tournamentId, round_num: 5, team1_name: 'TBD', team2_name: 'TBD', next_game_id: champId, region: 'Final Four', sort_order: 0 },
      { tournament_id: tournamentId, round_num: 5, team1_name: 'TBD', team2_name: 'TBD', next_game_id: champId, region: 'Final Four', sort_order: 1 },
    ])
    .select('id')
  if (ffErr || !ff) return { ok: false, error: ffErr?.message ?? 'Final Four insert failed' }
  const ffIds = (ff as { id: string }[]).map(g => g.id)

  // ── Round 4: Elite 8 (4 games → Final Four) ──────────────────
  const { data: e8, error: e8Err } = await supabase
    .from('games')
    .insert(
      regions.map((region, ri) => ({
        tournament_id: tournamentId, round_num: 4,
        team1_name: 'TBD', team2_name: 'TBD',
        next_game_id: ffIds[Math.floor(ri / 2)],
        region, sort_order: ri,
      }))
    )
    .select('id')
  if (e8Err || !e8) return { ok: false, error: e8Err?.message ?? 'Elite 8 insert failed' }
  const e8Ids = (e8 as { id: string }[]).map(g => g.id)

  // ── Round 3: Sweet 16 (8 games → Elite 8) ────────────────────
  const { data: s16, error: s16Err } = await supabase
    .from('games')
    .insert(
      regions.flatMap((region, ri) =>
        [0, 1].map(j => ({
          tournament_id: tournamentId, round_num: 3,
          team1_name: 'TBD', team2_name: 'TBD',
          next_game_id: e8Ids[ri], region, sort_order: ri * 2 + j,
        }))
      )
    )
    .select('id')
  if (s16Err || !s16) return { ok: false, error: s16Err?.message ?? 'Sweet 16 insert failed' }
  const s16Ids = (s16 as { id: string }[]).map(g => g.id)

  // ── Round 2: Round of 32 (16 games → Sweet 16) ───────────────
  const { data: r32, error: r32Err } = await supabase
    .from('games')
    .insert(
      regions.flatMap((region, ri) =>
        [0, 1, 2, 3].map(j => ({
          tournament_id: tournamentId, round_num: 2,
          team1_name: 'TBD', team2_name: 'TBD',
          next_game_id: s16Ids[ri * 2 + Math.floor(j / 2)],
          region, sort_order: ri * 4 + j,
        }))
      )
    )
    .select('id')
  if (r32Err || !r32) return { ok: false, error: r32Err?.message ?? 'Round of 32 insert failed' }
  const r32Ids = (r32 as { id: string }[]).map(g => g.id)

  // ── Round 1: Round of 64 (32 games → Round of 32) ────────────
  const { error: r64Err } = await supabase
    .from('games')
    .insert(
      regions.flatMap((region, ri) =>
        Array.from({ length: 8 }, (_, j) => ({
          tournament_id: tournamentId, round_num: 1,
          team1_name: 'TBD', team2_name: 'TBD',
          next_game_id: r32Ids[ri * 4 + Math.floor(j / 2)],
          region, sort_order: ri * 8 + j,
        }))
      )
    )
  if (r64Err) return { ok: false, error: r64Err.message }

  return { ok: true, data: true }
}

// ── Slot Label Backfill ───────────────────────────────────────

export async function linkTemplateSlots(
  tournamentId: string,
): Promise<ServiceResult<true>> {
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_num')
    .order('sort_order')

  if (error || !games) return { ok: false, error: error?.message ?? 'Could not load games for slot linking' }
  const typedGames = games as Game[]

  // Build game number map (ordered by round then id for determinism)
  const sorted = [...typedGames].sort((a, b) =>
    a.round_num !== b.round_num ? a.round_num - b.round_num : a.id.localeCompare(b.id)
  )
  const nums: Record<string, number> = {}
  sorted.forEach((g, i) => { nums[g.id] = i + 1 })

  for (const game of typedGames) {
    if (!game.next_game_id) continue

    const feeders = typedGames
      .filter(g => g.next_game_id === game.next_game_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))

    const slot = feeders.findIndex(f => f.id === game.id) === 0
      ? 'team1_name'
      : 'team2_name'

    const { error: slotErr } = await supabase
      .from('games')
      .update({ [slot]: `Winner of Game #${nums[game.id]}` })
      .eq('id', game.next_game_id)

    if (slotErr) return { ok: false, error: slotErr.message }
  }

  return { ok: true, data: true }
}