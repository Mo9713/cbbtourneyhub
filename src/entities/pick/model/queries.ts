// src/entities/pick/model/queries.ts
//
// ── Query Key Contract ────────────────────────────────────────
// useMyPicks registers its observer under the COMPOUND key:
//   ['picks', 'mine', tournamentId, gameIds[]]
//
// All cache operations that must be visible to that observer (getQueryData,
// setQueryData) MUST use this exact compound key. cancelQueries and
// invalidateQueries use prefix/fuzzy matching by default and are correct
// with the base key pickKeys.mine(tournamentId) — but getQueryData /
// setQueryData are EXACT-MATCH only and will silently miss the compound
// key if only the base is supplied. MakePickContext carries exactKey
// so both onMutate and onError target the live cache entry.

import {
  useQuery, useMutation, useQueryClient,
} from '@tanstack/react-query'

import { safeInvalidate }           from '../../../shared/lib/queryUtils'
import { unwrap }                   from '../../../shared/lib/unwrap'
import { collectDownstreamGameIds } from '../../../shared/lib/bracketMath'
import * as api                     from '../api'
import type { Game, Pick }          from '../../../shared/types'

// ── Query Keys ────────────────────────────────────────────────

export const pickKeys = {
  mine:    (tid: string) => ['picks', 'mine', tid] as const,
  allMine: ()            => ['picks', 'all-mine']  as const,
}

// ── Local variable types ──────────────────────────────────────

interface MakePickVars {
  game:         Game
  team:         string
  tournamentId: string
  games:        Game[]
  existingPick: Pick | undefined
}

type MakePickContext = {
  prev:     Pick[] | undefined
  exactKey: readonly unknown[]
}

type SaveTiebreakerVars = {
  gameId:          string
  predictedWinner: string
  score:           number
  tournamentId:    string
  gameIds:         string[]
}

type SaveTiebreakerContext = {
  prev:     Pick[] | undefined
  exactKey: readonly unknown[]
}

// ── Queries ───────────────────────────────────────────────────

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
    mutationKey: ['makePick'], // Tracks inflight click spamming
    mutationFn: async ({ game, team, games, existingPick }) => {
      const downstreamIds = collectDownstreamGameIds(game, games)

      if (existingPick) {
        if (existingPick.predicted_winner === team) {
          await unwrap(api.deletePick(existingPick.id))
          if (downstreamIds.length > 0) {
            await unwrap(api.deletePicksForGames(downstreamIds))
          }
          return null
        } else {
          if (downstreamIds.length > 0) {
            await unwrap(api.deletePicksForGames(downstreamIds))
          }
          return unwrap(api.savePick(game.id, team))
        }
      }
      
      return unwrap(api.savePick(game.id, team))
    },

    onMutate: async ({ game, team, tournamentId, games, existingPick }): Promise<MakePickContext> => {
      const gameIds  = games.map((g: Game) => g.id)
      const exactKey = [...pickKeys.mine(tournamentId), gameIds] as const

      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })

      const prev           = qc.getQueryData<Pick[]>(exactKey)
      const downstreamIds  = new Set(collectDownstreamGameIds(game, games))
      const isToggle       = existingPick?.predicted_winner === team
      const isChange       = !!existingPick && !isToggle

      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
        const filtered = old.filter((p: Pick) => {
          if (p.game_id === game.id) return false
          if ((isToggle || isChange) && downstreamIds.has(p.game_id)) return false
          return true
        })

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

      return { prev, exactKey }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ctx.exactKey, ctx.prev)
      }
    },

    onSettled: (_data, _err, vars) => {
      // FIX: Only trigger a network cache flush if the user has STOPPED clicking.
      // This stops the UI from wiping out uncommitted optimistic updates mid-click!
      setTimeout(() => {
        if (qc.isMutating({ mutationKey: ['makePick'] }) === 0) {
          qc.invalidateQueries({ queryKey: pickKeys.mine(vars.tournamentId) })
          qc.invalidateQueries({ queryKey: pickKeys.allMine() })
          qc.invalidateQueries({ queryKey: ['leaderboard', 'raw'] }) // Instant Standings updates!
        }
      }, 50)
    },
  })
}

export function useSaveTiebreaker() {
  const qc = useQueryClient()

  return useMutation<Pick, Error, SaveTiebreakerVars, SaveTiebreakerContext>({
    mutationKey: ['saveTiebreaker'],
    mutationFn: ({ gameId, predictedWinner, score }) =>
      unwrap(api.saveTiebreakerScore(gameId, predictedWinner, score)),

    onMutate: async ({ gameId, predictedWinner, score, tournamentId, gameIds }): Promise<SaveTiebreakerContext> => {
      const exactKey = [...pickKeys.mine(tournamentId), gameIds] as const
      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })
      const prev = qc.getQueryData<Pick[]>(exactKey)

      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
        const existing = old.find((p: Pick) => p.game_id === gameId)
        const updated: Pick = {
          id:               existing?.id ?? 'optimistic-tb-' + Date.now(),
          user_id:          existing?.user_id ?? 'me',
          game_id:          gameId,
          predicted_winner: predictedWinner,
          tiebreaker_score: score,
        }
        return existing
          ? old.map((p: Pick) => p.game_id === gameId ? updated : p)
          : [...old, updated]
      })

      return { prev, exactKey }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ctx.exactKey, ctx.prev)
      }
    },

    onSettled: (_data, _err, vars) => {
      safeInvalidate(qc, pickKeys.mine(vars.tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
    },
  })
}