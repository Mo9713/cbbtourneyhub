// src/hooks/useTournaments.ts
// ─────────────────────────────────────────────────────────────
// Internal hook that owns the tournament list, game cache,
// and all navigation state for the app shell.
//
// Consumed exclusively by TournamentContext.tsx.
// Do NOT import this hook directly in components or views.
// Use useTournamentContext() from TournamentContext.tsx instead.
//
// The old code had two separate useState calls updated in the same
// handler which, while batched in React 18, was fragile: any
// refactor that added an early-return between the two setters
// would silently re-introduce the bug. The reducer eliminates
// that risk permanently.
// ─────────────────────────────────────────────────────────────

import {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useRef,
} from 'react'

import * as tournamentService from '../services/tournamentService'
import * as gameService       from '../services/gameService'

import type {
  Profile, Tournament, Game,
  ActiveView, TemplateKey,
} from '../types'

// ─────────────────────────────────────────────────────────────
// § 1. Navigation Reducer
// ─────────────────────────────────────────────────────────────

/**
 * The two pieces of state that MUST always change together are
 * `selectedTournament` and `activeView`. Encoding them in a
 * reducer makes every transition an atomic, named operation.
 *
 * There is no way to call `dispatch({ type: 'SELECT_TOURNAMENT' })`
 * without also setting `activeView: 'bracket'` — the invariant
 * is enforced by the reducer function, not by caller discipline.
 */
interface NavState {
  selectedTournament: Tournament | null
  activeView:         ActiveView
}

type NavAction =
  /** User clicked a tournament in the sidebar or HomeView. Always → bracket. */
  | { type: 'SELECT_TOURNAMENT'; tournament: Tournament }
  /** User clicked Home or a tournament was deleted. Always → home + clear. */
  | { type: 'NAVIGATE_HOME' }
  /** User clicked a sidebar nav item (leaderboard, settings). No tournament change. */
  | { type: 'NAVIGATE_TO'; view: ActiveView }
  /**
   * Realtime or mutation refreshed the tournaments list and the currently-selected
   * tournament has new data (e.g. a rename). Re-syncs the selected object in-place
   * without touching activeView. (Bug B fix)
   */
  | { type: 'SYNC_SELECTED'; fresh: Tournament }
  /**
   * The selected tournament was deleted (by this admin or another session).
   * Force-navigates home. (Bug B edge case)
   */
  | { type: 'CLEAR_SELECTED' }
  /**
   * After createTournament or publishTournament mutations the context needs
   * to update selectedTournament with the server-confirmed record AND
   * optionally set a specific view.
   */
  | { type: 'REPLACE_SELECTED'; tournament: Tournament; view?: ActiveView }

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {

    case 'SELECT_TOURNAMENT':
      // activeView is ALWAYS reset here ────────────
      // It is structurally impossible to call SELECT_TOURNAMENT
      // without landing on 'bracket'. No caller can forget the
      // second setter because there IS no second setter.
      return {
        selectedTournament: action.tournament,
        activeView:         'bracket',
      }

    case 'NAVIGATE_HOME':
      return {
        selectedTournament: null,
        activeView:         'home',
      }

    case 'NAVIGATE_TO':
      // Only changes the view, does not touch selectedTournament.
      // Used by sidebar nav links (leaderboard, settings).
      return { ...state, activeView: action.view }

    case 'SYNC_SELECTED':
      // Re-sync in-place. If the user somehow navigated away between
      // the realtime event and this dispatch, selectedTournament might
      // no longer be the active tournament — but we still update it
      // so if they navigate back, they see fresh data.
      return { ...state, selectedTournament: action.fresh }

    case 'CLEAR_SELECTED':
      // Tournament deleted externally → force home
      return { selectedTournament: null, activeView: 'home' }

    case 'REPLACE_SELECTED':
      return {
        selectedTournament: action.tournament,
        activeView:         action.view ?? state.activeView,
      }

    default:
      return state
  }
}

const INITIAL_NAV: NavState = {
  selectedTournament: null,
  activeView:         'home',
}

// ─────────────────────────────────────────────────────────────
// § 2. Public Hook Shape
// ─────────────────────────────────────────────────────────────

export interface TournamentsState {
  // ── Data ───────────────────────────────────────────────────
  tournaments:          Tournament[]
  selectedTournament:   Tournament | null
  gamesCache:           Record<string, Game[]>

  // ── Navigation ─────────────────────────────────────────────
  activeView:           ActiveView
  /** Select a tournament → always navigates to 'bracket' view. (Bug G fix) */
  selectTournament:     (t: Tournament) => void
  /** Clear selection → always navigates to 'home' view. */
  navigateHome:         () => void
  /** Navigate to a specific view without touching tournament selection. */
  navigateTo:           (view: ActiveView) => void

  // ── Layout UI State ────────────────────────────────────────
  sidebarOpen:          boolean
  mobileMenuOpen:       boolean
  showAddTournament:    boolean
  setSidebarOpen:       (v: boolean) => void
  setMobileMenuOpen:    (v: boolean) => void
  setShowAddTournament: (v: boolean) => void

  // ── Data Loaders ───────────────────────────────────────────
  // Exposed so TournamentContext can hand them to the realtime
  // hook (Phase 8) and to BracketContext for pick loading.
  loadTournaments:      () => Promise<void>
  loadGames:            (tid: string) => Promise<void>

  // ── Tournament Mutations ───────────────────────────────────
  // All return: null on success, error string on failure.
  // Callers (App shell) handle toasting and confirm dialogs.
  createTournament:     (name: string, template: TemplateKey, teamCount?: number) => Promise<string | null>
  publishTournament:    () => Promise<string | null>
  lockTournament:       () => Promise<string | null>
  renameTournament:     (newName: string) => Promise<string | null>
  updateTournament:     (updates: Partial<Tournament>) => Promise<string | null>
  deleteTournament:     (gameIds: string[]) => Promise<string | null>
}

// ─────────────────────────────────────────────────────────────
// § 3. Hook Implementation
// ─────────────────────────────────────────────────────────────

export function useTournaments(profile: Profile | null): TournamentsState {

  // ── Navigation state (atomic via reducer) ──────────────────
  const [nav, dispatch] = useReducer(navReducer, INITIAL_NAV)

  // ── Data state ─────────────────────────────────────────────
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [gamesCache,  setGamesCache]  = useState<Record<string, Game[]>>({})

  // ── Layout UI state ────────────────────────────────────────
  const [sidebarOpen,        setSidebarOpen]        = useState(true)
  const [mobileMenuOpen,     setMobileMenuOpen]     = useState(false)
  const [showAddTournament,  setShowAddTournament]  = useState(false)

  // ── Ref: always holds the latest selectedTournament ────────
  // Used by the Bug B re-sync effect so it can read the current
  // value without being added to the effect's dependency array.
  const selectedRef = useRef<Tournament | null>(null)
  selectedRef.current = nav.selectedTournament

  // ─────────────────────────────────────────────────────────
  // § 3a. Data Loaders
  // ─────────────────────────────────────────────────────────

  const loadTournaments = useCallback(async () => {
    const result = await tournamentService.fetchTournaments()
    if (result.ok) setTournaments(result.data)
  }, [])

  const loadGames = useCallback(async (tid: string) => {
    const result = await gameService.fetchGames(tid)
    if (result.ok) {
      setGamesCache(prev => ({ ...prev, [tid]: result.data }))
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // § 3b. Boot Sequence
  // ─────────────────────────────────────────────────────────

  // Load tournaments once the user is authenticated
  useEffect(() => {
    if (profile) loadTournaments()
  }, [profile, loadTournaments])

  // Pre-warm the games cache for every tournament so the sidebar's
  // missing-picks indicator and HomeView cards have game data
  // immediately without waiting for a tournament to be selected.
  useEffect(() => {
    if (!profile || tournaments.length === 0) return
    tournaments.forEach(t => {
      if (!gamesCache[t.id]) loadGames(t.id)
    })
    // gamesCache is intentionally omitted from deps: we only want
    // to run this when tournaments changes, not on every cache update.
    // The !gamesCache[t.id] guard prevents duplicate fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments, profile, loadGames])

  // ─────────────────────────────────────────────────────────
  // § Re-sync selectedTournament
  // ─────────────────────────────────────────────────────────
  //
  // When loadTournaments() refreshes the list (triggered by a
  // realtime UPDATE event on the tournaments table), the in-memory
  // `selectedTournament` object is now stale — it still holds the
  // pre-update snapshot. Any view reading selectedTournament.name
  // or selectedTournament.status will show outdated data.
  //
  // This effect runs whenever `tournaments` changes and replaces
  // the selected snapshot with the fresh version from the new list.
  //
  // We read from `selectedRef.current` (not state) to avoid
  // adding `nav.selectedTournament` to the dependency array,
  // which would create:
  //   tournaments changes
  //   → dispatch(SYNC_SELECTED)
  //   → nav.selectedTournament changes
  //   → effect re-runs
  //   → tournaments hasn't changed, finds same fresh object
  //   → dispatch(SYNC_SELECTED) with same reference (React bails)
  //   → done (one extra no-op dispatch)
  //
  // Using a ref avoids that extra dispatch entirely and keeps the
  // effect dependency array honest (only [tournaments]).
  useEffect(() => {
    const prev = selectedRef.current
    if (!prev) return  // nothing selected — nothing to re-sync

    const fresh = tournaments.find(t => t.id === prev.id)

    if (!fresh) {
      // The selected tournament was deleted externally (e.g. another
      // admin session removed it). Force-navigate to home so the user
      // doesn't stay on a view for a tournament that no longer exists.
      dispatch({ type: 'CLEAR_SELECTED' })
      return
    }

    // Only dispatch if the data actually changed. Object identity
    // check is sufficient: loadTournaments always creates new objects
    // from JSON, so `fresh !== prev` is true whenever data changed.
    if (fresh !== prev) {
      dispatch({ type: 'SYNC_SELECTED', fresh })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments])  // deliberately omits nav.selectedTournament — see above

  // ─────────────────────────────────────────────────────────
  // § 3d. Navigation Actions
  // ─────────────────────────────────────────────────────────

  const selectTournament = useCallback((t: Tournament) => {
    dispatch({ type: 'SELECT_TOURNAMENT', tournament: t })
  }, [])

  const navigateHome = useCallback(() => {
    dispatch({ type: 'NAVIGATE_HOME' })
  }, [])

  const navigateTo = useCallback((view: ActiveView) => {
    dispatch({ type: 'NAVIGATE_TO', view })
  }, [])

  // ─────────────────────────────────────────────────────────
  // § 3e. Tournament Mutations
  // ─────────────────────────────────────────────────────────
  //
  // Conventions:
  //   • All mutations return `string | null`.
  //     null  = success (caller may show a success toast)
  //     string = error message (caller shows error toast)
  //
  //   • After a successful mutation, we reload the tournaments
  //     list from the DB to ensure local state is authoritative.
  //     The re-sync effect above will update selectedTournament
  //     automatically from the fresh list.
  //
  //   • For mutations that return an updated Tournament object from
  //     the service (publish, lock, rename, update), we dispatch
  //     REPLACE_SELECTED immediately so the view updates before the
  //     full list refresh completes — gives instant UI feedback.
  //
  //   • Confirm dialogs are NOT embedded here. The App shell wraps
  //     these in a ConfirmModal. The context stays UI-agnostic.

  const createTournament = useCallback(async (
    name:      string,
    template:  TemplateKey,
    teamCount: number = 16
  ): Promise<string | null> => {
    const result = await tournamentService.createTournament({ name, template, teamCount })
    if (!result.ok) return result.error

    // Load the new tournament's games into cache immediately
    await loadGames(result.data.id)

    // Refresh tournament list, then navigate to admin view
    await loadTournaments()

    // Navigate to admin view for the newly created tournament
    dispatch({ type: 'REPLACE_SELECTED', tournament: result.data, view: 'admin' })

    return null
  }, [loadGames, loadTournaments])

  const publishTournament = useCallback(async (): Promise<string | null> => {
    const t = selectedRef.current
    if (!t) return 'No tournament selected'

    const result = await tournamentService.publishTournament(t.id)
    if (!result.ok) return result.error

    // Instant feedback — update selected before list refresh
    dispatch({ type: 'REPLACE_SELECTED', tournament: result.data })
    await loadTournaments()

    return null
  }, [loadTournaments])

  const lockTournament = useCallback(async (): Promise<string | null> => {
    const t = selectedRef.current
    if (!t) return 'No tournament selected'

    const result = await tournamentService.lockTournament(t.id)
    if (!result.ok) return result.error

    dispatch({ type: 'REPLACE_SELECTED', tournament: result.data })
    await loadTournaments()

    return null
  }, [loadTournaments])

  const renameTournament = useCallback(async (newName: string): Promise<string | null> => {
    const t = selectedRef.current
    if (!t) return 'No tournament selected'

    const result = await tournamentService.updateTournament(t.id, { name: newName })
    if (!result.ok) return result.error

    dispatch({ type: 'REPLACE_SELECTED', tournament: result.data })
    await loadTournaments()

    return null
  }, [loadTournaments])

  const updateTournament = useCallback(async (
    updates: Partial<Tournament>
  ): Promise<string | null> => {
    const t = selectedRef.current
    if (!t) return 'No tournament selected'

    const result = await tournamentService.updateTournament(t.id, updates)
    if (!result.ok) return result.error

    dispatch({ type: 'REPLACE_SELECTED', tournament: result.data })
    await loadTournaments()

    return null
  }, [loadTournaments])

  const deleteTournament = useCallback(async (
    gameIds: string[]
  ): Promise<string | null> => {
    const t = selectedRef.current
    if (!t) return 'No tournament selected'

    const result = await tournamentService.deleteTournament(t.id, gameIds)
    if (!result.ok) return result.error

    // Clear local cache for the deleted tournament
    setGamesCache(prev => {
      const next = { ...prev }
      delete next[t.id]
      return next
    })

    // Navigate home — the tournament no longer exists
    dispatch({ type: 'NAVIGATE_HOME' })
    await loadTournaments()

    return null
  }, [loadTournaments])

  // ─────────────────────────────────────────────────────────
  // § 3f. Return
  // ─────────────────────────────────────────────────────────

  return {
    tournaments,
    selectedTournament:   nav.selectedTournament,
    gamesCache,
    activeView:           nav.activeView,
    selectTournament,
    navigateHome,
    navigateTo,
    sidebarOpen,
    mobileMenuOpen,
    showAddTournament,
    setSidebarOpen,
    setMobileMenuOpen,
    setShowAddTournament,
    loadTournaments,
    loadGames,
    createTournament,
    publishTournament,
    lockTournament,
    renameTournament,
    updateTournament,
    deleteTournament,
  }
}
