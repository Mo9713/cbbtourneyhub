// src/features/tournament/model/TournamentContext.tsx

import {
  createContext, useContext, useEffect, useMemo, useCallback, type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuthContext }  from '../../auth'
import { useUIStore }      from '../../../shared/store/uiStore'
import {
  useTournamentListQuery,
  useAllTournamentGames,
  tournamentKeys,
}                          from './queries'
import * as api            from '../api/api'

import type { ActiveView, Game, Tournament, TemplateKey } from '../../../shared/types'

// ── Context shape ─────────────────────────────────────────────
// activeView, navigateHome, and navigateTo are intentionally NOT in this
// interface. They caused every navigation action to re-render the entire
// consumer subtree (BracketView, AdminBuilderView, Sidebar, ViewRouter)
// because activeView changes on every nav click. Those values are now
// read directly from useUIStore by consumers, or via useTournamentNav().

interface TournamentContextValue {
  tournaments:        Tournament[]
  selectedTournament: Tournament | null
  gamesCache:         Record<string, Game[]>
  patchGamesCache:    (tid: string, updater: (prev: Game[]) => Game[]) => void
  selectTournament:   (t: Tournament) => void
  navigateHome:       () => void
  navigateTo:         (view: ActiveView) => void
  createTournament:   (name: string, template: TemplateKey, teamCount?: number) => Promise<string | null>
  publishTournament:  () => Promise<string | null>
  lockTournament:     () => Promise<string | null>
  renameTournament:   (newName: string) => Promise<string | null>
  updateTournament:   (updates: Partial<Tournament>) => Promise<string | null>
  deleteTournament:   (gameIds: string[]) => Promise<string | null>
}

const TournamentContext = createContext<TournamentContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function TournamentProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  useAuthContext() // ensures we're inside AuthProvider

  // ── Server state ──────────────────────────────────────────
  const { data: tournaments = [] } = useTournamentListQuery()

  const gameQueries = useAllTournamentGames(tournaments)

  const gamesCache = useMemo(() => {
    const cache: Record<string, Game[]> = {}
    tournaments.forEach((t: Tournament, i: number) => {
      const data = gameQueries[i]?.data
      if (data) cache[t.id] = data
    })
    return cache
  }, [tournaments, gameQueries])

  const patchGamesCache = useCallback((tid: string, updater: (prev: Game[]) => Game[]) => {
    qc.setQueryData<Game[]>(tournamentKeys.games(tid), (prev) => updater(prev ?? []))
  }, [qc])

  // ── Nav state from Zustand ────────────────────────────────
  // NOTE: Only selectedTournamentId is read reactively here because we need
  // it to derive selectedTournament. navigateHome and setActiveView are
  // stable Zustand action refs — they don't cause re-renders.
  const selectedTournamentId = useUIStore(s => s.selectedTournamentId)
  const uiSelectTournament   = useUIStore(s => s.selectTournament)
  const navigateHome         = useUIStore(s => s.navigateHome)
  const setActiveView        = useUIStore(s => s.setActiveView)

  const selectedTournament = useMemo(
    () => tournaments.find((t: Tournament) => t.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  )

  // Auto-navigate home when the selected tournament is deleted while viewing it.
  // Uses getState() to avoid adding navigateHome to the deps array — it's a
  // stable ref but keeping deps minimal makes the effect's intent clearer.
  useEffect(() => {
    if (!selectedTournamentId || !tournaments.length) return
    if (!tournaments.find((t: Tournament) => t.id === selectedTournamentId)) {
      useUIStore.getState().navigateHome()
    }
  }, [tournaments, selectedTournamentId])

  const selectTournament = useCallback(
    (t: Tournament) => uiSelectTournament(t.id),
    [uiSelectTournament],
  )

  // ── Mutations ─────────────────────────────────────────────

  const createTournament = useCallback(async (
    name: string, template: TemplateKey, teamCount = 16,
  ): Promise<string | null> => {
    const result = await api.createTournament({ name, template, teamCount })
    if (!result.ok) return result.error
    await qc.invalidateQueries({ queryKey: tournamentKeys.all })
    await qc.invalidateQueries({ queryKey: tournamentKeys.games(result.data.id) })
    useUIStore.getState().selectTournament(result.data.id)
    useUIStore.getState().setActiveView('admin')
    return null
  }, [qc])

  const publishTournament = useCallback(async (): Promise<string | null> => {
    const id = useUIStore.getState().selectedTournamentId
    if (!id) return 'No tournament selected'
    const result = await api.publishTournament(id)
    if (!result.ok) return result.error
    await qc.invalidateQueries({ queryKey: tournamentKeys.all })
    return null
  }, [qc])

  const lockTournament = useCallback(async (): Promise<string | null> => {
    const id = useUIStore.getState().selectedTournamentId
    if (!id) return 'No tournament selected'
    const result = await api.lockTournament(id)
    if (!result.ok) return result.error
    await qc.invalidateQueries({ queryKey: tournamentKeys.all })
    return null
  }, [qc])

  const renameTournament = useCallback(async (newName: string): Promise<string | null> => {
    const id = useUIStore.getState().selectedTournamentId
    if (!id) return 'No tournament selected'
    const result = await api.updateTournament(id, { name: newName })
    if (!result.ok) return result.error
    await qc.invalidateQueries({ queryKey: tournamentKeys.all })
    return null
  }, [qc])

  const updateTournament = useCallback(async (updates: Partial<Tournament>): Promise<string | null> => {
    const id = useUIStore.getState().selectedTournamentId
    if (!id) return 'No tournament selected'
    const result = await api.updateTournament(id, updates)
    if (!result.ok) return result.error
    await qc.invalidateQueries({ queryKey: tournamentKeys.all })
    return null
  }, [qc])

  const deleteTournament = useCallback(async (gameIds: string[]): Promise<string | null> => {
    const id = useUIStore.getState().selectedTournamentId
    if (!id) return 'No tournament selected'
    const result = await api.deleteTournament(id, gameIds)
    if (!result.ok) return result.error
    qc.removeQueries({ queryKey: tournamentKeys.games(id) })
    await qc.invalidateQueries({ queryKey: tournamentKeys.all })
    useUIStore.getState().navigateHome()
    return null
  }, [qc])

  const value = useMemo<TournamentContextValue>(() => ({
    tournaments,
    selectedTournament,
    gamesCache,
    patchGamesCache,
    selectTournament,
    navigateHome,
    navigateTo: setActiveView,
    createTournament,
    publishTournament,
    lockTournament,
    renameTournament,
    updateTournament,
    deleteTournament,
  }), [
    tournaments, selectedTournament, gamesCache,
    patchGamesCache, selectTournament, navigateHome, setActiveView,
    createTournament, publishTournament, lockTournament,
    renameTournament, updateTournament, deleteTournament,
  ])

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  )
}

// ── Consumer hooks ────────────────────────────────────────────

export function useTournamentContext(): TournamentContextValue {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournamentContext() must be inside <TournamentProvider>')
  return ctx
}

export function useTournamentList() {
  return { tournaments: useTournamentContext().tournaments }
}

// useTournamentNav now reads activeView directly from Zustand rather than
// re-exposing it through TournamentContext. This prevents navigation actions
// from triggering re-renders in components that subscribe to TournamentContext
// for unrelated reasons (e.g. gamesCache updates).
export function useTournamentNav() {
  const { selectedTournament, selectTournament, navigateHome, navigateTo } =
    useTournamentContext()
  const activeView = useUIStore(s => s.activeView)
  return { selectedTournament, activeView, selectTournament, navigateHome, navigateTo }
}