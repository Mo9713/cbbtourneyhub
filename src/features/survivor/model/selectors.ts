// src/features/survivor/model/selectors.ts
//
// C-03 FIX: getIsEliminated now accepts allPicks and tournament to
// correctly evaluate the revive_all elimination rule.
//
// When survivor_elimination_rule === 'revive_all', a user who lost their
// pick is NOT considered eliminated if every other active participant also
// lost their pick in the same round (mass elimination = mass revival).
//
// All seed values continue to use Number() casting to prevent string
// concatenation bugs (e.g. "8" + "1" = "81" vs 8 + 1 = 9).

import type { Pick, Game, Tournament } from '../../../shared/types'

export function getUsedTeams(userPicks: Pick[]): string[] {
  return userPicks.map((pick) => pick.predicted_winner).filter(Boolean)
}

/**
 * Determines whether the current user is eliminated from a survivor pool.
 *
 * For the default 'end_early' rule, returns true the moment any of the
 * user's picks is wrong. For 'revive_all', returns false if every other
 * active participant was also eliminated in the same round.
 *
 * @param userPicks  - The current user's picks for this tournament.
 * @param games      - All games for this tournament.
 * @param allPicks   - All participants' picks (required for revive_all).
 * @param tournament - The tournament being evaluated.
 */
export function getIsEliminated(
  userPicks:  Pick[],
  games:      Game[],
  allPicks:   Pick[],
  tournament: Tournament,
): boolean {
  // Find the earliest round in which this user lost a pick.
  let userFirstElimRound: number | null = null

  for (const pick of userPicks) {
    const game = games.find(g => g.id === pick.game_id)
    if (!game?.actual_winner) continue

    const actual    = game.actual_winner.trim().toLowerCase()
    const predicted = pick.predicted_winner?.trim().toLowerCase()

    if (actual !== predicted) {
      if (userFirstElimRound === null || game.round_num < userFirstElimRound) {
        userFirstElimRound = game.round_num
      }
    }
  }

  // User has not lost any pick — still alive.
  if (userFirstElimRound === null) return false

  // User is out on the default rule.
  if (tournament.survivor_elimination_rule !== 'revive_all') return true

  // ── REVIVE_ALL check ────────────────────────────────────────
  // Evaluate whether the elimination round was a mass-elimination event.
  const eliminationRound = userFirstElimRound
  const roundGames = games.filter(g => g.round_num === eliminationRound)

  // If the round is not fully resolved, we cannot confirm a mass revival.
  if (!roundGames.every(g => !!g.actual_winner)) return true

  const roundGameIds = new Set(roundGames.map(g => g.id))

  // Map players to their picks in this round (excluding already-eliminated players).
  // "Already eliminated" = lost in a round BEFORE this one.
  const earlierLosers = new Set<string>()
  for (const pick of allPicks) {
    const game = games.find(g => g.id === pick.game_id)
    if (!game?.actual_winner) continue
    if (game.round_num >= eliminationRound) continue
    if (game.actual_winner.trim().toLowerCase() !== pick.predicted_winner?.trim().toLowerCase()) {
      earlierLosers.add(pick.user_id)
    }
  }

  // Gather the set of active pickers in this round and who among them lost.
  const activePickersThisRound  = new Set<string>()
  const eliminatedThisRound     = new Set<string>()

  for (const pick of allPicks) {
    if (!roundGameIds.has(pick.game_id))  continue
    if (earlierLosers.has(pick.user_id)) continue

    activePickersThisRound.add(pick.user_id)

    const game = roundGames.find(g => g.id === pick.game_id)!
    const actual    = game.actual_winner!.trim().toLowerCase()
    const predicted = pick.predicted_winner?.trim().toLowerCase()

    if (actual !== predicted) {
      eliminatedThisRound.add(pick.user_id)
    }
  }

  // Mass elimination: every active picker lost → everyone is revived.
  if (
    activePickersThisRound.size > 0 &&
    eliminatedThisRound.size === activePickersThisRound.size
  ) {
    return false
  }

  return true
}

/**
 * Calculates the aggregate seed score for tiebreaker scenarios.
 * Uses strict Number() casting to guarantee mathematical addition
 * (e.g., 8 seed + 1 seed = 9 points) instead of string concatenation.
 */
export function getAggregateSeedScore(userPicks: Pick[], games: Game[]): number {
  let score = 0

  for (const pick of userPicks) {
    const game = games.find(g => g.id === pick.game_id)
    if (!game) continue

    if (pick.predicted_winner === game.team1_name && game.team1_seed) {
      score += Number(game.team1_seed) || 0
    } else if (pick.predicted_winner === game.team2_name && game.team2_seed) {
      score += Number(game.team2_seed) || 0
    }
  }

  return score
}