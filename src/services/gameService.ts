// src/services/gameService.ts
// ─────────────────────────────────────────────────────────────
// All mutations for GAME records.

import { supabase, withAdminAuth } from './supabaseClient'
import { resolveAdvancingSlot }    from '../utils/bracketMath'
import type { Game, ServiceResult } from '../types'

// ─────────────────────────────────────────────────────────────
// § Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Maps resolveAdvancingSlot()'s display-layer return value
 * ('in1' | 'in2') to the database column name for the next game.
 *
 * This thin adapter is the ONLY place the mapping lives.
 * gameService is the only caller that needs DB column names;
 * the display layer uses 'in1'/'in2' throughout.
 */
function advancingSlotToDbColumn(
  game:        Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>
): 'team1_name' | 'team2_name' {
  return resolveAdvancingSlot(game, allGames, gameNumbers) === 'in1'
    ? 'team1_name'
    : 'team2_name'
}

// ─────────────────────────────────────────────────────────────
// § Read
// ─────────────────────────────────────────────────────────────

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

export async function fetchAllGames(): Promise<ServiceResult<Game[]>> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('round_num', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as Game[] }
}

// ─────────────────────────────────────────────────────────────
// § Create
// ─────────────────────────────────────────────────────────────

export async function addGameToRound(
  tournamentId: string,
  round:        number,
  sortOrder:    number
): Promise<ServiceResult<Game>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('games')
      .insert({
        tournament_id: tournamentId,
        round_num:     round,
        team1_name:    'TBD',
        team2_name:    'TBD',
        sort_order:    sortOrder,
      })
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' }
    return { ok: true, data: data as Game }
  })
}

// ─────────────────────────────────────────────────────────────
// § Update
// ─────────────────────────────────────────────────────────────

/** Generic partial update on a game row (team names, sort_order, etc.). */
export async function updateGame(
  id:      string,
  updates: Partial<Pick<Game, 'team1_name' | 'team2_name' | 'sort_order' | 'next_game_id'>>
): Promise<ServiceResult<Game>> {
  return withAdminAuth(async () => {
    const { data, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Update failed' }
    return { ok: true, data: data as Game }
  })
}

// ─────────────────────────────────────────────────────────────
// § Set / Clear Winner
// ─────────────────────────────────────────────────────────────

/**
 * Sets or clears the actual_winner on a game, and propagates the
 * winner's name to the correct slot of the next game.
 *
 * Pass winner = '' to CLEAR (reverts the next game slot back to
 * "Winner of Game #N" placeholder text).
 */
export async function setWinner(
  game:        Game,
  winner:      string,
  allGames:    Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    // Step 1: Clearing a winner that already advanced — revert the next slot.
    if (!winner && game.actual_winner && game.next_game_id) {
      const slot = advancingSlotToDbColumn(game, allGames, gameNumbers)
      const { error } = await supabase
        .from('games')
        .update({ [slot]: `Winner of Game #${gameNumbers[game.id]}` })
        .eq('id', game.next_game_id)
      if (error) return { ok: false, error: error.message }
    }

    // Step 2: Write (or clear) the actual_winner.
    const { error: winErr } = await supabase
      .from('games')
      .update({ actual_winner: winner || null })
      .eq('id', game.id)
    if (winErr) return { ok: false, error: winErr.message }

    // Step 3: If setting a winner with a downstream game, push the name forward.
    if (winner && game.next_game_id) {
      const slot = advancingSlotToDbColumn(game, allGames, gameNumbers)
      const { error } = await supabase
        .from('games')
        .update({ [slot]: winner })
        .eq('id', game.next_game_id)
      if (error) return { ok: false, error: error.message }
    }

    return { ok: true, data: true }
  })
}

// ─────────────────────────────────────────────────────────────
// § Link / Unlink
// ─────────────────────────────────────────────────────────────

/**
 * Links fromGame → toGame, writing the "Winner of Game #N"
 * placeholder into the correct slot of toGame.
 */
export async function linkGames(
  fromGame:       Game,
  toGameId:       string,
  slot:           'team1_name' | 'team2_name',
  fromGameNumber: number,
  allGames:       Game[],
  gameNumbers:    Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    if (fromGame.next_game_id) {
      const unlinkResult = await _unlink(fromGame, allGames, gameNumbers)
      if (!unlinkResult.ok) return unlinkResult
    }

    const { error: e1 } = await supabase
      .from('games')
      .update({ next_game_id: toGameId })
      .eq('id', fromGame.id)
    if (e1) return { ok: false, error: e1.message }

    const { error: e2 } = await supabase
      .from('games')
      .update({ [slot]: `Winner of Game #${fromGameNumber}` })
      .eq('id', toGameId)
    if (e2) return { ok: false, error: e2.message }

    return { ok: true, data: true }
  })
}

/** Removes the link from fromGame, reverting the target slot to 'TBD'. */
export async function unlinkGame(
  fromGame:    Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => _unlink(fromGame, allGames, gameNumbers))
}

async function _unlink(
  fromGame:    Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  if (!fromGame.next_game_id) return { ok: true, data: true }

  const winnerText = `Winner of Game #${gameNumbers[fromGame.id]}`
  const nextGame   = allGames.find(g => g.id === fromGame.next_game_id)

  if (nextGame) {
    let slotToClear: 'team1_name' | 'team2_name' | null = null
    if (nextGame.team1_name === winnerText) slotToClear = 'team1_name'
    else if (nextGame.team2_name === winnerText) slotToClear = 'team2_name'

    if (slotToClear) {
      const { error } = await supabase
        .from('games')
        .update({ [slotToClear]: 'TBD' })
        .eq('id', fromGame.next_game_id)
      if (error) return { ok: false, error: error.message }
    }
  }

  const { error } = await supabase
    .from('games')
    .update({ next_game_id: null })
    .eq('id', fromGame.id)
  if (error) return { ok: false, error: error.message }

  return { ok: true, data: true }
}

// ─────────────────────────────────────────────────────────────
// § Delete
// ─────────────────────────────────────────────────────────────

/**
 * Deletes a game, removing associated picks, clearing feeder links,
 * and reverting any "Winner of Game #N" slots in the next game.
 */
export async function deleteGame(
  game:        Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    const { error: picksErr } = await supabase
      .from('picks')
      .delete()
      .eq('game_id', game.id)
    if (picksErr) return { ok: false, error: picksErr.message }

    for (const feeder of allGames.filter(g => g.next_game_id === game.id)) {
      const { error } = await supabase
        .from('games')
        .update({ next_game_id: null })
        .eq('id', feeder.id)
      if (error) return { ok: false, error: error.message }
    }

    if (game.next_game_id) {
      const winnerText = `Winner of Game #${gameNumbers[game.id]}`
      const nextGame   = allGames.find(g => g.id === game.next_game_id)
      if (nextGame) {
        let slot: 'team1_name' | 'team2_name' | null = null
        if (nextGame.team1_name === winnerText) slot = 'team1_name'
        else if (nextGame.team2_name === winnerText) slot = 'team2_name'
        if (slot) {
          await supabase.from('games').update({ [slot]: 'TBD' }).eq('id', game.next_game_id)
        }
      }
    }

    const { error } = await supabase.from('games').delete().eq('id', game.id)
    if (error) return { ok: false, error: error.message }

    return { ok: true, data: true }
  })
}