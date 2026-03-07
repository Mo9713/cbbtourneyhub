// src/services/leaderboardService.ts
// ─────────────────────────────────────────────────────────────
// Computes leaderboard standings. Lives in services (not a
// component utility) because it may eventually be replaced with
// a Supabase RPC / edge function for performance.
// ─────────────────────────────────────────────────────────────

import type { Pick, Game, Profile, Tournament, ScoringConfig } from '../types'
import { resolveScore } from '../types'

export interface LeaderboardEntry {
  profile:      Profile
  points:       number
  correct:      number
  total:        number
  maxPossible:  number
}

/**
 * Computes ranked leaderboard entries from raw data.
 *
 * Respects per-tournament scoring_config so custom point values are
 * used when present, falling back to Fibonacci otherwise.
 *
 * @param allPicks       - Every pick across all users
 * @param filteredGames  - Only games in the selected tournament scope
 * @param allGames       - ALL games (needed to check elimination status)
 * @param allProfiles    - Every user profile
 * @param tournamentMap  - Map of tournament_id → Tournament (for scoring_config)
 */
export function computeLeaderboard(
  allPicks:       Pick[],
  filteredGames:  Game[],
  allGames:       Game[],
  allProfiles:    Profile[],
  tournamentMap:  Map<string, Tournament>
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

    const tournament  = tournamentMap.get(game.tournament_id)
    const pointValue  = resolveScore(game.round_num, tournament?.scoring_config)
    const entry       = scores[pick.user_id]

    entry.total++

    if (game.actual_winner) {
      if (game.actual_winner === pick.predicted_winner) {
        entry.points  += pointValue
        entry.correct += 1
      }
    } else {
      // A pick is still alive if the predicted team hasn't been eliminated
      const isEliminated = allGames.some(
        g =>
          g.actual_winner &&
          g.actual_winner !== pick.predicted_winner &&
          (g.team1_name === pick.predicted_winner || g.team2_name === pick.predicted_winner)
      )
      if (!isEliminated) entry.maxPossible += pointValue
    }
  })

  // maxPossible includes already-earned points
  Object.values(scores).forEach(s => { s.maxPossible += s.points })

  return Object.values(scores).sort(
    (a, b) => b.points - a.points || b.correct - a.correct
  )
}