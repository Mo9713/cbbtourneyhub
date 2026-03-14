// src/features/survivor/model/useSurvivorPickMutation.ts

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  deleteSurvivorPickForRound,
  saveSurvivorPick,
} from '../../../entities/pick/api'
import { pickKeys } from '../../../entities/pick/model/queries'
import type { Pick } from '../../../shared/types'

// Mirrors the safeInvalidate pattern from entities/tournament and
// entities/pick. All three are candidates for extraction to
// shared/lib/queryUtils.ts alongside the unwrap helper (N-09).
function safeInvalidate(qc: QueryClient, queryKey: readonly unknown[]): void {
  if (qc.isMutating() > 0) {
    setTimeout(() => void qc.invalidateQueries({ queryKey }), 150)
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
  gameIds:         string[]
}

export function useMakeSurvivorPickMutation() {
  const qc = useQueryClient()

  return useMutation({
    // C-04 FIX: mutationFn delegates entirely to the entity API layer.
    // No raw supabase imports, no auth.getUser() calls here.
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
      // Only insert when a concrete team name is provided.
      if (predictedWinner) {
        const saveResult = await saveSurvivorPick(gameId, predictedWinner, roundNum)
        if (!saveResult.ok) throw new Error(saveResult.error)
        return saveResult.data as unknown as Pick
      }

      return null
    },

    // C-05 FIX: onSettled replaces onSuccess so invalidation fires on
    // both success and error. Targets precise keys via safeInvalidate —
    // replacing the ['picks'] broad blast that bypassed the debounce contract.
    onSettled: (_data, _err, { tournamentId }) => {
      safeInvalidate(qc, pickKeys.mine(tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
    },
  })
}