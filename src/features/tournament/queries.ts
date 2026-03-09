// src/features/tournament/queries.ts
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { Game, Tournament } from '../../types'

// ── Query Keys ────────────────────────────────────────────────

export const tournamentKeys = {
  all:   ['tournaments']                    as const,
  games: (tid: string) => ['games', tid]   as const,
}

// ── Helper: unwrap ServiceResult, throw on error ──────────────
// TanStack Query requires queryFns to throw — it doesn't
// understand our ServiceResult wrapper natively.

async function unwrap<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T> {
  const result = await p
  if (!result.ok) throw new Error(result.error)
  return result.data
}

// ── Queries ───────────────────────────────────────────────────

export function useTournamentListQuery() {
  return useQuery({
    queryKey: tournamentKeys.all,
    queryFn:  () => unwrap(api.fetchTournaments()),
    select:   (data) => data ?? ([] as Tournament[]),
  })
}

export function useGames(tournamentId: string | null) {
  return useQuery({
    queryKey: tournamentKeys.games(tournamentId ?? ''),
    queryFn:  () => unwrap(api.fetchGames(tournamentId!)),
    enabled:  !!tournamentId,
    select:   (data) => data ?? ([] as Game[]),
  })
}

// Load games for ALL tournaments in parallel — used to build gamesCache
export function useAllTournamentGames(tournaments: Tournament[]) {
  return useQueries({
    queries: tournaments.map(t => ({
      queryKey: tournamentKeys.games(t.id),
      queryFn:  () => unwrap(api.fetchGames(t.id)),
    })),
  })
}