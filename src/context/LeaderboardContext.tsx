// src/context/LeaderboardContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react'

import { useAuthContext }                          from './AuthContext'
import { useTournamentContext }                    from './TournamentContext'
import { useLeaderboard, type LeaderboardState }  from '../hooks/useLeaderboard'

type LeaderboardContextValue = LeaderboardState

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function LeaderboardProvider({ children }: { children: ReactNode }) {
  const { profile }       = useAuthContext()
  const { tournaments, activeView, selectedTournament } = useTournamentContext()

  const lb = useLeaderboard(profile, tournaments)

  // Load leaderboard data when the leaderboard view is opened
  // or when the snoop modal is triggered from any view.
  useEffect(() => {
    if (activeView === 'leaderboard' || lb.snoopTargetId) {
      lb.loadLeaderboard()
    }
  // lb.loadLeaderboard is stable (useCallback); lb.snoopTargetId is a
  // primitive — both are safe dependency values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, lb.snoopTargetId])

  return (
    <LeaderboardContext.Provider value={lb}>
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
export function useLeaderboardData() {
  const { leaderboard, allPicks, allGames, allProfiles } = useLeaderboardContext()
  return { leaderboard, allPicks, allGames, allProfiles }
}

/** Filter state for the admin tournament-scoping checkboxes. */
export function useLeaderboardFilter() {
  const { selectedTournaments, toggleTournament } = useLeaderboardContext()
  return { selectedTournaments, toggleTournament }
}

/** Snoop modal state — which user's bracket is being viewed. */
export function useSnoopTarget() {
  const { snoopTargetId, setSnoopTargetId, allProfiles, allPicks, allGames } = useLeaderboardContext()
  return { snoopTargetId, setSnoopTargetId, allProfiles, allPicks, allGames }
}
