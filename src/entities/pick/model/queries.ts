// src/entities/pick/model/queries.ts

import {
  useQuery, useMutation, useQueryClient, type QueryClient,
} from '@tanstack/react-query'

import { unwrap }                   from '../../../shared/lib/unwrap'
import { collectDownstreamGameIds } from '../../../shared/lib/bracketMath'
import * as api                     from '../api'
import type { Game, Pick }          from '../../../shared/types'

// ── Query Keys ────────────────────────────────────────────────

export const pickKeys = {
  mine:    (tid: string) => ['picks', 'mine', tid] as const,
  allMine: ()            => ['picks', 'all-mine']  as const,
}

// ── safeInvalidate ────────────────────────────────────────────

function safeInvalidate(qc: QueryClient, queryKey: readonly unknown[]): void {
  if (qc.isMutating() > 0) {
    setTimeout(() => void qc.invalidateQueries({ queryKey }), 150)
  } else {
    void qc.invalidateQueries({ queryKey })
  }
}

// ── Local variable types ──────────────────────────────────────

interface MakePickVars {
  game:         Game
  team:         string
  tournamentId: string
  games:        Game[]
  existingPick: Pick | undefined
}

// Context snapshot for optimistic rollback
type MakePickContext = { prev: Pick[] | undefined }

type SaveTiebreakerVars = {
  gameId:          string
  predictedWinner: string
  score:           number
  tournamentId:    string
}

// ── Queries ───────────────────────────────────────────────────

/**
 * C-07 FIX: `gameIds` is included in the query key so any change to the
 * tournament's game set triggers a cache miss and fresh fetch.
 */
export function useMyPicks(tournamentId: string | null, games: Game[]) {
  const gameIds = games.map((g: Game) => g.id)
  return useQuery<Pick[], Error, Pick[]>({
    queryKey: [...pickKeys.mine(tournamentId ?? ''), gameIds] as const,
    queryFn:  () => unwrap(api.fetchMyPicksForTournament(gameIds)),
    enabled:  !!tournamentId && games.length > 0,
    select:   (data) => data ?? ([] as Pick[]),
  })
}

export function useAllMyPicks() {
  return useQuery<Pick[], Error, Pick[]>({
    queryKey: pickKeys.allMine(),
    queryFn:  () => unwrap(api.fetchAllMyPicks()),
    select:   (data) => data ?? ([] as Pick[]),
  })
}

// ── Mutations ─────────────────────────────────────────────────

export function useMakePick() {
  const qc = useQueryClient()

  return useMutation<Pick | null, Error, MakePickVars, MakePickContext>({
    mutationFn: async ({ game, team, games, existingPick }) => {
      const downstreamIds = collectDownstreamGameIds(game, games)

      if (existingPick?.predicted_winner === team) {
        await unwrap(api.deletePick(existingPick.id))
        await unwrap(api.deletePicksForGames(downstreamIds))
        return null
      }

      await unwrap(api.deletePicksForGames(downstreamIds))
      return unwrap(api.savePick(game.id, team))
    },

    onMutate: async ({ game, team, tournamentId, games, existingPick }): Promise<MakePickContext> => {
      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })
      const prev = qc.getQueryData<Pick[]>(pickKeys.mine(tournamentId))

      const downstreamIds = new Set(collectDownstreamGameIds(game, games))
      const isToggle      = existingPick?.predicted_winner === team

      qc.setQueryData<Pick[]>(pickKeys.mine(tournamentId), (old = []) => {
        const filtered = old.filter(
          (p: Pick) => p.game_id !== game.id && !downstreamIds.has(p.game_id),
        )
        if (isToggle) return filtered

        const optimistic: Pick = {
          id:               'optimistic-' + Date.now(),
          user_id:          existingPick?.user_id ?? 'me',
          game_id:          game.id,
          predicted_winner: team,
          tiebreaker_score: null,
        }
        return [...filtered, optimistic]
      })

      return { prev }
    },

    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(pickKeys.mine(vars.tournamentId), ctx.prev)
      }
    },

    onSettled: (_data, _err, vars) => {
      safeInvalidate(qc, pickKeys.mine(vars.tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
    },
  })
}

export function useSaveTiebreaker() {
  const qc = useQueryClient()
  return useMutation<Pick, Error, SaveTiebreakerVars>({
    mutationFn: ({ gameId, predictedWinner, score }) =>
      unwrap(api.saveTiebreakerScore(gameId, predictedWinner, score)),
    onSettled: (_d, _e, vars) => {
      safeInvalidate(qc, pickKeys.mine(vars.tournamentId))
    },
  })
}