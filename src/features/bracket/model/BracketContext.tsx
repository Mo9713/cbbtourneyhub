// src/features/bracket/model/BracketContext.tsx

import { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useTournamentContext } from '../../tournament/model/TournamentContext'
import {
  tournamentKeys,
  useGames,
  useAllTournamentGames,
  usePatchGamesCache,
}                              from '../../../entities/tournament/model/queries'
import {
  pickKeys,
  useMyPickCounts as useMyPickCountsQuery,
}                              from './queries'

import * as gameService          from '../api/gameService'
import { computeGameNumbers }    from '../../../shared/lib/bracketMath'
import * as bracketApi           from '../api/picksApi'
import type { Game }             from '../../../shared/types'

// ── Context shapes ────────────────────────────────────────────

interface BracketContextValue {
  activeGames:    Game[]
  saveTiebreaker: (gameId: string, predictedWinner: string, score: number) => Promise<string | null>
  updateGame:     (id: string, updates: Partial<Game>) => Promise<string | null>
  setWinner:      (game: Game, winner: string) => Promise<string | null>
  addGameToRound: (round: number) => Promise<string | null>
  addNextRound:   () => Promise<string | null>
  deleteGame:     (game: Game) => Promise<string | null>
  linkGames:      (fromId: string, toId: string, slot: 'team1_name' | 'team2_name') => Promise<string | null>
  unlinkGame:     (fromId: string) => Promise<string | null>
}

const BracketContext = createContext<BracketContextValue | null>(null)

interface BracketSyncValue {
  loadPicks:      (tid: string) => Promise<void>
  loadAllMyPicks: () => Promise<void>
}

const BracketSyncContext = createContext<BracketSyncValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function BracketProvider({ children }: { children: ReactNode }) {
  const qc                   = useQueryClient()
  const { selectedTournament } = useTournamentContext()

  // On-demand game loading — replaces gamesCache[selectedTournament.id]
  const { data: activeGames = [] } = useGames(selectedTournament?.id ?? null)

  // Entity-layer cache patcher — decouples from TournamentContext internals
  const patchGamesCache = usePatchGamesCache()

  // ── Game mutations ────────────────────────────────────────

  const saveTiebreaker = useCallback(async (
    gameId: string, predictedWinner: string, score: number,
  ): Promise<string | null> => {
    const result = await bracketApi.saveTiebreakerScore(gameId, predictedWinner, score)
    return result.ok ? null : result.error
  }, [])

  const updateGame = useCallback(async (
    id: string, updates: Partial<Game>,
  ): Promise<string | null> => {
    const tid = selectedTournament?.id
    if (!tid) return 'No tournament selected'
    const result = await gameService.updateGame(id, updates)
    if (!result.ok) return result.error
    patchGamesCache(tid, (prev) => prev.map((g) => g.id === id ? { ...g, ...updates } : g))
    return null
  }, [selectedTournament?.id, patchGamesCache])

  const setWinner = useCallback(async (
    game: Game, winner: string,
  ): Promise<string | null> => {
    const tid = selectedTournament?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(activeGames)
    const result   = await gameService.setWinner(game, winner, activeGames, gameNums)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [selectedTournament?.id, activeGames, qc])

  const addGameToRound = useCallback(async (round: number): Promise<string | null> => {
    const tid = selectedTournament?.id
    if (!tid) return 'No tournament selected'
    const result = await gameService.addGameToRound(tid, round, 0)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [selectedTournament?.id, qc])

  const addNextRound = useCallback(async (): Promise<string | null> => {
    const tid = selectedTournament?.id
    if (!tid) return 'No tournament selected'
    const maxRound = activeGames.length ? Math.max(...activeGames.map((g) => g.round_num)) : 0
    const result   = await gameService.addGameToRound(tid, maxRound + 1, 0)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [selectedTournament?.id, activeGames, qc])

  const deleteGame = useCallback(async (game: Game): Promise<string | null> => {
    const tid = selectedTournament?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(activeGames)
    const result   = await gameService.deleteGame(game, activeGames, gameNums)
    if (!result.ok) return result.error
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [selectedTournament?.id, activeGames, qc])

  const linkGames = useCallback(async (
    fromId: string, toId: string, slot: 'team1_name' | 'team2_name',
  ): Promise<string | null> => {
    const tid = selectedTournament?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(activeGames)
    const fromGame = activeGames.find((g) => g.id === fromId)
    if (!fromGame) return 'Game not found'
    patchGamesCache(tid, (prev) => prev.map((g) => {
      if (g.id === fromId) return { ...g, next_game_id: toId }
      if (g.id === toId)   return { ...g, [slot]: `Winner of Game #${gameNums[fromId]}` }
      return g
    }))
    const result = await gameService.linkGames(fromGame, toId, slot, gameNums[fromId], activeGames, gameNums)
    if (!result.ok) {
      void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
      return result.error
    }
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [selectedTournament?.id, activeGames, patchGamesCache, qc])

  const unlinkGame = useCallback(async (fromId: string): Promise<string | null> => {
    const tid = selectedTournament?.id
    if (!tid) return 'No tournament selected'
    const gameNums = computeGameNumbers(activeGames)
    const fromGame = activeGames.find((g) => g.id === fromId)
    if (!fromGame) return 'Game not found'
    patchGamesCache(tid, (prev) => prev.map((g) => g.id === fromId ? { ...g, next_game_id: null } : g))
    const result = await gameService.unlinkGame(fromGame, activeGames, gameNums)
    if (!result.ok) {
      void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
      return result.error
    }
    void qc.invalidateQueries({ queryKey: tournamentKeys.games(tid) })
    return null
  }, [selectedTournament?.id, activeGames, patchGamesCache, qc])

  // ── Sync context ──────────────────────────────────────────
  const syncValue = useMemo<BracketSyncValue>(() => ({
    loadPicks:      (tid) => qc.invalidateQueries({ queryKey: pickKeys.mine(tid) }),
    loadAllMyPicks: ()    => qc.invalidateQueries({ queryKey: pickKeys.allMine() }),
  }), [qc])

  const value = useMemo<BracketContextValue>(() => ({
    activeGames,
    saveTiebreaker,
    updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
  }), [
    activeGames, saveTiebreaker,
    updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
  ])

  return (
    <BracketSyncContext.Provider value={syncValue}>
      <BracketContext.Provider value={value}>
        {children}
      </BracketContext.Provider>
    </BracketSyncContext.Provider>
  )
}

// ── Consumer hooks ────────────────────────────────────────────

export function useBracketContext(): BracketContextValue {
  const ctx = useContext(BracketContext)
  if (!ctx) throw new Error('useBracketContext() must be inside <BracketProvider>')
  return ctx
}

export function useInternalBracketLoaders(): BracketSyncValue {
  const ctx = useContext(BracketSyncContext)
  if (!ctx) throw new Error('useInternalBracketLoaders() must be inside <BracketProvider>')
  return ctx
}

export function useGameMutations() {
  const {
    activeGames, updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
  } = useBracketContext()
  return {
    activeGames, updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
  }
}

/**
 * Returns per-tournament pick counts for the sidebar missing-picks indicator.
 *
 * @deprecated-pattern — uses useAllTournamentGames internally to build the
 * game→tournament map. This fan-out will be eliminated in Phase 2 when
 * TournamentContext is fully dissolved and a leaner selector replaces it.
 * TanStack Query deduplicates these fetches — no additional network requests
 * if the same tournament's games are already in cache.
 */
export function useBracketPickCounts(): Record<string, number> {
  const { tournaments } = useTournamentContext()

  // Build a local games-cache only for the purposes of deriving pick counts.
  // Shares the TanStack cache with BracketProvider's useGames calls.
  const gameQueries = useAllTournamentGames(tournaments)
  const gamesCache  = useMemo(() => {
    const cache: Record<string, Game[]> = {}
    tournaments.forEach((t, i) => {
      const data = gameQueries[i]?.data
      if (data) cache[t.id] = data
    })
    return cache
  }, [tournaments, gameQueries])

  return useMyPickCountsQuery(gamesCache)
}