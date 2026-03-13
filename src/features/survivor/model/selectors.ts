// src/features/survivor/model/selectors.ts

import type { Pick, Game } from '../../../shared/types'

/**
 * Reduces a user's picks into an array of used team names.
 * Prevents UI from allowing multiple selections of the same team across rounds.
 */
export function getUsedTeams(userPicks: Pick[]): string[] {
  return userPicks.map((pick) => pick.predicted_winner).filter(Boolean)
}

/**
 * Evaluates if a user has been eliminated.
 * A user is eliminated if ANY of their picked teams played a game and lost.
 */
export function getIsEliminated(userPicks: Pick[], games: Game[]): boolean {
  for (const pick of userPicks) {
    const game = games.find((g) => g.id === pick.game_id)
    
    // If the game has an actual winner and it does NOT match the pick, the user is eliminated.
    if (game && game.actual_winner && game.actual_winner !== pick.predicted_winner) {
      return true
    }
  }
  return false
}

/**
 * Calculates the aggregate seed score for tiebreaker scenarios.
 * Sums the seed value of the predicted winner for every pick made by the user.
 */
export function getAggregateSeedScore(userPicks: Pick[], games: Game[]): number {
  let score = 0

  for (const pick of userPicks) {
    const game = games.find((g) => g.id === pick.game_id)
    if (!game) continue

    if (pick.predicted_winner === game.team1_name && game.team1_seed) {
      score += game.team1_seed
    } else if (pick.predicted_winner === game.team2_name && game.team2_seed) {
      score += game.team2_seed
    }
  }

  return score
}