// src/features/survivor/model/useSurvivorPickMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/infra/supabaseClient'

interface PickParams {
  tournamentId: string
  gameId: string
  predictedWinner: string | null
  roundNum: number
}

export function useMakeSurvivorPickMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ tournamentId, gameId, predictedWinner, roundNum }: PickParams) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      // 1. Fetch game IDs for the tournament to scope the deletion safely
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('id')
        .eq('tournament_id', tournamentId)

      if (gamesError) throw new Error(gamesError.message)
      const gameIds = games?.map(g => g.id) || []

      // 2. Delete any existing pick for this specific round (Enforce 1 pick per round)
      if (gameIds.length > 0) {
        await supabase.from('picks')
          .delete()
          .eq('user_id', user.id)
          .eq('round_num', roundNum)
          .in('game_id', gameIds)
      }

      // 3. Insert new pick (if predictedWinner is null, it just acts as a clear/toggle-off)
      if (predictedWinner) {
        const { error: insertError } = await supabase.from('picks').insert({
          user_id: user.id,
          game_id: gameId,
          predicted_winner: predictedWinner,
          round_num: roundNum
        })
        if (insertError) throw new Error(insertError.message)
      }
    },
    onSuccess: () => {
      // Invalidate all picks to instantly refresh the UI state
      qc.invalidateQueries({ queryKey: ['picks'] })
    }
  })
}