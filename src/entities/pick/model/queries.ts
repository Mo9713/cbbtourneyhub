//
// ── Query Key Contract ────────────────────────────────────────
// useMyPicks registers its observer under the COMPOUND key:
//   ['picks', 'mine', tournamentId, gameIds[]]

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
  overrideUserId?: string
}

type MakePickContext = {
  prev:     Pick[] | undefined
  exactKey: readonly unknown[]
  prevRaw:  any | undefined
}

type SaveTiebreakerVars = {
  gameId:          string
  predictedWinner: string
  score:           number
  tournamentId:    string
  gameIds:         string[]
  overrideUserId?: string
}

type SaveTiebreakerContext = {
  prev:     Pick[] | undefined
  exactKey: readonly unknown[]
  prevRaw:  any | undefined
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
    mutationFn: async ({ game, team, games, existingPick, overrideUserId }) => {
      const downstreamIds = collectDownstreamGameIds(game, games)

      if (existingPick) {
        if (existingPick.predicted_winner === team) {
          await unwrap(api.deletePick(existingPick.id, overrideUserId))
          if (downstreamIds.length > 0) {
            await unwrap(api.deletePicksForGames(downstreamIds, overrideUserId))
          }
          return null
        } else {
          if (downstreamIds.length > 0) {
            await unwrap(api.deletePicksForGames(downstreamIds, overrideUserId))
          }
          return unwrap(api.savePick(game.id, team, overrideUserId))
        }
      }
      
      return unwrap(api.savePick(game.id, team, overrideUserId))
    },

    onMutate: async ({ game, team, tournamentId, games, existingPick, overrideUserId }): Promise<MakePickContext> => {
      const gameIds  = games.map((g: Game) => g.id)
      const exactKey = [...pickKeys.mine(tournamentId), gameIds] as const

      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })
      const prev = qc.getQueryData<Pick[]>(exactKey)

      const rawKey = ['leaderboard', 'raw'] as const
      await qc.cancelQueries({ queryKey: rawKey })
      const prevRaw = qc.getQueryData<any>(rawKey)

      const downstreamIds  = new Set(collectDownstreamGameIds(game, games))
      const isToggle       = existingPick?.predicted_winner === team
      const isChange       = !!existingPick && !isToggle

      // 1. Optimistic Update for My Picks cache
      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
        const filtered = old.filter((p: Pick) => {
          if (p.game_id === game.id) return false
          if ((isToggle || isChange) && downstreamIds.has(p.game_id)) return false
          return true
        })

        if (isToggle) return filtered

        const optimistic: Pick = {
          id:               'optimistic-' + Date.now(),
          user_id:          overrideUserId ?? existingPick?.user_id ?? 'me',
          game_id:          game.id,
          predicted_winner: team,
          tiebreaker_score: null,
        }
        return [...filtered, optimistic]
      })

      // 2. Optimistic Update for Leaderboard Raw cache (for instant SnoopModal feedback)
      if (overrideUserId) {
        qc.setQueryData<any>(rawKey, (old: any) => {
          if (!old) return old
          const filtered = old.allPicks.filter((p: Pick) => {
             if (p.user_id !== overrideUserId) return true
             if (p.game_id === game.id) return false
             if ((isToggle || isChange) && downstreamIds.has(p.game_id)) return false
             return true
          })
          if (isToggle) return { ...old, allPicks: filtered }
          const opt: Pick = {
             id: 'opt-' + Date.now(),
             user_id: overrideUserId,
             game_id: game.id,
             predicted_winner: team,
             tiebreaker_score: null
          }
          return { ...old, allPicks: [...filtered, opt] }
        })
      }

      return { prev, exactKey, prevRaw }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ctx.exactKey, ctx.prev)
      }
      if (ctx?.prevRaw !== undefined) {
        qc.setQueryData(['leaderboard', 'raw'], ctx.prevRaw)
      }
    },

    onSettled: (_data, _err, vars) => {
      // FIX B-01: Replace fragile setTimeout with safeInvalidate
      safeInvalidate(qc, pickKeys.mine(vars.tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
      safeInvalidate(qc, ['leaderboard', 'raw'])
    },
  })
}

export function useSaveTiebreaker() {
  const qc = useQueryClient()

  return useMutation<Pick, Error, SaveTiebreakerVars, SaveTiebreakerContext>({
    mutationKey: ['saveTiebreaker'],
    mutationFn: ({ gameId, predictedWinner, score, overrideUserId }) =>
      unwrap(api.saveTiebreakerScore(gameId, predictedWinner, score, overrideUserId)),

    onMutate: async ({ gameId, predictedWinner, score, tournamentId, gameIds, overrideUserId }): Promise<SaveTiebreakerContext> => {
      const exactKey = [...pickKeys.mine(tournamentId), gameIds] as const
      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })
      const prev = qc.getQueryData<Pick[]>(exactKey)

      const rawKey = ['leaderboard', 'raw'] as const
      await qc.cancelQueries({ queryKey: rawKey })
      const prevRaw = qc.getQueryData<any>(rawKey)

      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
        const existing = old.find((p: Pick) => p.game_id === gameId)
        const updated: Pick = {
          id:               existing?.id ?? 'optimistic-tb-' + Date.now(),
          user_id:          overrideUserId ?? existing?.user_id ?? 'me',
          game_id:          gameId,
          predicted_winner: predictedWinner,
          tiebreaker_score: score,
        }
        return existing
          ? old.map((p: Pick) => p.game_id === gameId ? updated : p)
          : [...old, updated]
      })

      if (overrideUserId) {
        qc.setQueryData<any>(rawKey, (old: any) => {
          if (!old) return old
          const existing = old.allPicks.find((p: Pick) => p.user_id === overrideUserId && p.game_id === gameId)
          const updated: Pick = {
            id:               existing?.id ?? 'optimistic-tb-' + Date.now(),
            user_id:          overrideUserId,
            game_id:          gameId,
            predicted_winner: predictedWinner,
            tiebreaker_score: score,
          }
          return {
             ...old,
             allPicks: existing
                ? old.allPicks.map((p: Pick) => p.id === existing.id ? updated : p)
                : [...old.allPicks, updated]
          }
        })
      }

      return { prev, exactKey, prevRaw }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ctx.exactKey, ctx.prev)
      }
      if (ctx?.prevRaw !== undefined) {
        qc.setQueryData(['leaderboard', 'raw'], ctx.prevRaw)
      }
    },

    onSettled: (_data, _err, vars) => {
      safeInvalidate(qc, pickKeys.mine(vars.tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
      safeInvalidate(qc, ['leaderboard', 'raw'])
    },
  })
}