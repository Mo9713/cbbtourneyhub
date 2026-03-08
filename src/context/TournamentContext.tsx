// src/context/TournamentContext.tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuthContext }                       from './AuthContext'
import { useTournaments, type TournamentsState } from '../hooks/useTournaments'
import type { ActiveView, Game, Tournament }      from '../types'

// ── Public context ────────────────────────────────────────────
// loadTournaments and loadGames are intentionally excluded here.
// They are only available via useInternalTournamentLoaders(),
// which is imported exclusively by useRealtimeSync and BracketContext.

type TournamentContextValue = Omit<TournamentsState, 'loadTournaments' | 'loadGames'>

const TournamentContext = createContext<TournamentContextValue | null>(null)

// ── Sync context (internal) ───────────────────────────────────

interface TournamentSyncValue {
  loadTournaments: () => Promise<void>
  loadGames:       (tid: string) => Promise<void>
}

const TournamentSyncContext = createContext<TournamentSyncValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function TournamentProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuthContext()
  const state       = useTournaments(profile)

  const { loadTournaments, loadGames, ...publicState } = state

  const syncValue = useMemo<TournamentSyncValue>(
    () => ({ loadTournaments, loadGames }),
    [loadTournaments, loadGames]
  )

  return (
    <TournamentSyncContext.Provider value={syncValue}>
      <TournamentContext.Provider value={publicState}>
        {children}
      </TournamentContext.Provider>
    </TournamentSyncContext.Provider>
  )
}

// ── Consumer hooks ────────────────────────────────────────────

export function useTournamentContext(): TournamentContextValue {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournamentContext() must be inside <TournamentProvider>')
  return ctx
}

/** Internal — only useRealtimeSync and BracketContext should import this. */
export function useInternalTournamentLoaders(): TournamentSyncValue {
  const ctx = useContext(TournamentSyncContext)
  if (!ctx) throw new Error('useInternalTournamentLoaders() must be inside <TournamentProvider>')
  return ctx
}

/** Focused hook for components that only need the tournament list. */
export function useTournamentList() {
  const { tournaments } = useTournamentContext()
  return { tournaments }
}

/** Focused hook for components that only need navigation. */
export function useTournamentNav() {
  const { selectedTournament, activeView, selectTournament, navigateHome, navigateTo } =
    useTournamentContext()
  return { selectedTournament, activeView, selectTournament, navigateHome, navigateTo }
}