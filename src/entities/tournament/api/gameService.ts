// src/entities/tournament/api/gameService.ts

// Game-graph mutation service — admin-only writes to the games table.
// Read operations (fetchGames, fetchAllGames) live exclusively in
// features/tournament/api/api.ts to avoid duplicate Supabase queries.
import { supabase, withAdminAuth } from '../../../shared/infra/supabaseClient'
import { resolveAdvancingSlot }    from '../../../shared/lib/bracketMath'
import type { Game, ServiceResult } from '../../../shared/types'

function advancingSlotToDbColumn(
  game:        Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>
): 'team1_name' | 'team2_name' {
  return resolveAdvancingSlot(game, allGames, gameNumbers) === 'in1'
    ? 'team1_name'
    : 'team2_name'
}

// Inline helper to prevent Auto-Mirroring generic unpopulated slots
const isGeneric = (name: string | null | undefined) => 
  !name || name === 'TBD' || name === 'BYE' || name.startsWith('Winner of Game')

export async function addGameToRound(
  tournamentId: string,
  round:        number,
  sortOrder:    number,
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

export async function updateGame(
  id:      string,
  updates: Partial<Pick<Game,
    | 'team1_name'  | 'team2_name'
    | 'sort_order'  | 'next_game_id'
    | 'team1_seed'  | 'team2_seed'
    | 'team1_score' | 'team2_score'
  >>,
): Promise<ServiceResult<Game>> {
  return withAdminAuth(async () => {
    // Fetch pre-update state for Auto-Mirror matching
    const { data: existingGame } = await supabase.from('games').select('*').eq('id', id).single()

    const { data, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) return { ok: false, error: error?.message ?? 'Update failed' }

    // AUTO-MIRROR LOGIC for scores and team updates
    if (existingGame) {
      const matchTeam1 = existingGame.team1_name
      const matchTeam2 = existingGame.team2_name
      
      // Only mirror if the game features two real teams (prevents updating all 'TBD' games)
      if (!isGeneric(matchTeam1) && !isGeneric(matchTeam2)) {
         const safeUpdates = { ...updates }
         delete safeUpdates.next_game_id // Never mirror structural links
         delete safeUpdates.sort_order   // Never mirror structural positions
         
         if (Object.keys(safeUpdates).length > 0) {
           await supabase.from('games')
             .update(safeUpdates)
             .eq('team1_name', matchTeam1)
             .eq('team2_name', matchTeam2)
             .eq('round_num', existingGame.round_num)
             .neq('id', id) // Don't update the one we just updated
         }
      }
    }

    return { ok: true, data: data as Game }
  })
}

export async function setWinner(
  game:        Game,
  winner:      string,
  allGames:    Game[],
  gameNumbers: Record<string, number>,
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    
    const slot     = game.next_game_id ? advancingSlotToDbColumn(game, allGames, gameNumbers) : null
    const seedSlot = slot === 'team1_name' ? 'team1_seed' : 'team2_seed'
    
    let winnerSeed: number | null = null
    if (winner === game.team1_name) winnerSeed = game.team1_seed ?? null
    else if (winner === game.team2_name) winnerSeed = game.team2_seed ?? null

    // 1. If we are CLEARING the winner, reset the next game's slot and seed
    if (!winner && game.actual_winner && game.next_game_id && slot && seedSlot) {
      const { error } = await supabase
        .from('games')
        .update({ 
          [slot]: `Winner of Game #${gameNumbers[game.id]}`,
          [seedSlot]: null
        })
        .eq('id', game.next_game_id)
      if (error) return { ok: false, error: error.message }
    }

    // 2. Set the actual winner on the CURRENT game
    const { error: winErr } = await supabase
      .from('games')
      .update({ actual_winner: winner || null })
      .eq('id', game.id)
    if (winErr) return { ok: false, error: winErr.message }

    // 3. If a winner was chosen, push their name AND SEED to the NEXT game
    if (winner && game.next_game_id && slot && seedSlot) {
      const { error } = await supabase
        .from('games')
        .update({ 
          [slot]: winner,
          [seedSlot]: winnerSeed
        })
        .eq('id', game.next_game_id)
      if (error) return { ok: false, error: error.message }
    }

    // 4. AUTO-MIRROR LOGIC
    // Finds equivalent games in other tournaments and automatically advances the winner there too
    if (!isGeneric(game.team1_name) && !isGeneric(game.team2_name)) {
      const { data: mirroredGames } = await supabase
        .from('games')
        .select('id, next_game_id')
        .eq('team1_name', game.team1_name)
        .eq('team2_name', game.team2_name)
        .eq('round_num', game.round_num)
        .neq('id', game.id)

      if (mirroredGames && mirroredGames.length > 0) {
        for (const mGame of mirroredGames) {
          // Set winner on mirrored game
          await supabase.from('games').update({ actual_winner: winner || null }).eq('id', mGame.id)

          // Advance winner to the mirrored next_game_id
          if (mGame.next_game_id && slot && seedSlot) {
            if (!winner) {
              await supabase.from('games').update({ 
                [slot]: 'TBD', 
                [seedSlot]: null 
              }).eq('id', mGame.next_game_id)
            } else {
              await supabase.from('games').update({ 
                [slot]: winner, 
                [seedSlot]: winnerSeed 
              }).eq('id', mGame.next_game_id)
            }
          }
        }
      }
    }

    return { ok: true, data: true }
  })
}

export async function linkGames(
  fromGame:       Game,
  toGameId:       string,
  slot:           'team1_name' | 'team2_name',
  fromGameNumber: number,
  allGames:       Game[],
  gameNumbers:    Record<string, number>,
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

export async function unlinkGame(
  fromGame:    Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>,
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => _unlink(fromGame, allGames, gameNumbers))
}

async function _unlink(
  fromGame:    Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>,
): Promise<ServiceResult<true>> {
  if (!fromGame.next_game_id) return { ok: true, data: true }

  const winnerText = `Winner of Game #${gameNumbers[fromGame.id]}`
  const nextGame   = allGames.find(g => g.id === fromGame.next_game_id)

  if (nextGame) {
    let slotToClear: 'team1_name' | 'team2_name' | null = null
    let seedToClear: 'team1_seed' | 'team2_seed' | null = null

    if (nextGame.team1_name === winnerText || nextGame.team1_name === fromGame.actual_winner) {
      slotToClear = 'team1_name'
      seedToClear = 'team1_seed'
    }
    else if (nextGame.team2_name === winnerText || nextGame.team2_name === fromGame.actual_winner) {
      slotToClear = 'team2_name'
      seedToClear = 'team2_seed'
    }

    if (slotToClear && seedToClear) {
      const { error } = await supabase
        .from('games')
        .update({ 
          [slotToClear]: 'TBD',
          [seedToClear]: null 
        })
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

export async function deleteGame(
  game:        Game,
  allGames:    Game[],
  gameNumbers: Record<string, number>,
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    const { error: picksErr } = await supabase
      .from('picks')
      .delete()
      .eq('game_id', game.id)
    if (picksErr) return { ok: false, error: picksErr.message }

    if (game.next_game_id) {
      const unlinkResult = await _unlink(game, allGames, gameNumbers)
      if (!unlinkResult.ok) return unlinkResult
    }

    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', game.id)
    if (error) return { ok: false, error: error.message }

    return { ok: true, data: true }
  })
}