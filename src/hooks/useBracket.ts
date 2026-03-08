// src/hooks/useBracket.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

import * as pickService           from '../services/pickService'
import * as gameService           from '../services/gameService'
import {
  computeGameNumbers,
  collectDownstreamGameIds,
} from '../utils/bracketMath'
import { isPicksLocked } from '../utils/time'

import type { Profile, Tournament, Game, Pick } from '../types'

// ── Public interface ──────────────────────────────────────────
// allMyPicks raw array is NOT exported; consumers use myPickCounts.
// loadPicks / loadAllMyPicks are NOT exported; they live in BracketSyncContext.

export interface BracketState {
  picks:          Pick[]
  myPickCounts:   Record<string, number>
  saveTiebreaker: (gameId: string, predictedWinner: string, score: number) => Promise<string | null>
  makePick:       (game: Game, team: string) => Promise<string | null>
  updateGame:     (id: string, updates: Partial<Game>) => Promise<string | null>
  setWinner:      (game: Game, winner: string) => Promise<string | null>
  addGameToRound: (round: number) => Promise<string | null>
  addNextRound:   () => Promise<string | null>
  deleteGame:     (game: Game) => Promise<string | null>
  linkGames:      (fromId: string, toId: string, slot: 'team1_name' | 'team2_name') => Promise<string | null>
  unlinkGame:     (fromId: string) => Promise<string | null>
}

// Internal sync fields — returned from hook so BracketContext
// can place them in the sync context only.
export interface BracketSyncFields {
  loadPicks:      (tid: string) => Promise<void>
  loadAllMyPicks: () => Promise<void>
}

export function useBracket(
  profile:            Profile | null,
  selectedTournament: Tournament | null,
  gamesCache:         Record<string, Game[]>,
  loadGames:          (tid: string) => Promise<void>,
  patchGamesCache:    (tid: string, updater: (prev: Game[]) => Game[]) => void,
): BracketState & BracketSyncFields {

  const [picks,      setPicks]      = useState<Pick[]>([])
  const [allMyPicks, setAllMyPicks] = useState<Pick[]>([])

  // ── Memoized active games ─────────────────────────────────

  const activeGames = useMemo(
    () => selectedTournament ? (gamesCache[selectedTournament.id] ?? []) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTournament?.id, gamesCache]
  )

  // ── Refs ─────────────────────────────────────────────────

  const picksRef              = useRef(picks)
  const activeGamesRef        = useRef(activeGames)
  const selectedTournamentRef = useRef(selectedTournament)
  picksRef.current              = picks
  activeGamesRef.current        = activeGames
  selectedTournamentRef.current = selectedTournament

  const loadPicksVersionRef = useRef(0)
  const mountedRef          = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // ── myPickCounts — aggregated per-tournament pick count ───
  // Consumers (Sidebar, HomeView) use this instead of the raw array.

  const myPickCounts = useMemo(() => {
    const gameToTid = new Map<string, string>()
    Object.entries(gamesCache).forEach(([tid, games]) => {
      games.forEach(g => gameToTid.set(g.id, tid))
    })
    const counts: Record<string, number> = {}
    allMyPicks.forEach(p => {
      const tid = gameToTid.get(p.game_id)
      if (tid) counts[tid] = (counts[tid] ?? 0) + 1
    })
    return counts
  }, [allMyPicks, gamesCache])

  // ── Loaders (sync — not part of public BracketState) ─────

  const loadPicks = useCallback(async (tid: string) => {
    if (!selectedTournamentRef.current || tid !== selectedTournamentRef.current.id) return

    const version = ++loadPicksVersionRef.current
    const gameIds = activeGamesRef.current.map(g => g.id)
    if (gameIds.length === 0) return

    const result = await pickService.fetchPicksForGames(gameIds)
    if (version !== loadPicksVersionRef.current) return
    if (!mountedRef.current) return

    if (result.ok && profile) {
      setPicks(result.data.filter(p => p.user_id === profile.id))
    }
  }, [profile])

  const loadAllMyPicks = useCallback(async () => {
    if (!profile) return
    const result = await pickService.fetchMyPicks()
    if (!mountedRef.current) return
    if (result.ok) setAllMyPicks(result.data)
  }, [profile])

  useEffect(() => {
    if (profile) loadAllMyPicks()
  }, [profile, loadAllMyPicks])

  useEffect(() => {
    if (!selectedTournament || activeGames.length === 0) return
    loadPicks(selectedTournament.id)
  }, [selectedTournament?.id, activeGames, loadPicks])

  // ── saveTiebreaker ────────────────────────────────────────
  // Routes through context instead of calling the service directly.

  const saveTiebreaker = useCallback(async (
    gameId:          string,
    predictedWinner: string,
    score:           number,
  ): Promise<string | null> => {
    const result = await pickService.saveTiebreakerScore(gameId, predictedWinner, score)
    if (!result.ok) return result.error
    // Optimistic update — reflect the saved tiebreaker immediately
    setPicks(prev      => prev.map(p => p.game_id === gameId ? result.data : p))
    setAllMyPicks(prev => prev.map(p => p.game_id === gameId ? result.data : p))
    return null
  }, [])

  // ── makePick ──────────────────────────────────────────────

  const makePick = useCallback(async (
    game: Game,
    team: string,
  ): Promise<string | null> => {
    if (!profile || !selectedTournamentRef.current) return 'Not ready'
    if (isPicksLocked(selectedTournamentRef.current, profile.is_admin)) return 'Picks are locked'

    const currentPicks  = picksRef.current
    const currentGames  = activeGamesRef.current
    const existing      = currentPicks.find(p => p.game_id === game.id)
    const downstreamIds = collectDownstreamGameIds(game, currentGames)
    const downstreamSet = new Set(downstreamIds)

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

  // ── Game mutations ────────────────────────────────────────

  const updateGame = useCallback(async (
    id:      string,
    updates: Partial<Game>,
  ): Promise<string | null> => {
    const tid = selectedTournamentRef.current?.id
    if (!tid) return 'No tournament selected'
    const result = await gameService.updateGame(id, updates)
    if (!result.ok) return result.error
    // Optimistic: patch immediately — no loadGames round-trip needed for simple field updates
    patchGamesCache(tid, prev => prev.map(g => g.id === id ? result.data : g))
    return null
  }, [patchGamesCache])

  const setWinner = useCallback(async (
    game:   Game,
    winner: string,
  ): Promise<string | null> => {
    const tid = selectedTournamentRef.current?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(activeGamesRef.current)
    const result   = await gameService.setWinner(game, winner, activeGamesRef.current, gameNums)
    if (!result.ok) return result.error
    // Optimistic: patch this game's actual_winner immediately
    patchGamesCache(tid, prev =>
      prev.map(g => g.id === game.id ? { ...g, actual_winner: winner || null } : g)
    )
    // Full reload for slot propagation (fire-and-forget — UI is already updated)
    loadGames(tid)
    return null
  }, [patchGamesCache, loadGames])

  const addGameToRound = useCallback(async (round: number): Promise<string | null> => {
    const t = selectedTournamentRef.current
    if (!t) return 'No tournament selected'
    const sortOrder = activeGamesRef.current.filter(g => g.round_num === round).length
    const result    = await gameService.addGameToRound(t.id, round, sortOrder)
    if (!result.ok) return result.error
    loadGames(t.id) // structural change — fire-and-forget
    return null
  }, [loadGames])

  const addNextRound = useCallback(async (): Promise<string | null> => {
    const t = selectedTournamentRef.current
    if (!t) return 'No tournament selected'
    const games    = activeGamesRef.current
    const maxRound = games.length > 0 ? Math.max(...games.map(g => g.round_num)) : 0
    const result   = await gameService.addGameToRound(t.id, maxRound + 1, 0)
    if (!result.ok) return result.error
    loadGames(t.id)
    return null
  }, [loadGames])

  const deleteGame = useCallback(async (game: Game): Promise<string | null> => {
    const tid = selectedTournamentRef.current?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(activeGamesRef.current)
    const result   = await gameService.deleteGame(game, activeGamesRef.current, gameNums)
    if (!result.ok) return result.error
    loadGames(tid)
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
    loadGames(tid)
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
    loadGames(tid)
    return null
  }, [loadGames])

  return {
    picks, myPickCounts, saveTiebreaker, makePick,
    updateGame, setWinner, addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
    // Sync fields — picked up by BracketContext into the sync context
    loadPicks, loadAllMyPicks,
  }
}