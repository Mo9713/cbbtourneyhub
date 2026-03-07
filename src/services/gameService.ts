// src/services/gameService.ts
// ─────────────────────────────────────────────────────────────
// All mutations for GAME records: updating team names/metadata,
// setting/clearing winners, advancing winners to next rounds,
// linking/unlinking games, and creating/deleting game records.
//
// NOTE TO FUTURE DEVELOPER:
// This file is intentionally scoped to game mutations only.
// When you wire up a live-score API, this is the ONLY file you
// need to touch. The external API adapter should call:
//   - setWinner()     to record official results
//   - updateGame()    to sync team names / seeds from the feed
//
// Do NOT add tournament-level logic here. See tournamentService.ts.
// ─────────────────────────────────────────────────────────────

import { supabase, withAdminAuth } from './supabaseClient'
import type { Game, ServiceResult } from '../types'

// ── Read ──────────────────────────────────────────────────────

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

// ── Create ────────────────────────────────────────────────────

export async function addGameToRound(
  tournamentId: string,
  round: number,
  sortOrder: number
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

// ── Update ────────────────────────────────────────────────────

/** Generic partial update on a game row (team names, sort_order, etc.). */
export async function updateGame(
  id: string,
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

// ── Set / Clear Winner ────────────────────────────────────────

/**
 * Sets or clears the actual_winner on a game, and propagates the
 * winner's name to the correct slot of the next game.
 *
 * Pass winner = '' to CLEAR a previously set winner (reverts next
 * game slot back to "Winner of Game #N" placeholder text).
 *
 * The `games` array (full tournament game list) is required to
 * resolve feeder order and slot assignment without extra DB reads.
 */
export async function setWinner(
  game: Game,
  winner: string,
  allGames: Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    // Step 1: If clearing a winner that had already advanced, revert the next game's slot.
    if (!winner && game.actual_winner && game.next_game_id) {
      const slot = resolveFeederSlot(game, game.next_game_id, allGames, gameNumbers)
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

    // Step 3: If a winner is set and there is a next game, push the name forward.
    if (winner && game.next_game_id) {
      const slot = resolveFeederSlot(game, game.next_game_id, allGames, gameNumbers)
      const { error } = await supabase
        .from('games')
        .update({ [slot]: winner })
        .eq('id', game.next_game_id)
      if (error) return { ok: false, error: error.message }
    }

    return { ok: true, data: true }
  })
}

/** 
 * Resolves whether this game feeds into slot team1_name or team2_name of the next game.
 * 
 * PRIMARY: Text-match. Checks the next game's slot text against the canonical
 *          "Winner of Game #N" placeholder OR the game's current actual_winner.
 * FALLBACK: Array index order (only used if no text match is found, e.g. brand-new
 *           unlinked bracket where placeholder text hasn't been written yet).
 */
function resolveFeederSlot(
  game: Game,
  nextGameId: string,
  allGames: Game[],
  gameNumbers: Record<string, number>
): 'team1_name' | 'team2_name' {
  const nextGame    = allGames.find(g => g.id === nextGameId)
  const winnerText  = `Winner of Game #${gameNumbers[game.id]}`

  if (nextGame) {
    // Primary: match the placeholder text written when the link was created
    if (nextGame.team1_name === winnerText) return 'team1_name'
    if (nextGame.team2_name === winnerText) return 'team2_name'

    // Secondary: if the winner has already advanced, match the actual winner name
    if (game.actual_winner) {
      if (nextGame.team1_name === game.actual_winner) return 'team1_name'
      if (nextGame.team2_name === game.actual_winner) return 'team2_name'
    }
  }

  // Fallback: sort feeders by sort_order and use index position.
  // Only reached when no text evidence exists (e.g. a freshly linked game
  // before linkTemplateSlots has run, or a corrupted slot).
  const feeders = allGames
    .filter(g => g.next_game_id === nextGameId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
  return feeders.findIndex(f => f.id === game.id) === 0 ? 'team1_name' : 'team2_name'
}

// ── Link / Unlink ─────────────────────────────────────────────

/**
 * Links fromGame → toGame, writing the "Winner of Game #N"
 * placeholder into the correct slot of toGame.
 */
export async function linkGames(
  fromGame: Game,
  toGameId: string,
  slot: 'team1_name' | 'team2_name',
  fromGameNumber: number,
  allGames: Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    // Unlink any existing connection first
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
  fromGame: Game,
  allGames: Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => _unlink(fromGame, allGames, gameNumbers))
}

/** Internal unlink logic (no extra auth wrapper — caller is responsible). */
async function _unlink(
  fromGame: Game,
  allGames: Game[],
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

// ── Delete ────────────────────────────────────────────────────

/**
 * Deletes a game, removing associated picks, clearing feeder links,
 * and reverting any "Winner of Game #N" slots in the next game.
 */
export async function deleteGame(
  game: Game,
  allGames: Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    // Remove picks for this game
    const { error: picksErr } = await supabase
      .from('picks')
      .delete()
      .eq('game_id', game.id)
    if (picksErr) return { ok: false, error: picksErr.message }

    // Clear next_game_id on any games that feed INTO this one
    for (const feeder of allGames.filter(g => g.next_game_id === game.id)) {
      const { error } = await supabase
        .from('games')
        .update({ next_game_id: null })
        .eq('id', feeder.id)
      if (error) return { ok: false, error: error.message }
    }

    // Revert this game's winner placeholder in the game it feeds into
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