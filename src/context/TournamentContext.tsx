// src/context/TournamentContext.tsx
// ─────────────────────────────────────────────────────────────
// Context for tournament list data, navigation state, game
// cache, and tournament-level mutations.
//
// Provider tree position: SECOND — inside <AuthProvider>,
// outside <BracketProvider>.
//
//   <AuthProvider>
//     <TournamentProvider>        ← this file
//       <BracketProvider>
//         <AppShell />            ← AppShell owns LeaderboardProvider
//       </BracketProvider>
//     </TournamentProvider>
//   </AuthProvider>
//
// ── What this context owns ────────────────────────────────────
//   • Tournament list (all statuses)
//   • Selected tournament + active view (via nav reducer)
//   • Games cache (all tournaments, pre-warmed on boot)
//   • Tournament-level mutations: create, publish, lock, rename,
//     update, delete
//   • loadTournaments + loadGames (for realtime hook)
//
// ── What this context does NOT own ───────────────────────────
//   • Layout UI toggles (sidebarOpen, mobileMenuOpen,
//     showAddTournament) → useLayoutState() in App.tsx
//   • Picks for the active tournament  → BracketContext
//   • Game mutations (set winner, link, etc.) → BracketContext
//   • Leaderboard data and filter state → LeaderboardContext
//   • Snoop modal state (snoopTargetId) → AppShell local state
//   • User profile / auth               → AuthContext
// ─────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'

import { useAuthContext }                        from './AuthContext'
import { useTournaments, type TournamentsState } from '../hooks/useTournaments'
import type { ActiveView, Game, Tournament }      from '../types'

type TournamentContextValue = TournamentsState

const TournamentContext = createContext<TournamentContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function TournamentProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuthContext()

  // useTournaments returns a useMemo-wrapped object — its reference
  // only changes when actual tournament/navigation data changes.
  // No extra useMemo wrapper is needed in this Provider.
  const state = useTournaments(profile)

  return (
    <TournamentContext.Provider value={state}>
      {children}
    </TournamentContext.Provider>
  )
}

// ── Primary consumer hook ─────────────────────────────────────

export function useTournamentContext(): TournamentContextValue {
  const ctx = useContext(TournamentContext)
  if (!ctx) {
    throw new Error(
      'useTournamentContext() was called outside of <TournamentProvider>.\n' +
      'Ensure the provider order in main.tsx is:\n' +
      '  <AuthProvider>\n' +
      '    <TournamentProvider>\n' +
      '      ...\n' +
      '    </TournamentProvider>\n' +
      '  </AuthProvider>'
    )
  }
  return ctx
}

// ── Focused selector hooks ────────────────────────────────────
//
// Each calls useTournamentContext() internally and subscribes to
// the same single context. They exist as named contracts that
// document which slice of state each consumer actually needs.

export function useSelectedTournament(): {
  tournament:       Tournament | null
  selectTournament: (t: Tournament) => void
  navigateHome:     () => void
} {
  const { selectedTournament, selectTournament, navigateHome } = useTournamentContext()
  return { tournament: selectedTournament, selectTournament, navigateHome }
}

export function useActiveView(): {
  activeView:       ActiveView
  navigateTo:       (view: ActiveView) => void
  selectTournament: (t: Tournament) => void
  navigateHome:     () => void
} {
  const { activeView, navigateTo, selectTournament, navigateHome } = useTournamentContext()
  return { activeView, navigateTo, selectTournament, navigateHome }
}

export function useGamesCache(): {
  gamesCache: Record<string, Game[]>
  loadGames:  (tid: string) => Promise<void>
} {
  const { gamesCache, loadGames } = useTournamentContext()
  return { gamesCache, loadGames }
}

export function useTournamentList(): {
  tournaments:     Tournament[]
  loadTournaments: () => Promise<void>
} {
  const { tournaments, loadTournaments } = useTournamentContext()
  return { tournaments, loadTournaments }
}