// src/hooks/useBracket.ts

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

import * as pickService           from '../services/pickService'
import * as gameService           from '../services/gameService'
import { computeGameNumbers,
         collectDownstreamGameIds } from '../utils/bracketMath'
import { isPicksLocked }           from '../utils/time'

import type { Profile, Tournament, Game, Pick } from '../types'

export interface BracketState {
  picks:          Pick[]
  allMyPicks:     Pick[]
  loadPicks:      (tid: string) => Promise<void>
  loadAllMyPicks: () => Promise<void>
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

  // ── Memoized active games ─────────────────────────────────
  // Keyed on selectedTournament?.id (primitive) so this stays
  // stable across SYNC_SELECTED re-syncs that replace the
  // tournament object reference while the ID stays the same.
  const activeGames = useMemo(
    () => selectedTournament ? (gamesCache[selectedTournament.id] ?? []) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTournament?.id, gamesCache]
  )

  // ── Refs ─────────────────────────────────────────────────
  // Updated every render — closures inside useCallback always
  // see the latest values without being in dependency arrays.
  const picksRef              = useRef(picks)
  const activeGamesRef        = useRef(activeGames)
  const selectedTournamentRef = useRef(selectedTournament)
  picksRef.current              = picks
  activeGamesRef.current        = activeGames
  selectedTournamentRef.current = selectedTournament

  // Version counter: each loadPicks call captures the version at
  // start; if it doesn't match on return, the response is stale.
  const loadPicksVersionRef = useRef(0)

  // Mounted guard: prevents setState on unmounted components
  // during sign-out or fast tournament switching.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // ── Loaders ───────────────────────────────────────────────

  const loadPicks = useCallback(async (tid: string) => {
    // Guard 1: skip stale realtime calls for a tournament the user
    // has already navigated away from.
    if (!selectedTournamentRef.current || tid !== selectedTournamentRef.current.id) return

    const version = ++loadPicksVersionRef.current
    const gameIds = activeGamesRef.current.map(g => g.id)
    if (gameIds.length === 0) return

    const result = await pickService.fetchPicksForGames(gameIds)

    // Guard 2: a newer loadPicks call started while we were awaiting.
    if (version !== loadPicksVersionRef.current) return
    // Guard 3: the component unmounted during the await.
    if (!mountedRef.current) return

    if (result.ok && profile) {
      setPicks(result.data.filter(p => p.user_id === profile.id))
    }
  }, [profile])
  // ↑ Note: profile is the only true dep. activeGamesRef and
  //   selectedTournamentRef are read via refs — intentionally
  //   not in the dep array. gamesCache is no longer a dep.

  const loadAllMyPicks = useCallback(async () => {
    if (!profile) return

    const result = await pickService.fetchMyPicks()

    if (!mountedRef.current) return
    if (result.ok) setAllMyPicks(result.data)
  }, [profile])

  // ── Boot: load all-my-picks once on mount ─────────────────
  useEffect(() => {
    if (profile) loadAllMyPicks()
  }, [profile, loadAllMyPicks])

  // ── Reload picks when this tournament's games become available ─
  // Dep is `activeGames` (memoized on this tournament's games only),
  // NOT `gamesCache` (the whole cache). This fires only when the
  // currently-selected tournament's game list actually changes —
  // not when other tournaments' games load during the boot pre-warm.
  useEffect(() => {
    if (!selectedTournament || activeGames.length === 0) return
    loadPicks(selectedTournament.id)
  }, [selectedTournament?.id, activeGames, loadPicks])

  // ── Pick mutations ────────────────────────────────────────

  const makePick = useCallback(async (
    game: Game,
    team: string,
  ): Promise<string | null> => {
    if (!profile || !selectedTournamentRef.current) return 'Not ready'
    if (isPicksLocked(selectedTournamentRef.current, profile.is_admin)) return 'Picks are locked'

    const currentPicks = picksRef.current
    const currentGames = activeGamesRef.current
    const existing     = currentPicks.find(p => p.game_id === game.id)

    const downstreamIds = collectDownstreamGameIds(game, currentGames)
    const downstreamSet = new Set(downstreamIds)

    // ── Toggle off ────────────────────────────────────────
    if (existing?.predicted_winner === team) {
      const [deleteResult, cascadeResult] = await Promise.all([
        pickService.deletePick(existing.id),
        pickService.deletePicksForGames(downstreamIds),
      ])
      if (!deleteResult.ok)  return deleteResult.error
      if (!cascadeResult.ok) return cascadeResult.error

      const removedIds = new Set([existing.id])
      setPicks(prev      => prev.filter(p => !removedIds.has(p.id) && !downstreamSet.has(p.game_id)))
      setAllMyPicks(prev => prev.filter(p => !removedIds.has(p.id) && !downstreamSet.has(p.game_id)))
      return null
    }

    // ── Change or new pick ────────────────────────────────
    // Cascade delete first: if it fails, the DB is still clean.
    if (downstreamIds.length > 0) {
      const cascadeResult = await pickService.deletePicksForGames(downstreamIds)
      if (!cascadeResult.ok) return cascadeResult.error
    }

    const saveResult = await pickService.savePick(game.id, team)
    if (!saveResult.ok) return saveResult.error

    setPicks(prev => [
      ...prev.filter(p => p.game_id !== game.id && !downstreamSet.has(p.game_id)),
      saveResult.data,
    ])
    setAllMyPicks(prev => [
      ...prev.filter(p => p.game_id !== game.id && !downstreamSet.has(p.game_id)),
      saveResult.data,
    ])
    return null
  }, [profile])

  // ── Game mutations (admin) ────────────────────────────────

  const updateGame = useCallback(async (
    id:      string,
    updates: Partial<Game>,
  ): Promise<string | null> => {
    const tid = selectedTournamentRef.current?.id
    if (!tid) return 'No tournament selected'
    const result = await gameService.updateGame(id, updates)
    if (!result.ok) return result.error
    await loadGames(tid)
    return null
  }, [loadGames])

  const setWinner = useCallback(async (
    game:   Game,
    winner: string,
  ): Promise<string | null> => {
    const tid = selectedTournamentRef.current?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(activeGamesRef.current)
    const result   = await gameService.setWinner(game, winner, activeGamesRef.current, gameNums)
    if (!result.ok) return result.error
    await loadGames(tid)
    return null
  }, [loadGames])

  const addGameToRound = useCallback(async (round: number): Promise<string | null> => {
    const t = selectedTournamentRef.current
    if (!t) return 'No tournament selected'
    const sortOrder = (activeGamesRef.current.filter(g => g.round_num === round).length)
    const result    = await gameService.addGameToRound(t.id, round, sortOrder)
    if (!result.ok) return result.error
    await loadGames(t.id)
    return null
  }, [loadGames])

  const addNextRound = useCallback(async (): Promise<string | null> => {
    const t = selectedTournamentRef.current
    if (!t) return 'No tournament selected'
    const games   = activeGamesRef.current
    const maxRound = games.length > 0 ? Math.max(...games.map(g => g.round_num)) : 0
    const result   = await gameService.addGameToRound(t.id, maxRound + 1, 0)
    if (!result.ok) return result.error
    await loadGames(t.id)
    return null
  }, [loadGames])

  const deleteGame = useCallback(async (game: Game): Promise<string | null> => {
    const tid = selectedTournamentRef.current?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(activeGamesRef.current)
    const result   = await gameService.deleteGame(game, activeGamesRef.current, gameNums)
    if (!result.ok) return result.error
    await loadGames(tid)
    return null
  }, [loadGames])

  const linkGames = useCallback(async (
    fromId: string,
    toId:   string,
    slot:   'team1_name' | 'team2_name',
  ): Promise<string | null> => {
    const tid = selectedTournamentRef.current?.id
    if (!tid) return 'No tournament selected'
    const games    = activeGamesRef.current
    const gameNums = computeGameNumbers(games)
    const fromGame = games.find(g => g.id === fromId)
    if (!fromGame) return 'Game not found'
    const result = await gameService.linkGames(fromGame, toId, slot, gameNums[fromId], games, gameNums)
    if (!result.ok) return result.error
    await loadGames(tid)
    return null
  }, [loadGames])

  const unlinkGame = useCallback(async (fromId: string): Promise<string | null> => {
    const tid = selectedTournamentRef.current?.id
    if (!tid) return 'No tournament selected'
    const games    = activeGamesRef.current
    const gameNums = computeGameNumbers(games)
    const fromGame = games.find(g => g.id === fromId)
    if (!fromGame) return 'Game not found'
    const result = await gameService.unlinkGame(fromGame, games, gameNums)
    if (!result.ok) return result.error
    await loadGames(tid)
    return null
  }, [loadGames])

  return {
    picks, allMyPicks,
    loadPicks, loadAllMyPicks,
    makePick, updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
  }
}