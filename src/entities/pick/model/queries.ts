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
// key if only the base is supplied. MakePickContext now carries exactKey
// so both onMutate and onError target the live cache entry.
//
// ── safeInvalidate ────────────────────────────────────────────
// Invalidation fired from onSettled can race against Supabase Realtime
// echo events. safeInvalidate defers by 150ms when a mutation is still
// in flight, and deduplicates timers so rapid picks do not stack callbacks.

import {
  useQuery, useMutation, useQueryClient,
  type QueryClient, type QueryKey,
} from '@tanstack/react-query'

import { unwrap }                   from '../../../shared/lib/unwrap'
import { collectDownstreamGameIds } from '../../../shared/lib/bracketMath'
import * as api                     from '../api'
import type { Game, Pick }          from '../../../shared/types'

const REALTIME_DEBOUNCE_MS = 150
const invalidateTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ── Query Keys ────────────────────────────────────────────────

export const pickKeys = {
  mine:    (tid: string) => ['picks', 'mine', tid] as const,
  allMine: ()            => ['picks', 'all-mine']  as const,
}

// ── safeInvalidate ────────────────────────────────────────────
// Uses timer deduplication: a second call for the same key before the
// first fires will reset the clock, not stack a second callback.

function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  const keyStr = JSON.stringify(queryKey)
  if (qc.isMutating() > 0) {
    if (invalidateTimers.has(keyStr)) {
      clearTimeout(invalidateTimers.get(keyStr)!)
    }
    const timer = setTimeout(() => {
      // exact: false (default) — prefix-based invalidation covers compound
      // observer keys such as ['picks', 'mine', tid, gameIds[]].
      void qc.invalidateQueries({ queryKey })
      invalidateTimers.delete(keyStr)
    }, REALTIME_DEBOUNCE_MS)
    invalidateTimers.set(keyStr, timer)
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

// exactKey is the compound key used by the active useMyPicks observer.
// It is stored in context so onError can restore the snapshot to the
// same key that onMutate wrote to.
type MakePickContext = {
  prev:     Pick[] | undefined
  exactKey: readonly unknown[]
}

type SaveTiebreakerVars = {
  gameId:          string
  predictedWinner: string
  score:           number
  tournamentId:    string
  // gameIds is required to construct the exact compound key for
  // getQueryData / setQueryData in the optimistic block.
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
    // Compound key: mutations must target this full structure for
    // getQueryData / setQueryData to reach the live cache entry.
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
      // Derive the full compound key that matches the active useMyPicks observer.
      // getQueryData and setQueryData require exact key matches — the base key
      // pickKeys.mine(tournamentId) alone would miss the live cache entry.
      const gameIds  = games.map((g: Game) => g.id)
      const exactKey = [...pickKeys.mine(tournamentId), gameIds] as const

      // cancelQueries uses prefix matching — the base key correctly reaches the observer.
      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })

      // Snapshot for rollback on error.
      const prev = qc.getQueryData<Pick[]>(exactKey)

      const downstreamIds = new Set(collectDownstreamGameIds(game, games))
      const isToggle      = existingPick?.predicted_winner === team

      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
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

      return { prev, exactKey }
    },

    onError: (_err, _vars, ctx) => {
      // Restore to the exact compound key the optimistic write targeted.
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ctx.exactKey, ctx.prev)
      }
    },

    onSettled: (_data, _err, vars) => {
      // invalidateQueries uses prefix matching — base key is sufficient here.
      safeInvalidate(qc, pickKeys.mine(vars.tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
    },
  })
}

export function useSaveTiebreaker() {
  const qc = useQueryClient()

  return useMutation<Pick, Error, SaveTiebreakerVars, SaveTiebreakerContext>({
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

    onSettled: (_d, _e, vars) => {
      safeInvalidate(qc, pickKeys.mine(vars.tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
    },
  })
}