// src/context/BracketContext.tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { useAuthContext }               from './AuthContext'
import { useTournamentContext,
         useInternalTournamentLoaders } from './TournamentContext'
import { useBracket, type BracketState } from '../hooks/useBracket'

import type { Game } from '../types'

// ── Public context ────────────────────────────────────────────

interface BracketContextValue extends BracketState {
  activeGames: Game[]
}

const BracketContext = createContext<BracketContextValue | null>(null)

// ── Sync context (internal) ───────────────────────────────────

interface BracketSyncValue {
  loadPicks:      (tid: string) => Promise<void>
  loadAllMyPicks: () => Promise<void>
}

const BracketSyncContext = createContext<BracketSyncValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function BracketProvider({ children }: { children: ReactNode }) {
  const { profile }                                          = useAuthContext()
  const { selectedTournament, gamesCache, patchGamesCache }  = useTournamentContext()
  const { loadGames }                                        = useInternalTournamentLoaders()

  const bracket = useBracket(profile, selectedTournament, gamesCache, loadGames, patchGamesCache)

  const activeGames = useMemo(
    () => selectedTournament ? (gamesCache[selectedTournament.id] ?? []) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTournament?.id, gamesCache]
  )

  const { loadPicks, loadAllMyPicks, ...publicBracket } = bracket

  const syncValue = useMemo<BracketSyncValue>(
    () => ({ loadPicks, loadAllMyPicks }),
    [loadPicks, loadAllMyPicks]
  )

  const value = useMemo<BracketContextValue>(() => ({
    ...publicBracket,
    activeGames,
  }), [publicBracket, activeGames])

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

/** Internal — only useRealtimeSync should import this. */
export function useInternalBracketLoaders(): BracketSyncValue {
  const ctx = useContext(BracketSyncContext)
  if (!ctx) throw new Error('useInternalBracketLoaders() must be inside <BracketProvider>')
  return ctx
}

export function useActivePicks() {
  const { picks, makePick } = useBracketContext()
  return { picks, makePick }
}

/** Per-tournament pick count. Replaces the raw allMyPicks array in public API. */
export function useMyPickCounts(): Record<string, number> {
  return useBracketContext().myPickCounts
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