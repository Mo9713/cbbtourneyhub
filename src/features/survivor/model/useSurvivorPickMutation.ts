import { useMutation, useQueryClient } from '@tanstack/react-query'

import { safeInvalidate }  from '../../../shared/lib/queryUtils'
import {
  deleteSurvivorPickForRound,
  saveSurvivorPick,
}                          from '../../../entities/pick/api'
import { pickKeys }        from '../../../entities/pick/model/queries'
import type { Pick }       from '../../../shared/types'

export interface SurvivorPickParams {
  tournamentId:      string
  gameId:            string
  predictedWinner:   string | null
  roundNum:          number
  tournamentGameIds: string[]
  roundGameIds:      string[]
  overrideUserId?:   string
}

type SurvivorContext = {
  prev:     Pick[] | undefined
  exactKey: readonly unknown[]
  prevRaw:  any | undefined
}

export function useMakeSurvivorPickMutation() {
  const qc = useQueryClient()

  return useMutation<Pick | null, Error, SurvivorPickParams, SurvivorContext>({
    mutationFn: async ({
      gameId,
      predictedWinner,
      roundNum,
      roundGameIds,
      overrideUserId,
    }: SurvivorPickParams): Promise<Pick | null> => {
      // FIX: Removed 'roundNum' from this call to match the updated API signature (2 arguments instead of 3)
      const deleteResult = await deleteSurvivorPickForRound(roundGameIds, overrideUserId)
      if (!deleteResult.ok) throw new Error(deleteResult.error)

      // 2. Save new pick (Using Admin Override if present)
      if (predictedWinner) {
        const saveResult = await saveSurvivorPick(gameId, predictedWinner, roundNum, overrideUserId)
        if (!saveResult.ok) throw new Error(saveResult.error)
        return saveResult.data as unknown as Pick
      }

      return null
    },

    onMutate: async ({ tournamentId, gameId, predictedWinner, roundNum, tournamentGameIds, roundGameIds, overrideUserId }): Promise<SurvivorContext> => {
      const exactKey = [...pickKeys.mine(tournamentId), tournamentGameIds] as const
      await qc.cancelQueries({ queryKey: pickKeys.mine(tournamentId) })
      const prev = qc.getQueryData<Pick[]>(exactKey)

      const rawKey = ['leaderboard', 'raw'] as const
      await qc.cancelQueries({ queryKey: rawKey })
      const prevRaw = qc.getQueryData<any>(rawKey)

      // 1. Optimistic Update for standard "My Picks" Cache
      qc.setQueryData<Pick[]>(exactKey, (old = []) => {
        const withoutRound = old.filter(
          (p: Pick) => !roundGameIds.includes(p.game_id),
        )

        if (!predictedWinner) return withoutRound

        const optimistic: Pick = {
          id:               'optimistic-survivor-' + Date.now(),
          user_id:          overrideUserId || 'me',
          game_id:          gameId,
          predicted_winner: predictedWinner,
          tiebreaker_score: null,
          round_num:        roundNum,
        }
        return [...withoutRound, optimistic]
      })

      // 2. Optimistic Update for global "Leaderboard Raw" Cache (Fixes SnoopModal delay)
      if (overrideUserId) {
        qc.setQueryData<any>(rawKey, (old: any) => {
          if (!old) return old
          
          const withoutRound = old.allPicks.filter(
            (p: Pick) => !(p.user_id === overrideUserId && roundGameIds.includes(p.game_id))
          )

          if (!predictedWinner) return { ...old, allPicks: withoutRound }

          const optimistic: Pick = {
            id: 'opt-surv-' + Date.now(),
            user_id: overrideUserId,
            game_id: gameId,
            predicted_winner: predictedWinner,
            tiebreaker_score: null,
            round_num: roundNum,
          }
          return { ...old, allPicks: [...withoutRound, optimistic] }
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

    onSettled: (_data, _err, { tournamentId }) => {
      safeInvalidate(qc, pickKeys.mine(tournamentId))
      safeInvalidate(qc, pickKeys.allMine())
      safeInvalidate(qc, ['leaderboard', 'raw']) 
    },
  })
}