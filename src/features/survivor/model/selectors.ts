// src/features/survivor/model/selectors.ts
//
// AUDIT STATUS: COMPLIANT — No changes required.
// All seed values are cast with Number() before arithmetic to prevent
// string concatenation bugs (e.g. "8" + "1" = "81" vs 8 + 1 = 9).
// The || 0 fallback handles NaN from non-numeric seeds.

import type { Pick, Game } from '../../../shared/types'

export function getUsedTeams(userPicks: Pick[]): string[] {
  return userPicks.map((pick) => pick.predicted_winner).filter(Boolean)
}

export function getIsEliminated(userPicks: Pick[], games: Game[]): boolean {
  for (const pick of userPicks) {
    const game = games.find((g) => g.id === pick.game_id)

    if (game && game.actual_winner) {
      const actual    = game.actual_winner.trim().toLowerCase()
      const predicted = pick.predicted_winner?.trim().toLowerCase()

      if (actual !== predicted) {
        return true
      }
    }
  }
  return false
}

/**
 * Calculates the aggregate seed score for tiebreaker scenarios.
 * Uses strict Number() casting to guarantee mathematical addition
 * (e.g., 8 seed + 1 seed = 9 points) instead of string concatenation.
 */
export function getAggregateSeedScore(userPicks: Pick[], games: Game[]): number {
  let score = 0

  for (const pick of userPicks) {
    const game = games.find((g) => g.id === pick.game_id)
    if (!game) continue

    if (pick.predicted_winner === game.team1_name && game.team1_seed) {
      score += Number(game.team1_seed) || 0
    } else if (pick.predicted_winner === game.team2_name && game.team2_seed) {
      score += Number(game.team2_seed) || 0
    }
  }

  return score
}