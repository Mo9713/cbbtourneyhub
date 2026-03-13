// src/features/tournament/model/TournamentContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'

import { useUIStore }           from '../../../shared/store/uiStore'
import { useTournamentListQuery } from '../../../entities/tournament/model/queries'
import type { Tournament }       from '../../../shared/types'

// ── Context shape ─────────────────────────────────────────────

interface TournamentContextValue {
  tournaments:        Tournament[]
  selectedTournament: Tournament | null
  selectTournament:   (t: Tournament) => void
}

const TournamentContext = createContext<TournamentContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function TournamentProvider({ children }: { children: ReactNode }) {
  // ── Server state ──────────────────────────────────────────
  const { data: tournaments = [] } = useTournamentListQuery()

  // ── Nav state from Zustand ────────────────────────────────
  // Only selectedTournamentId is read reactively — we need it to
  // derive selectedTournament. All navigation actions are stable
  // Zustand refs that do not cause context re-renders.
  const selectedTournamentId = useUIStore((s) => s.selectedTournamentId)
  const uiSelectTournament   = useUIStore((s) => s.selectTournament)

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  )

  // Auto-navigate home when the active tournament is deleted.
  // Uses getState() to keep the effect's dep array minimal.
  useEffect(() => {
    if (!selectedTournamentId || !tournaments.length) return
    if (!tournaments.find((t) => t.id === selectedTournamentId)) {
      useUIStore.getState().navigateHome()
    }
  }, [tournaments, selectedTournamentId])

  const selectTournament = useCallback(
    (t: Tournament) => uiSelectTournament(t.id),
    [uiSelectTournament],
  )

  const value = useMemo<TournamentContextValue>(
    () => ({ tournaments, selectedTournament, selectTournament }),
    [tournaments, selectedTournament, selectTournament],
  )

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

// useTournamentNav reads activeView directly from Zustand, not from
// this context, so navigation never triggers TournamentContext subscribers.
export function useTournamentNav() {
  const activeView   = useUIStore((s) => s.activeView)
  const navigateHome = useUIStore((s) => s.navigateHome)
  const navigateTo   = useUIStore((s) => s.setActiveView)
  return { activeView, navigateHome, navigateTo }
}