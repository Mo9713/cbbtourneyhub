// src/context/LeaderboardContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'

import { useAuthContext }                         from './AuthContext'
import { useTournamentContext }                   from './TournamentContext'
import { useLeaderboard, type LeaderboardState } from '../hooks/useLeaderboard'
import type { Pick, Game, Profile }               from '../types'

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
   * This value does NOT live in context — it does not cause any
   * LeaderboardContext subscriber to re-render when it changes.
   */
  snoopTargetId: string | null
}

export function LeaderboardProvider({ children, snoopTargetId }: LeaderboardProviderProps) {
  const { profile }         = useAuthContext()
  // Note: `selectedTournament` is intentionally NOT destructured here.
  // It was previously bound but never used — a dead reference that
  // caused TournamentContext subscription overhead for no benefit.
  const { tournaments, activeView } = useTournamentContext()

  const lb = useLeaderboard(profile, tournaments)

  // Trigger a data load when the leaderboard tab opens or snoop starts.
  // lb.loadLeaderboard is a stable useCallback — safe in the dep array.
  // activeView and snoopTargetId are primitives — no object-identity risk.
  useEffect(() => {
    if (activeView === 'leaderboard' || snoopTargetId) {
      lb.loadLeaderboard()
    }
  }, [activeView, snoopTargetId, lb.loadLeaderboard])

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

export function useLeaderboardData(): {
  leaderboard: LeaderboardState['leaderboard']
  allPicks:    Pick[]
  allGames:    Game[]
  allProfiles: Profile[]
} {
  const { leaderboard, allPicks, allGames, allProfiles } = useLeaderboardContext()
  return { leaderboard, allPicks, allGames, allProfiles }
}

export function useLeaderboardFilter() {
  const { selectedTournaments, toggleTournament } = useLeaderboardContext()
  return { selectedTournaments, toggleTournament }
}