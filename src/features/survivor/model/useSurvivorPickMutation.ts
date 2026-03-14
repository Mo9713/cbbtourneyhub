// src/features/survivor/model/useSurvivorPickMutation.ts
//
// ── Optimistic UI Contract ────────────────────────────────────
// onMutate snapshots the current cache at the exact compound key used by
// the useMyPicks observer: [...pickKeys.mine(tournamentId), gameIds[]].
// It applies a game-level optimistic update so the card highlights
// instantly without waiting for DB confirmation.
//
// Cross-round deduplication (clearing other picks for the same roundNum)
// is enforced server-side. The optimistic block only clears the current
// gameId pick to avoid needing round data that isn't in the Pick type.
// The brief window where a stale same-round pick might be visible
// self-corrects on onSettled invalidation.
//
// C-04 FIX: safeInvalidate is now imported from shared/lib/queryUtils.
// The isolated module-level timer Map that previously lived here has been
// removed. All callers now share one Map, eliminating the cross-file race
// condition where a Realtime echo and mutation onSettled could both fire
// for the same key into different, non-deduplicating Maps.

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { safeInvalidate }  from '../../../shared/lib/queryUtils'
import {
  deleteSurvivorPickForRound,
  saveSurvivorPick,
}                          from '../../../entities/pick/api'
import { pickKeys }        from '../../../entities/pick/model/queries'
import type { Pick }       from '../../../shared/types'

export interface SurvivorPickParams {
  tournamentId:    string
  gameId:          string
  predictedWinner: string | null
  roundNum:        number
  // Caller provides game IDs from their existing useGames() cache.
  // Eliminates the internal supabase.from('games') round-trip.
  // Also used to construct the exact compound cache key for
  // getQueryData / setQueryData in the optimistic block.
  gameIds:         string[]
}

type SurvivorContext = {
  prev:     Pick[] | undefined
  exactKey: readonly unknown[]
}

export function useMakeSurvivorPickMutation() {
  const qc = useQueryClient()

  return useMutation<Pick | null, Error, SurvivorPickParams, SurvivorContext>({
    mutationFn: async ({
      gameId,
      predictedWinner,
      roundNum,
      gameIds,
    }: SurvivorPickParams): Promise<Pick | null> => {
      // Step 1: Clear any existing pick for this round across the tournament.
      const deleteResult = await deleteSurvivorPickForRound(roundNum, gameIds)
      if (!deleteResult.ok) throw new Error(deleteResult.error)

      // Step 2: A null predictedWinner is a deliberate toggle-off (clear).
      if (predictedWinner) {
        const saveResult = await saveSurvivorPick(gameId, predictedWinner, roundNum)
        if (!saveResult.ok) throw new Error(saveResult.error)
        return saveResult.data as unknown as Pick
      }

      return null
    },

    onMutate: async ({ tournamentId, gameId, predictedWinner, gameIds }): Promise<SurvivorContext> => {
      const exactKey = [...pickKeys.mine(tournamentId), gameIds] as const

      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })

      const prev = qc.getQueryData<Pick[]>(exactKey)

      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
        const withoutCurrent = old.filter((p: Pick) => p.game_id !== gameId)

        if (!predictedWinner) return withoutCurrent

        const optimistic: Pick = {
          id:               'optimistic-survivor-' + Date.now(),
          user_id:          'me',
          game_id:          gameId,
          predicted_winner: predictedWinner,
          tiebreaker_score: null,
        }
        return [...withoutCurrent, optimistic]
      })

      return { prev, exactKey }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ctx.exactKey, ctx.prev)
      }
    },

    onSettled: (_data, _err, { tournamentId }) => {
      // onSettled fires on both success and error.
      // invalidateQueries uses prefix matching — base key covers compound variants.
      safeInvalidate(qc, pickKeys.mine(tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
    },
  })
}