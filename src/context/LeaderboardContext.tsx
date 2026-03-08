// src/context/LeaderboardContext.tsx
// ─────────────────────────────────────────────────────────────
// Context for leaderboard standings, raw data, and the admin
// tournament filter. Consumed by LeaderboardView and the
// realtime sync hook.
//
// ── snoopTargetId is NOT owned here ──────────────────────────
// It is owned by AppShell as local state and passed down as a
// prop. This prevents snoop open/close events from broadcasting
// a context update to every leaderboard subscriber (the full
// standings table, the filter, etc.).
//
// The prop is still accepted here so LeaderboardProvider can
// trigger loadLeaderboard() when snoop activates from a
// non-leaderboard view.
// ─────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'

import { useAuthContext }                          from './AuthContext'
import { useTournamentContext }                    from './TournamentContext'
import { useLeaderboard, type LeaderboardState }  from '../hooks/useLeaderboard'
import type { Pick, Game, Profile }                from '../types'

type LeaderboardContextValue = LeaderboardState

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

interface LeaderboardProviderProps {
  children:      ReactNode
  /**
   * Owned by AppShell. Passed here so the provider can trigger
   * loadLeaderboard() when the snoop modal opens from any view,
   * not just from the leaderboard tab.
   *
   * This value does NOT live in context — changing it does not
   * cause LeaderboardContext subscribers to re-render.
   */
  snoopTargetId: string | null
}

export function LeaderboardProvider({ children, snoopTargetId }: LeaderboardProviderProps) {
  const { profile }             = useAuthContext()
  const { tournaments, activeView } = useTournamentContext()

  const lb = useLeaderboard(profile, tournaments)

  // Load leaderboard data when the leaderboard tab is opened,
  // or when a snoop session starts from any view.
  useEffect(() => {
    if (activeView === 'leaderboard' || snoopTargetId) {
      lb.loadLeaderboard()
    }
    // lb.loadLeaderboard is a stable useCallback ref.
    // snoopTargetId and activeView are primitives.
  }, [activeView, snoopTargetId, lb.loadLeaderboard])

  // ── Stable context value ──────────────────────────────────
  // leaderboard is already useMemo inside useLeaderboard.
  // allPicks/allGames/allProfiles are state (stable until loaded).
  // selectedTournaments is state; toggleTournament/loadLeaderboard
  // are useCallback. The object literal is the only unstable part.
  const value = useMemo<LeaderboardContextValue>(() => ({
    leaderboard:         lb.leaderboard,
    allPicks:            lb.allPicks,
    allGames:            lb.allGames,
    allProfiles:         lb.allProfiles,
    selectedTournaments: lb.selectedTournaments,
    toggleTournament:    lb.toggleTournament,
    loadLeaderboard:     lb.loadLeaderboard,
  }), [
    lb.leaderboard,
    lb.allPicks,
    lb.allGames,
    lb.allProfiles,
    lb.selectedTournaments,
    lb.toggleTournament,
    lb.loadLeaderboard,
  ])

  return (
    <LeaderboardContext.Provider value={value}>
      {children}
    </LeaderboardContext.Provider>
  )
}

// ── Consumer hooks ────────────────────────────────────────────

export function useLeaderboardContext(): LeaderboardContextValue {
  const ctx = useContext(LeaderboardContext)
  if (!ctx) throw new Error('useLeaderboardContext() must be used inside <LeaderboardProvider>')
  return ctx
}

/** Computed standings + raw data for the leaderboard view. */
export function useLeaderboardData(): {
  leaderboard: LeaderboardState['leaderboard']
  allPicks:    Pick[]
  allGames:    Game[]
  allProfiles: Profile[]
} {
  const { leaderboard, allPicks, allGames, allProfiles } = useLeaderboardContext()
  return { leaderboard, allPicks, allGames, allProfiles }
}

/** Filter state for the admin tournament-scoping checkboxes. */
export function useLeaderboardFilter() {
  const { selectedTournaments, toggleTournament } = useLeaderboardContext()
  return { selectedTournaments, toggleTournament }
}