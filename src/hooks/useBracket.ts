// src/hooks/useBracket.ts
import { useState, useEffect, useCallback, useRef } from 'react'  // add useRef

import * as pickService  from '../services/pickService'
import * as gameService  from '../services/gameService'
import { computeGameNumbers, collectDownstreamGameIds } from '../utils/bracketMath'  // add collectDownstreamGameIds
import { isPicksLocked } from '../utils/time'

import type { Profile, Tournament, Game, Pick } from '../types'

export interface BracketState {
  /** Picks scoped to the active tournament's games only. */
  picks:          Pick[]
  /** All picks for the current user, across every tournament. Used by Sidebar + HomeView. */
  allMyPicks:     Pick[]

  loadPicks:      (tid: string) => Promise<void>
  loadAllMyPicks: () => Promise<void>

  // ── Pick actions — return error string or null ──────────────
  makePick:            (game: Game, team: string) => Promise<string | null>
  updateGame:          (id: string, updates: Partial<Game>) => Promise<string | null>
  setWinner:           (game: Game, winner: string) => Promise<string | null>
  addGameToRound:      (round: number) => Promise<string | null>
  addNextRound:        () => Promise<string | null>
  deleteGame:          (game: Game) => Promise<string | null>
  linkGames:           (fromId: string, toId: string, slot: 'team1_name' | 'team2_name') => Promise<string | null>
  unlinkGame:          (fromId: string) => Promise<string | null>
}

export function useBracket(
  profile:            Profile | null,
  selectedTournament: Tournament | null,
  gamesCache:         Record<string, Game[]>,
  loadGames:          (tid: string) => Promise<void>,
): BracketState {

  const [picks,      setPicks]      = useState<Pick[]>([])
  const [allMyPicks, setAllMyPicks] = useState<Pick[]>([])

  const activeGames: Game[] = selectedTournament
    ? (gamesCache[selectedTournament.id] ?? [])
    : []

  // ── Stable refs: let makePick read current values without
  //    being in its dependency array. This prevents makePick
  //    from being re-created after every pick action (picks) or
  //    every games cache update (activeGames).
  const picksRef      = useRef(picks)
  const activeGamesRef = useRef(activeGames)
  picksRef.current      = picks
  activeGamesRef.current = activeGames

  // ── Loaders ─────────────────────────────────────────────────

  const loadPicks = useCallback(async (tid: string) => {
    const games = gamesCache[tid] ?? []
    if (games.length === 0) return
    const result = await pickService.fetchPicksForGames(games.map(g => g.id))
    if (result.ok && profile) {
      setPicks(result.data.filter(p => p.user_id === profile.id))
    }
  }, [profile, gamesCache])

  const loadAllMyPicks = useCallback(async () => {
    if (!profile) return
    const result = await pickService.fetchMyPicks()
    if (result.ok) setAllMyPicks(result.data)
  }, [profile])

  // ── Boot: load all-my-picks once on mount ───────────────────
  useEffect(() => {
    if (profile) loadAllMyPicks()
  }, [profile, loadAllMyPicks])

  // ── Load picks only when games cache is warm ─────
  useEffect(() => {
    if (!selectedTournament || activeGames.length === 0) return
    loadPicks(selectedTournament.id)
  }, [selectedTournament?.id, gamesCache, loadPicks])

  // ── Pick mutations ──────────────────────────────────────────

  const makePick = useCallback(async (
    game: Game,
    team: string,
  ): Promise<string | null> => {
    if (!profile || !selectedTournament) return 'Not ready'
    if (isPicksLocked(selectedTournament, profile.is_admin)) return 'Picks are locked'

    // Read fresh values from refs — never stale, never in dep array.
    const currentPicks = picksRef.current
    const currentGames = activeGamesRef.current
    const existing     = currentPicks.find(p => p.game_id === game.id)

    // All downstream game IDs that must be wiped whenever THIS game's pick changes.
    const downstreamIds = collectDownstreamGameIds(game, currentGames)
    const downstreamSet = new Set(downstreamIds)

    // ── TOGGLE OFF: user clicked the same team again ──────────
    if (existing?.predicted_winner === team) {
      // Delete this pick AND cascade-delete all downstream picks
      // in a single batch before touching local state.
      const [deleteResult, cascadeResult] = await Promise.all([
        pickService.deletePick(existing.id),
        pickService.deletePicksForGames(downstreamIds),
      ])
      if (!deleteResult.ok)  return deleteResult.error
      if (!cascadeResult.ok) return cascadeResult.error

      // Remove the toggled pick and all downstream picks from local state.
      const removedIds = new Set([existing.id])
      setPicks(prev      => prev.filter(p => !removedIds.has(p.id) && !downstreamSet.has(p.game_id)))
      setAllMyPicks(prev => prev.filter(p => !removedIds.has(p.id) && !downstreamSet.has(p.game_id)))
      return null
    }

    // ── CHANGE OR NEW PICK ────────────────────────────────────
    // Step 1: Cascade-delete downstream picks FIRST. If this fails,
    // we abort entirely — the DB is still consistent (no new pick written).
    if (downstreamIds.length > 0) {
      const cascadeResult = await pickService.deletePicksForGames(downstreamIds)
      if (!cascadeResult.ok) return cascadeResult.error
    }

    // Step 2: Save the new/changed pick.
    const saveResult = await pickService.savePick(game.id, team)
    if (!saveResult.ok) return saveResult.error

    // Step 3: Update local state atomically.
    // Replace this game's pick and strip all downstream picks in one pass.
    setPicks(prev => [
      ...prev.filter(p => p.game_id !== game.id && !downstreamSet.has(p.game_id)),
      saveResult.data,
    ])
    setAllMyPicks(prev => [
      ...prev.filter(p => p.game_id !== game.id && !downstreamSet.has(p.game_id)),
      saveResult.data,
    ])
    return null

  // profile and selectedTournament are the only true external dependencies now.
  // picks and activeGames are read via refs to break the self-defeating re-creation cycle.
  }, [profile, selectedTournament])

  // ── Game mutations (admin) ───────────────────────────────────

  const updateGame = useCallback(async (
    id: string,
    updates: Partial<Game>,
  ): Promise<string | null> => {
    if (!selectedTournament) return 'No tournament selected'
    const result = await gameService.updateGame(id, updates)
    if (!result.ok) return result.error
    await loadGames(selectedTournament.id)
    return null
  }, [selectedTournament, loadGames])

  const setWinner = useCallback(async (
    game: Game,
    winner: string,
  ): Promise<string | null> => {
    if (!selectedTournament) return 'No tournament selected'
    const gameNumbers = computeGameNumbers(activeGames)
    const result = await gameService.setWinner(game, winner, activeGames, gameNumbers)
    if (!result.ok) return result.error
    await loadGames(selectedTournament.id)
    return null
  }, [selectedTournament, activeGames, loadGames])

  const addGameToRound = useCallback(async (round: number): Promise<string | null> => {
    if (!selectedTournament) return 'No tournament selected'
    const roundGames = activeGames.filter(g => g.round_num === round)
    const maxOrder   = roundGames.length > 0
      ? Math.max(...roundGames.map(g => g.sort_order ?? 0))
      : -1
    const result = await gameService.addGameToRound(selectedTournament.id, round, maxOrder + 1)
    if (!result.ok) return result.error
    await loadGames(selectedTournament.id)
    return null
  }, [selectedTournament, activeGames, loadGames])

  const addNextRound = useCallback(async (): Promise<string | null> => {
    if (!selectedTournament) return 'No tournament selected'
    const nextRound = activeGames.length > 0
      ? Math.max(...activeGames.map(g => g.round_num)) + 1
      : 1
    const result = await gameService.addGameToRound(selectedTournament.id, nextRound, 0)
    if (!result.ok) return result.error
    await loadGames(selectedTournament.id)
    return null
  }, [selectedTournament, activeGames, loadGames])

  const deleteGame = useCallback(async (game: Game): Promise<string | null> => {
    if (!selectedTournament) return 'No tournament selected'
    const gameNumbers = computeGameNumbers(activeGames)
    const result = await gameService.deleteGame(game, activeGames, gameNumbers)
    if (!result.ok) return result.error
    await loadGames(selectedTournament.id)
    return null
  }, [selectedTournament, activeGames, loadGames])

  const linkGames = useCallback(async (
    fromId: string,
    toId:   string,
    slot:   'team1_name' | 'team2_name',
  ): Promise<string | null> => {
    if (!selectedTournament) return 'No tournament selected'
    const fromGame    = activeGames.find(g => g.id === fromId)
    if (!fromGame) return 'Game not found'
    const gameNumbers = computeGameNumbers(activeGames)
    const result = await gameService.linkGames(
      fromGame, toId, slot, gameNumbers[fromId], activeGames, gameNumbers,
    )
    if (!result.ok) return result.error
    await loadGames(selectedTournament.id)
    return null
  }, [selectedTournament, activeGames, loadGames])

  const unlinkGame = useCallback(async (fromId: string): Promise<string | null> => {
    if (!selectedTournament) return 'No tournament selected'
    const fromGame    = activeGames.find(g => g.id === fromId)
    if (!fromGame) return 'Game not found'
    const gameNumbers = computeGameNumbers(activeGames)
    const result = await gameService.unlinkGame(fromGame, activeGames, gameNumbers)
    if (!result.ok) return result.error
    await loadGames(selectedTournament.id)
    return null
  }, [selectedTournament, activeGames, loadGames])

  return {
    picks,
    allMyPicks,
    loadPicks,
    loadAllMyPicks,
    makePick,
    updateGame,
    setWinner,
    addGameToRound,
    addNextRound,
    deleteGame,
    linkGames,
    unlinkGame,
  }
}
