import { useMemo } from 'react'
import { useGames } from './queries'
import { useMyPicks } from '../../pick/model/queries'
import { getActiveSurvivorRound } from '../../../shared/lib/time'
import { deriveEffectiveNames, deriveChampion } from '../../../shared/lib/bracketMath'
import type { Tournament } from '../../../shared/types'

export interface TournamentProgress {
  requiredPicks: number
  currentPicks: number
  percent: number
  isComplete: boolean
  pickLabel: string
  pickTeamName: string | null
}

/**
 * Encapsulates the complex domain math of calculating a user's progress
 * through a tournament (Standard vs Survivor).
 */
export function useTournamentProgress(tournament: Tournament): TournamentProgress {
  const { data: games = [] } = useGames(tournament.id)
  const { data: picks = [] } = useMyPicks(tournament.id, games)

  return useMemo(() => {
    const isSurvivor = tournament.game_type === 'survivor'
    const activeRound = isSurvivor ? getActiveSurvivorRound(tournament) : 0

    let requiredPicks = isSurvivor ? 1 : (games.length || 63)
    let currentPicks = 0
    let pickLabel = isSurvivor ? 'Current Round Pick' : 'Champion Pick'
    let pickTeamName: string | null = null

    if (isSurvivor) {
      if (activeRound > 0) {
        const pick = picks.find(p => {
          const g = games.find(game => game.id === p.game_id)
          return g?.round_num === activeRound
        })
        currentPicks = pick ? 1 : 0

        if (pick) {
          const g = games.find(game => game.id === pick.game_id)
          if (g) {
            pickTeamName =
              pick.predicted_winner === 'team1' ? g.team1_name :
              pick.predicted_winner === 'team2' ? g.team2_name :
              pick.predicted_winner
          }
        }
      }
    } else {
      currentPicks = picks.length
      if (games.length > 0) {
        const effectiveNames = deriveEffectiveNames(games, picks)
        pickTeamName = deriveChampion(games, picks, effectiveNames)
      }
    }

    const isComplete = currentPicks >= requiredPicks
    const percent = requiredPicks > 0 ? Math.min(100, Math.round((currentPicks / requiredPicks) * 100)) : 0

    return {
      requiredPicks,
      currentPicks,
      percent,
      isComplete,
      pickLabel,
      pickTeamName
    }
  }, [tournament, games, picks])
}