// src/hooks/useBracket.ts
import { useState, useEffect, useCallback } from 'react'

import * as pickService  from '../services/pickService'
import * as gameService  from '../services/gameService'
import { computeGameNumbers } from '../utils/bracketMath'
import { isPicksLocked }      from '../utils/time'

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
  /** Live reference to the games cache from TournamentContext. */
  gamesCache:         Record<string, Game[]>,
  loadGames:          (tid: string) => Promise<void>,
): BracketState {

  const [picks,      setPicks]      = useState<Pick[]>([])
  const [allMyPicks, setAllMyPicks] = useState<Pick[]>([])

  // ── Derived: games for the active tournament ────────────────
  // Read directly from gamesCache so this hook doesn't maintain
  // its own parallel copy. BracketView will consume this same slice.
  const activeGames: Game[] = selectedTournament
    ? (gamesCache[selectedTournament.id] ?? [])
    : []

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

    const existing = picks.find(p => p.game_id === game.id)

    // Toggle off if re-picking the same team
    if (existing?.predicted_winner === team) {
      const result = await pickService.deletePick(existing.id)
      if (!result.ok) return result.error
      setPicks(prev      => prev.filter(p => p.id !== existing.id))
      setAllMyPicks(prev => prev.filter(p => p.id !== existing.id))
      return null
    }

    const result = await pickService.savePick(game.id, team)
    if (!result.ok) return result.error

    setPicks(prev      => [...prev.filter(p => p.game_id !== game.id), result.data])
    setAllMyPicks(prev => [...prev.filter(p => p.game_id !== game.id), result.data])
    return null
  }, [profile, selectedTournament, picks])

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
