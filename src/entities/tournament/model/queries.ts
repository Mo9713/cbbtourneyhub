// src/entities/tournament/model/queries.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { unwrap }  from '../../../shared/lib/unwrap'
import * as api    from '../api'
import type { Game, Tournament } from '../../../shared/types'
import type { CreateTournamentOptions } from '../api'
import { safeInvalidate } from '../../../shared/lib/queryUtils'

export const tournamentKeys = {
  all:   ['tournaments']                  as const,
  games: (tid: string) => ['games', tid] as const,
} as const

// ── Local variable types ──────────────────────────────────────

type UpdateTournamentVars = {
  id:      string
  updates: Partial<Pick<Tournament,
    | 'name'
    | 'status'
    | 'unlocks_at'
    | 'locks_at'
    | 'round_names'
    | 'scoring_config'
    | 'requires_tiebreaker'
    | 'survivor_elimination_rule'
    | 'round_locks'
    | 'show_game_numbers'
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
    // FIX (Type Assertion Danger): Previously called api.fetchGames(tournamentId!)
    // which asserts non-null without a runtime guard. In React Strict Mode,
    // effects run twice and this can fire with a null id before `enabled`
    // suppresses it, crashing with a runtime TypeError. The conditional
    // resolves to an empty array instead of asserting null away.
    queryFn:  () => tournamentId
      ? unwrap(api.fetchGames(tournamentId))
      : Promise.resolve([] as Game[]),
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

export function useCompleteTournamentMutation() {
  const qc = useQueryClient()
  return useMutation<Tournament, Error, string>({
    mutationFn: (id) => unwrap(api.completeTournament(id)),
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