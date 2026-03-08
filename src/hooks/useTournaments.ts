// src/hooks/useTournaments.ts
import {
  useState, useEffect, useReducer, useCallback, useRef, useMemo,
} from 'react'

import * as tournamentService from '../services/tournamentService'
import * as gameService       from '../services/gameService'

import type { Profile, Tournament, Game, ActiveView, TemplateKey } from '../types'

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

const INITIAL_NAV: NavState = { selectedTournament: null, activeView: 'home' }

// ─────────────────────────────────────────────────────────────
// § 2. Public Interface
// ─────────────────────────────────────────────────────────────

export interface TournamentsState {
  tournaments:        Tournament[]
  selectedTournament: Tournament | null
  gamesCache:         Record<string, Game[]>
  activeView:         ActiveView
  // Optimistic patch — for consumers that immediately update the cache
  patchGamesCache:    (tid: string, updater: (prev: Game[]) => Game[]) => void
  selectTournament:   (t: Tournament) => void
  navigateHome:       () => void
  navigateTo:         (view: ActiveView) => void
  // Exposed in hook return for the sync context; NOT in public context value
  loadTournaments:    () => Promise<void>
  loadGames:          (tid: string) => Promise<void>
  createTournament:   (name: string, template: TemplateKey, teamCount?: number) => Promise<string | null>
  publishTournament:  () => Promise<string | null>
  lockTournament:     () => Promise<string | null>
  renameTournament:   (newName: string) => Promise<string | null>
  updateTournament:   (updates: Partial<Tournament>) => Promise<string | null>
  deleteTournament:   (gameIds: string[]) => Promise<string | null>
}

// ─────────────────────────────────────────────────────────────
// § 3. Hook
// ─────────────────────────────────────────────────────────────

export function useTournaments(profile: Profile | null): TournamentsState {

  const [nav, dispatch]     = useReducer(navReducer, INITIAL_NAV)
  const [tournaments,  setTournaments]  = useState<Tournament[]>([])
  const [gamesCache,   setGamesCache]   = useState<Record<string, Game[]>>({})

  const selectedRef     = useRef<Tournament | null>(null)
  selectedRef.current   = nav.selectedTournament

  const gamesCacheRef   = useRef(gamesCache)
  gamesCacheRef.current = gamesCache

  const loadingTidsRef  = useRef(new Set<string>())

  // ── Loaders ───────────────────────────────────────────────

  const loadTournaments = useCallback(async () => {
    const result = await tournamentService.fetchTournaments()
    if (result.ok) setTournaments(result.data)
  }, [])

  const loadGames = useCallback(async (tid: string) => {
    if (loadingTidsRef.current.has(tid)) return
    loadingTidsRef.current.add(tid)
    try {
      const result = await gameService.fetchGames(tid)
      if (result.ok) setGamesCache(prev => ({ ...prev, [tid]: result.data }))
    } finally {
      loadingTidsRef.current.delete(tid)
    }
  }, [])

  // Optimistic cache patch — used by useBracket for immediate UI feedback
  const patchGamesCache = useCallback((tid: string, updater: (prev: Game[]) => Game[]) => {
    setGamesCache(prev => ({ ...prev, [tid]: updater(prev[tid] ?? []) }))
  }, [])

  // ── Boot ──────────────────────────────────────────────────

  useEffect(() => {
    if (profile) loadTournaments()
  }, [profile, loadTournaments])

  useEffect(() => {
    if (!profile || tournaments.length === 0) return
    tournaments.forEach(t => {
      if (!gamesCacheRef.current[t.id]) loadGames(t.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments, profile, loadGames])

  // ── Re-sync selected tournament after list refresh ────────

  useEffect(() => {
    const prev = selectedRef.current
    if (!prev) return
    const fresh = tournaments.find(t => t.id === prev.id)
    if (!fresh) { dispatch({ type: 'CLEAR_SELECTED' }); return }
    if (fresh !== prev) dispatch({ type: 'SYNC_SELECTED', fresh })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments])

  // ── Navigation ────────────────────────────────────────────

  const selectTournament = useCallback((t: Tournament) => {
    dispatch({ type: 'SELECT_TOURNAMENT', tournament: t })
  }, [])

  const navigateHome = useCallback(() => dispatch({ type: 'NAVIGATE_HOME' }), [])

  const navigateTo   = useCallback((view: ActiveView) => dispatch({ type: 'NAVIGATE_TO', view }), [])

  // ── Tournament Mutations ──────────────────────────────────

  const createTournament = useCallback(async (
    name: string, template: TemplateKey, teamCount: number = 16,
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

  const updateTournament = useCallback(async (updates: Partial<Tournament>): Promise<string | null> => {
    const t = selectedRef.current
    if (!t) return 'No tournament selected'
    const result = await tournamentService.updateTournament(t.id, updates)
    if (!result.ok) return result.error
    dispatch({ type: 'REPLACE_SELECTED', tournament: result.data })
    await loadTournaments()
    return null
  }, [loadTournaments])

  const deleteTournament = useCallback(async (gameIds: string[]): Promise<string | null> => {
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

  return useMemo<TournamentsState>(() => ({
    tournaments,
    selectedTournament: nav.selectedTournament,
    gamesCache,
    activeView:         nav.activeView,
    patchGamesCache,
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
    tournaments, nav.selectedTournament, nav.activeView, gamesCache,
    patchGamesCache, selectTournament, navigateHome, navigateTo,
    loadTournaments, loadGames,
    createTournament, publishTournament, lockTournament,
    renameTournament, updateTournament, deleteTournament,
  ])
}