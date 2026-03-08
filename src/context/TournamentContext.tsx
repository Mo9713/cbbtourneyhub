// src/context/TournamentContext.tsx
// ─────────────────────────────────────────────────────────────
// Context for all tournament list data, navigation state, game
// cache, and tournament-level mutations.
//
// Provider tree position: SECOND — must sit inside <AuthProvider>
// and outside <BracketProvider> and <LeaderboardProvider>.
//
//   <AuthProvider>
//     <TournamentProvider>        ← this file
//       <BracketProvider>
//         <LeaderboardProvider>
//           <App />
//         </LeaderboardProvider>
//       </BracketProvider>
//     </TournamentProvider>
//   </AuthProvider>
//
// ── What this context owns ────────────────────────────────────
//   • The full tournament list (all statuses)
//   • The selected tournament (one at a time, or null)
//   • The active view / navigation state
//   • The games cache (all tournaments pre-loaded for sidebar)
//   • Layout state: sidebarOpen, mobileMenuOpen, showAddTournament
//   • Tournament-level mutations: create, publish, lock, rename,
//     update, delete
//   • loadTournaments + loadGames (exposed for realtime hook)
//
// ── What this context does NOT own ───────────────────────────
//   • Picks for the active tournament  → BracketContext
//   • Game mutations (set winner, link, etc.) → BracketContext
//   • Leaderboard data and filter state → LeaderboardContext
//   • User profile / auth               → AuthContext
//
// ── Consumers ────────────────────────────────────────────────
//   useTournamentContext() — full context value
//   useSelectedTournament() — shorthand for the selected tournament
//   useActiveView() — shorthand for navigation state + actions
//   useGamesCache() — shorthand for the pre-loaded games map
// ─────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'

import { useAuthContext }                        from './AuthContext'
import { useTournaments, type TournamentsState } from '../hooks/useTournaments'
import type { ActiveView, Game, Tournament }      from '../types'

// ── Context shape ─────────────────────────────────────────────
//
// We re-export TournamentsState directly so consumers get the
// same fully-typed interface without a separate wrapper type.

type TournamentContextValue = TournamentsState

const TournamentContext = createContext<TournamentContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

interface TournamentProviderProps {
  children: ReactNode
}

export function TournamentProvider({ children }: TournamentProviderProps) {
  // AuthProvider guarantees profile is non-null when children render,
  // but useTournaments is written to accept null (it will just not
  // boot until profile is available). Belt-and-suspenders safety.
  const { profile } = useAuthContext()

  const tournaments = useTournaments(profile)

  return (
    <TournamentContext.Provider value={tournaments}>
      {children}
    </TournamentContext.Provider>
  )
}

// ── Primary consumer hook ─────────────────────────────────────

/**
 * Access the full tournament state and all actions from any component
 * inside <TournamentProvider>.
 *
 * Throws a descriptive error if called outside the provider tree.
 */
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
// These are not strictly necessary — consumers could destructure
// from useTournamentContext() — but they serve as explicit
// documentation of which contexts own which data, and they make
// component props lighter.
//
// IMPORTANT: These hooks do NOT add extra React context layers.
// They call useTournamentContext() internally, so they subscribe
// to the same context and will re-render on any change to it.
// For finer-grained memoization in the future, individual state
// slices could be split into child contexts (Phase 5+ optimization).

/**
 * Returns the currently selected tournament and the selectTournament
 * action. Useful for components that only need to know which
 * tournament is active without caring about the full list.
 *
 * Both `tournament` and `selectTournament` are stable across renders
 * (tournament changes only on navigation; selectTournament is memoized
 * via useCallback in useTournaments).
 */
export function useSelectedTournament(): {
  tournament:       Tournament | null
  selectTournament: (t: Tournament) => void
  navigateHome:     () => void
} {
  const { selectedTournament, selectTournament, navigateHome } = useTournamentContext()
  return { tournament: selectedTournament, selectTournament, navigateHome }
}

/**
 * Returns the current active view and all navigation actions.
 * Used by App shell, Sidebar, and tab components.
 *
 * ── note ────────────────────────────────────────────────
 * `selectTournament` is intentionally included here alongside
 * `navigateTo`. This makes it clear to the App shell that
 * "navigate to a tournament" is distinct from "navigate to a view":
 *   - selectTournament(t) → always goes to 'bracket'
 *   - navigateTo(view)    → goes to the specified view
 * There is no "set view to bracket without setting tournament" path.
 */
export function useActiveView(): {
  activeView:       ActiveView
  navigateTo:       (view: ActiveView) => void
  selectTournament: (t: Tournament) => void
  navigateHome:     () => void
} {
  const {
    activeView,
    navigateTo,
    selectTournament,
    navigateHome,
  } = useTournamentContext()

  return { activeView, navigateTo, selectTournament, navigateHome }
}

/**
 * Returns the pre-loaded games cache and the loadGames action.
 *
 * The cache is keyed by tournament ID and is pre-populated for
 * ALL tournaments on boot (not just the selected one) so that:
 *   - The Sidebar's missing-picks completion indicator works
 *     without waiting for a tournament to be selected
 *   - HomeView tournament cards can show game counts immediately
 *   - BracketContext can derive its active games synchronously
 *     from the cache rather than firing a redundant network fetch
 */
export function useGamesCache(): {
  gamesCache: Record<string, Game[]>
  loadGames:  (tid: string) => Promise<void>
} {
  const { gamesCache, loadGames } = useTournamentContext()
  return { gamesCache, loadGames }
}

/**
 * Returns the full tournament list and the loadTournaments action.
 * Used by Sidebar (list rendering), HomeView (cards), and the
 * realtime hook (to trigger refreshes on subscription events).
 */
export function useTournamentList(): {
  tournaments:     Tournament[]
  loadTournaments: () => Promise<void>
} {
  const { tournaments, loadTournaments } = useTournamentContext()
  return { tournaments, loadTournaments }
}
