// src/features/survivor/model/useSurvivorPickMutation.ts
//
// ── Optimistic UI Contract ────────────────────────────────────
// onMutate snapshots the current cache at the exact compound key used by
// the useMyPicks observer: [...pickKeys.mine(tournamentId), gameIds[]].
// It applies a round-level optimistic update so the card highlights
// instantly without waiting for DB confirmation.
//
// FIX M-1: Same-round race condition — onMutate now filters out ALL picks
// in the same roundNum from the cache before inserting the new optimistic
// entry. Previously it only dropped the pick for the specific gameId being
// changed, so a rapid same-round pick change left a stale conflicting pick
// visible in the cache until onSettled invalidated it. The round-level
// filter correctly mirrors what the server does in deleteSurvivorPickForRound.
//
// FIX M-NEW-1: The optimistic Pick object now includes round_num, matching
// the shape the server writes and ensuring any code that reads p.round_num
// from the cache (including the M-1 filter itself on subsequent mutations)
// operates on a correctly-typed entry rather than undefined.
//
// C-04 FIX: safeInvalidate is imported from shared/lib/queryUtils.
// The isolated module-level timer Map that previously lived here has been
// removed. All callers share one Map, eliminating the cross-file race
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

    onMutate: async ({ tournamentId, gameId, predictedWinner, roundNum, gameIds }): Promise<SurvivorContext> => {
      const exactKey = [...pickKeys.mine(tournamentId), gameIds] as const

      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })

      const prev = qc.getQueryData<Pick[]>(exactKey)

      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
        // FIX M-1: Drop all picks for the same round, not just the specific
        // gameId. This mirrors the server-side deleteSurvivorPickForRound
        // behavior and prevents a stale same-round pick from being visible
        // in the optimistic cache during rapid clicking across games in the
        // same round. round_num is now present on Pick entries (see M-NEW-1
        // fix below) so this filter operates on real data.
        const withoutRound = old.filter(
          (p: Pick) => p.round_num !== roundNum,
        )

        if (!predictedWinner) return withoutRound

        // FIX M-NEW-1: Include round_num on the optimistic entry so it has
        // the same shape as a real Pick row from the server. Without this,
        // any code reading p.round_num from cache (including the filter
        // above on subsequent mutations) would see undefined.
        const optimistic: Pick = {
          id:               'optimistic-survivor-' + Date.now(),
          user_id:          'me',
          game_id:          gameId,
          predicted_winner: predictedWinner,
          tiebreaker_score: null,
          round_num:        roundNum, // FIX M-NEW-1
        }
        return [...withoutRound, optimistic]
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