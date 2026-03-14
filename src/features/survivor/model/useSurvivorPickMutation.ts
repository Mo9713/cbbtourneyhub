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
// ── safeInvalidate ────────────────────────────────────────────
// Uses the authoritative deduplicated implementation (timer Map with
// clearTimeout reset) matching the version in useRealtimeSync.ts.
// Candidates for extraction to shared/lib/queryUtils.ts (N-09).

import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'

import {
  deleteSurvivorPickForRound,
  saveSurvivorPick,
} from '../../../entities/pick/api'
import { pickKeys } from '../../../entities/pick/model/queries'
import type { Pick }  from '../../../shared/types'

const REALTIME_DEBOUNCE_MS = 150
const invalidateTimers = new Map<string, ReturnType<typeof setTimeout>>()

function safeInvalidate(qc: QueryClient, queryKey: QueryKey): void {
  const keyStr = JSON.stringify(queryKey)
  if (qc.isMutating() > 0) {
    if (invalidateTimers.has(keyStr)) {
      clearTimeout(invalidateTimers.get(keyStr)!)
    }
    const timer = setTimeout(() => {
      void qc.invalidateQueries({ queryKey })
      invalidateTimers.delete(keyStr)
    }, REALTIME_DEBOUNCE_MS)
    invalidateTimers.set(keyStr, timer)
  } else {
    void qc.invalidateQueries({ queryKey })
  }
}

export interface SurvivorPickParams {
  tournamentId:    string
  gameId:          string
  predictedWinner: string | null
  roundNum:        number
  // C-06 FIX: Caller provides game IDs from their existing useGames()
  // cache. Eliminates the internal supabase.from('games') round-trip.
  // Also used here to construct the exact compound cache key for
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
    // C-04 FIX: mutationFn delegates entirely to the entity API layer.
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
      // Construct the exact compound key matching the useMyPicks observer.
      const exactKey = [...pickKeys.mine(tournamentId), gameIds] as const

      // cancelQueries uses prefix matching — base key reaches the observer.
      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })

      const prev = qc.getQueryData<Pick[]>(exactKey)

      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
        // Remove the existing pick for this game (covers toggle + replace).
        const withoutCurrent = old.filter((p: Pick) => p.game_id !== gameId)

        // A null predictedWinner signals a toggle-off — return the cleared state.
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
      // Restore snapshot to the exact compound key the optimistic write targeted.
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ctx.exactKey, ctx.prev)
      }
    },

    onSettled: (_data, _err, { tournamentId }) => {
      // C-05 FIX: onSettled fires on both success and error.
      // invalidateQueries uses prefix matching — base key covers compound variants.
      safeInvalidate(qc, pickKeys.mine(tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
    },
  })
}