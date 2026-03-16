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

// FIX: Import auth and group queries to apply global security filtering
import { useAuth }            from '../../../features/auth'
import { useUserGroupsQuery } from '../../group'

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
  const { profile }           = useAuth()
  const { data: groups = [] } = useUserGroupsQuery()

  return useQuery<Tournament[], Error, Tournament[]>({
    queryKey: tournamentKeys.all,
    queryFn:  () => unwrap(api.fetchTournaments()),
    select:   (data) => {
      const all = data ?? ([] as Tournament[])
      
      // Admins bypass the filter to manage all tournaments
      if (profile?.is_admin) return all

      // FIX: Secure the data boundary. Non-admins only see Global tournaments (!t.group_id) 
      // OR tournaments inside a group they have successfully joined.
      const myGroupIds = new Set(groups.map(g => g.id))
      return all.filter(t => !t.group_id || myGroupIds.has(t.group_id))
    },
  })
}

export function useGames(tournamentId: string | null) {
  return useQuery<Game[], Error, Game[]>({
    queryKey: tournamentKeys.games(tournamentId ?? ''),
    // Strict Mode Fallback
    queryFn:  () => tournamentId ? unwrap(api.fetchGames(tournamentId)) : Promise.resolve([]),
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