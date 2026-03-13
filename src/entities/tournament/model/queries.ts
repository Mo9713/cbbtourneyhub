// src/entities/tournament/model/queries.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'

import * as api                    from '../api'
import type { Game, Tournament }    from '../../../shared/types'
import type { CreateTournamentOptions } from '../api'

const REALTIME_DEBOUNCE_MS = 150

export const tournamentKeys = {
  all:  ['tournaments']                   as const,
  list: ['tournaments']                   as const,
  games: (tid: string) => ['games', tid]  as const,
} as const

function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  if (qc.isMutating() > 0) {
    setTimeout(() => {
      void qc.invalidateQueries({ queryKey })
    }, REALTIME_DEBOUNCE_MS)
  } else {
    void qc.invalidateQueries({ queryKey })
  }
}

async function unwrap<T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
): Promise<T> {
  const result = await p
  if (!result.ok) throw new Error(result.error)
  return result.data
}

export function useTournamentListQuery() {
  return useQuery({
    queryKey: tournamentKeys.list,
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

export function usePatchGamesCache() {
  const qc = useQueryClient()
  return (tid: string, updater: (prev: Game[]) => Game[]) => {
    qc.setQueryData<Game[]>(tournamentKeys.games(tid), (prev) => updater(prev ?? []))
  }
}

export function useCreateTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts: CreateTournamentOptions) => unwrap(api.createTournament(opts)),
    onSuccess: (tournament) => {
      safeInvalidate(qc, tournamentKeys.all)
      safeInvalidate(qc, tournamentKeys.games(tournament.id))
    },
  })
}

export function useUpdateTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: {
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
    }) => unwrap(api.updateTournament(id, updates)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export const updateTournamentConfig = useUpdateTournamentMutation

export function usePublishTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.publishTournament(id)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export function useLockTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.lockTournament(id)),
    onSuccess: () => {
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export function useDeleteTournamentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, gameIds }: { id: string; gameIds: string[] }) =>
      unwrap(api.deleteTournament(id, gameIds)),
    onSuccess: (_data, { id }) => {
      qc.removeQueries({ queryKey: tournamentKeys.games(id) })
      safeInvalidate(qc, tournamentKeys.all)
    },
  })
}

export function useTournamentDetailsQuery(tournamentId: string) {
  return useQuery({
    queryKey: ['tournamentDetails', tournamentId],
    queryFn: async () => {
      const tournaments = await unwrap(api.fetchTournaments())
      const found = tournaments.find(t => t.id === tournamentId)
      if (!found) throw new Error('Tournament not found')
      return found
    },
    enabled: !!tournamentId,
  })
}

export function useTournamentGamesQuery(tournamentId: string) {
  return useGames(tournamentId)
}