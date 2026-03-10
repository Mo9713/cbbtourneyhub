// src/features/bracket/api/gameService.ts
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

export async function setWinner(
  game:        Game,
  winner:      string,
  allGames:    Game[],
  gameNumbers: Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    if (!winner && game.actual_winner && game.next_game_id) {
      const slot = advancingSlotToDbColumn(game, allGames, gameNumbers)
      const { error } = await supabase
        .from('games')
        .update({ [slot]: `Winner of Game #${gameNumbers[game.id]}` })
        .eq('id', game.next_game_id)
      if (error) return { ok: false, error: error.message }
    }

    const { error: winErr } = await supabase
      .from('games')
      .update({ actual_winner: winner || null })
      .eq('id', game.id)
    if (winErr) return { ok: false, error: winErr.message }

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

export async function linkGames(
  fromGame:       Game,
  toGameId:       string,
  slot:           'team1_name' | 'team2_name',
  fromGameNumber: number,
  allGames:       Game[],
  gameNumbers:    Record<string, number>
): Promise<ServiceResult<true>> {
  return withAdminAuth(async () => {
    // 1. If this game is already pointing somewhere else, cleanly sever that old link
    if (fromGame.next_game_id) {
      const unlinkResult = await _unlink(fromGame, allGames, gameNumbers)
      if (!unlinkResult.ok) return unlinkResult
    }

    // 2. Create the new clean link (this safely overwrites whatever bad text was in the slot)
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




