// src/features/leaderboard/model/selectors.ts
import { resolveScore } from '../../../shared/lib/bracketMath'
import type { Pick, Game, Profile, Tournament } from '../../../shared/types'

export interface LeaderboardEntry {
  profile:     Profile
  points:      number
  correct:     number
  total:       number
  maxPossible: number
}

/**
 * Pure function — no React, no hooks.
 * Respects per-tournament scoring_config, falls back to Fibonacci via resolveScore().
 *
 * @param allPicks      - Every pick across all users
 * @param filteredGames - Games scoped to the selected tournament filter
 * @param allGames      - All games (needed for elimination checks)
 * @param allProfiles   - Every user profile
 * @param tournamentMap - tournament_id → Tournament (for scoring_config lookup)
 */
export function computeLeaderboard(
  allPicks:      Pick[],
  filteredGames: Game[],
  allGames:      Game[],
  allProfiles:   Profile[],
  tournamentMap: Map<string, Tournament>,
): LeaderboardEntry[] {
  const scores: Record<string, LeaderboardEntry> = {}

  allProfiles.forEach(p => {
    scores[p.id] = { profile: p, points: 0, correct: 0, total: 0, maxPossible: 0 }
  })

  const gameMap = new Map(filteredGames.map(g => [g.id, g]))

  allPicks.forEach(pick => {
    if (!scores[pick.user_id]) return
    const game = gameMap.get(pick.game_id)
    if (!game) return

    const tournament = tournamentMap.get(game.tournament_id)
    const pointValue = resolveScore(game.round_num, tournament?.scoring_config)
    const entry      = scores[pick.user_id]

    entry.total++

    if (game.actual_winner) {
      if (game.actual_winner === pick.predicted_winner) {
        entry.points  += pointValue
        entry.correct += 1
      }
    } else {
      // Pick is alive if predicted team hasn't been eliminated yet
      const isEliminated = allGames.some(
        g =>
          g.actual_winner &&
          g.actual_winner !== pick.predicted_winner &&
          (g.team1_name === pick.predicted_winner || g.team2_name === pick.predicted_winner),
      )
      if (!isEliminated) entry.maxPossible += pointValue
    }
  })

  // maxPossible accumulates on top of already-earned points
  Object.values(scores).forEach(s => { s.maxPossible += s.points })

  return Object.values(scores).sort(
    (a, b) => b.points - a.points || b.correct - a.correct,
  )
}
