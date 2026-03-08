// src/context/BracketContext.tsx
import { createContext, useContext, type ReactNode } from 'react'

import { useAuthContext }           from './AuthContext'
import { useTournamentContext }     from './TournamentContext'
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
  const { profile }                                  = useAuthContext()
  const { selectedTournament, gamesCache, loadGames } = useTournamentContext()

  const bracket = useBracket(profile, selectedTournament, gamesCache, loadGames)

  const activeGames: Game[] = selectedTournament
    ? (gamesCache[selectedTournament.id] ?? [])
    : []

  return (
    <BracketContext.Provider value={{ ...bracket, activeGames }}>
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

/** Picks scoped to the active tournament only. */
export function useActivePicks() {
  const { picks, makePick } = useBracketContext()
  return { picks, makePick }
}

/** All picks for the current user across all tournaments. */
export function useAllMyPicks() {
  const { allMyPicks } = useBracketContext()
  return allMyPicks
}

/** Admin game-mutation actions for the active tournament. */
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
