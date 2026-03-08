// src/hooks/useTournaments.ts
// ─────────────────────────────────────────────────────────────
// Internal hook that owns the tournament list, game cache,
// and all navigation state for the app shell.
//
// Consumed exclusively by TournamentContext.tsx.
// Do NOT import this hook directly in components or views.
// Use useTournamentContext() from TournamentContext.tsx instead.
//
// ── What this hook owns ───────────────────────────────────────
//   • Tournament list + selected tournament
//   • Games cache (all tournaments, pre-warmed on boot)
//   • Navigation state (activeView) via atomic reducer
//   • All tournament-level mutations
//
// ── What this hook does NOT own ──────────────────────────────
//   • Layout toggles (sidebarOpen, mobileMenuOpen, showAddTournament)
//     → These are ephemeral UI state local to AppShell. Putting
//       them here caused layout-toggle events to broadcast a
//       TournamentContext update to every subscriber in the tree.
//       They now live in useLayoutState() inside App.tsx.
// ─────────────────────────────────────────────────────────────

import {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useRef,
  useMemo,
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

interface NavState {
  selectedTournament: Tournament | null
  activeView:         ActiveView
}

type NavAction =
  | { type: 'SELECT_TOURNAMENT'; tournament: Tournament }
  | { type: 'NAVIGATE_HOME' }
  | { type: 'NAVIGATE_TO'; view: ActiveView }
  | { type: 'SYNC_SELECTED'; fresh: Tournament }
  | { type: 'CLEAR_SELECTED' }
  | { type: 'REPLACE_SELECTED'; tournament: Tournament; view?: ActiveView }

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'SELECT_TOURNAMENT':
      return { selectedTournament: action.tournament, activeView: 'bracket' }
    case 'NAVIGATE_HOME':
      return { selectedTournament: null, activeView: 'home' }
    case 'NAVIGATE_TO':
      return { ...state, activeView: action.view }
    case 'SYNC_SELECTED':
      return { ...state, selectedTournament: action.fresh }
    case 'CLEAR_SELECTED':
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
  tournaments:        Tournament[]
  selectedTournament: Tournament | null
  gamesCache:         Record<string, Game[]>

  // ── Navigation ─────────────────────────────────────────────
  activeView:         ActiveView
  selectTournament:   (t: Tournament) => void
  navigateHome:       () => void
  navigateTo:         (view: ActiveView) => void

  // ── Data Loaders ───────────────────────────────────────────
  loadTournaments:    () => Promise<void>
  loadGames:          (tid: string) => Promise<void>

  // ── Tournament Mutations ───────────────────────────────────
  createTournament:   (name: string, template: TemplateKey, teamCount?: number) => Promise<string | null>
  publishTournament:  () => Promise<string | null>
  lockTournament:     () => Promise<string | null>
  renameTournament:   (newName: string) => Promise<string | null>
  updateTournament:   (updates: Partial<Tournament>) => Promise<string | null>
  deleteTournament:   (gameIds: string[]) => Promise<string | null>
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

  // ── Stable ref for selected tournament ─────────────────────
  // Lets effects and mutations read the latest value without
  // being listed in their dependency arrays.
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

  useEffect(() => {
    if (profile) loadTournaments()
  }, [profile, loadTournaments])

  // Pre-warm the games cache for every tournament so the sidebar's
  // missing-picks indicator and HomeView cards have data immediately.
  useEffect(() => {
    if (!profile || tournaments.length === 0) return
    tournaments.forEach(t => {
      if (!gamesCache[t.id]) loadGames(t.id)
    })
    // gamesCache intentionally omitted: we only want to run when
    // tournaments change, not on every cache update. The guard
    // `!gamesCache[t.id]` prevents duplicate fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments, profile, loadGames])

  // ─────────────────────────────────────────────────────────
  // § 3c. Re-sync selectedTournament after list refresh
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    const prev = selectedRef.current
    if (!prev) return

    const fresh = tournaments.find(t => t.id === prev.id)

    if (!fresh) {
      dispatch({ type: 'CLEAR_SELECTED' })
      return
    }

    if (fresh !== prev) {
      dispatch({ type: 'SYNC_SELECTED', fresh })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments])

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

  const createTournament = useCallback(async (
    name:      string,
    template:  TemplateKey,
    teamCount: number = 16
  ): Promise<string | null> => {
    const result = await tournamentService.createTournament({ name, template, teamCount })
    if (!result.ok) return result.error

    await loadGames(result.data.id)
    await loadTournaments()

    dispatch({ type: 'REPLACE_SELECTED', tournament: result.data, view: 'admin' })
    return null
  }, [loadGames, loadTournaments])

  const publishTournament = useCallback(async (): Promise<string | null> => {
    const t = selectedRef.current
    if (!t) return 'No tournament selected'

    const result = await tournamentService.publishTournament(t.id)
    if (!result.ok) return result.error

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

    setGamesCache(prev => {
      const next = { ...prev }
      delete next[t.id]
      return next
    })

    dispatch({ type: 'NAVIGATE_HOME' })
    await loadTournaments()
    return null
  }, [loadTournaments])

  // ─────────────────────────────────────────────────────────
  // § 3f. Stable Return Object
  // ─────────────────────────────────────────────────────────
  //
  // Wrapping in useMemo ensures TournamentContext.Provider only
  // receives a new object reference when actual data changes.
  // All callbacks are useCallback (stable refs). State values
  // (tournaments, gamesCache, nav.*) change only on real events.
  //
  // Without this memo, every render of TournamentProvider —
  // including those triggered by AuthContext parent re-renders —
  // would create a new object, broadcasting a context update to
  // every subscriber even though nothing actually changed.

  return useMemo<TournamentsState>(() => ({
    tournaments,
    selectedTournament: nav.selectedTournament,
    gamesCache,
    activeView:         nav.activeView,
    selectTournament,
    navigateHome,
    navigateTo,
    loadTournaments,
    loadGames,
    createTournament,
    publishTournament,
    lockTournament,
    renameTournament,
    updateTournament,
    deleteTournament,
  }), [
    tournaments,
    nav.selectedTournament,
    nav.activeView,
    gamesCache,
    selectTournament,
    navigateHome,
    navigateTo,
    loadTournaments,
    loadGames,
    createTournament,
    publishTournament,
    lockTournament,
    renameTournament,
    updateTournament,
    deleteTournament,
  ])
}