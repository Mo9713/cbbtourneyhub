// src/context/BracketContext.tsx
// ─────────────────────────────────────────────────────────────
// Bridges useBracket() into React context so any component in
// the tree can consume picks, game actions, and the active
// games list without prop drilling.
//
// ── Memoization strategy ──────────────────────────────────────
//   • activeGames: useMemo on selectedTournament.id + gamesCache.
//     Using .id (primitive) rather than the object reference means
//     the memo is stable across the realtime SYNC_SELECTED re-syncs
//     that replace the tournament object but keep the same ID.
//   • context value: useMemo with every individual field from the
//     bracket hook listed as a dep. All mutations are useCallback
//     (stable refs); only picks/allMyPicks change on pick events.
//     This ensures consumers only re-render when data they care
//     about actually changes, not when BracketProvider re-renders
//     due to a TournamentContext update.
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { useAuthContext }            from './AuthContext'
import { useTournamentContext }      from './TournamentContext'
import { useBracket, type BracketState } from '../hooks/useBracket'

import type { Game } from '../types'

// ── Context shape ─────────────────────────────────────────────

interface BracketContextValue extends BracketState {
  /** Games for the currently selected tournament, sourced from gamesCache. */
  activeGames: Game[]
}

const BracketContext = createContext<BracketContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function BracketProvider({ children }: { children: ReactNode }) {
  const { profile }                                   = useAuthContext()
  const { selectedTournament, gamesCache, loadGames } = useTournamentContext()

  const bracket = useBracket(profile, selectedTournament, gamesCache, loadGames)

  // ── activeGames ───────────────────────────────────────────
  // Keyed on selectedTournament?.id (primitive) so this stays
  // stable during realtime tournament re-syncs that swap the
  // object reference while keeping the same ID.
  const activeGames = useMemo(
    () => selectedTournament ? (gamesCache[selectedTournament.id] ?? []) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTournament?.id, gamesCache]
  )

  // ── Stable context value ──────────────────────────────────
  // Destructure bracket so we can list each field individually.
  // All mutation callbacks are useCallback in useBracket (stable
  // refs). Only picks and allMyPicks change with pick events.
  const {
    picks, allMyPicks,
    loadPicks, loadAllMyPicks,
    makePick, updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
  } = bracket

  const value = useMemo<BracketContextValue>(() => ({
    picks, allMyPicks,
    loadPicks, loadAllMyPicks,
    makePick, updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
    activeGames,
  }), [
    picks, allMyPicks,
    loadPicks, loadAllMyPicks,
    makePick, updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
    activeGames,
  ])

  return (
    <BracketContext.Provider value={value}>
      {children}
    </BracketContext.Provider>
  )
}

// ── Consumer hooks ────────────────────────────────────────────

export function useBracketContext(): BracketContextValue {
  const ctx = useContext(BracketContext)
  if (!ctx) throw new Error('useBracketContext() must be used inside <BracketProvider>')
  return ctx
}

export function useActivePicks() {
  const { picks, makePick } = useBracketContext()
  return { picks, makePick }
}

export function useAllMyPicks() {
  const { allMyPicks } = useBracketContext()
  return allMyPicks
}

export function useGameMutations() {
  const {
    activeGames,
    updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
  } = useBracketContext()

  return {
    activeGames,
    updateGame, setWinner,
    addGameToRound, addNextRound,
    deleteGame, linkGames, unlinkGame,
  }
}