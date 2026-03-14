// src/entities/tournament/model/queries.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'

import { unwrap }  from '../../../shared/lib/unwrap'
import * as api    from '../api'
import type { Game, Tournament } from '../../../shared/types'
import type { CreateTournamentOptions } from '../api'

const REALTIME_DEBOUNCE_MS = 150

// W-04 FIX: `list` alias removed — identical to `all` with misleading semantics.
export const tournamentKeys = {
  all:   ['tournaments']                  as const,
  games: (tid: string) => ['games', tid] as const,
} as const

function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  if (qc.isMutating() > 0) {
    setTimeout(() => void qc.invalidateQueries({ queryKey }), REALTIME_DEBOUNCE_MS)
  } else {
    void qc.invalidateQueries({ queryKey })
  }
}

// ── Local variable types ──────────────────────────────────────
// Defined here so useMutation generics can reference them by name.

type UpdateTournamentVars = {
  id:      string
  updates: Partial<Pick<Tournament,
    | 'name'
    | 'unlocks_at'
    | 'locks_at'
    | 'round_names'
    | 'scoring_config'
    | 'requires_tiebreaker'
    | 'survivor_elimination_rule'
    | 'round_locks'
  >>
}

type DeleteTournamentVars = { id: string; gameIds: string[] }

// ── Queries ───────────────────────────────────────────────────

export function useTournamentListQuery() {
  return useQuery<Tournament[], Error, Tournament[]>({
    queryKey: tournamentKeys.all,
    queryFn:  () => unwrap(api.fetchTournaments()),
    select:   (data) => data ?? ([] as Tournament[]),
  })
}

export function useGames(tournamentId: string | null) {
  return useQuery<Game[], Error, Game[]>({
    queryKey: tournamentKeys.games(tournamentId ?? ''),
    queryFn:  () => unwrap(api.fetchGames(tournamentId!)),
    enabled:  !!tournamentId,
    select:   (data) => data ?? ([] as Game[]),
  })
}

export function usePatchGamesCache() {
  const qc = useQueryClient()
  return (tid: string, updater: (prev: Game[]) => Game[]) => {
    qc.setQueryData<Game[]>(tournamentKeys.games(tid), (prev) => updater(prev ?? []))
  }
}

// ── Mutations ─────────────────────────────────────────────────

export function useCreateTournamentMutation() {
  const qc = useQueryClient()
  return useMutation<Tournament, Error, CreateTournamentOptions>({
    mutationFn: (opts) => unwrap(api.createTournament(opts)),
    onSuccess: (tournament) => {
      // `tournament` is now correctly typed as Tournament
      safeInvalidate(qc, tournamentKeys.all)
      safeInvalidate(qc, tournamentKeys.games(tournament.id))
    },
  })
}

export function useUpdateTournamentMutation() {
  const qc = useQueryClient()
  return useMutation<Tournament, Error, UpdateTournamentVars>({
    mutationFn: ({ id, updates }) => unwrap(api.updateTournament(id, updates)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export function usePublishTournamentMutation() {
  const qc = useQueryClient()
  return useMutation<Tournament, Error, string>({
    mutationFn: (id) => unwrap(api.publishTournament(id)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export function useLockTournamentMutation() {
  const qc = useQueryClient()
  return useMutation<Tournament, Error, string>({
    mutationFn: (id) => unwrap(api.lockTournament(id)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export function useDeleteTournamentMutation() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, DeleteTournamentVars>({
    mutationFn: ({ id, gameIds }) => unwrap(api.deleteTournament(id, gameIds)),
    onSuccess: (_data, { id }) => {
      qc.removeQueries({ queryKey: tournamentKeys.games(id) })
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}