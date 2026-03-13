// src/features/leaderboard/model/selectors.ts

import { resolveScore } from '../../../shared/lib/bracketMath'
import type { Pick, Game, Profile, Tournament } from '../../../shared/types'

export interface LeaderboardEntry {
  profile:      Profile
  points:       number
  correct:      number
  total:        number
  maxPossible:  number
  isEliminated: boolean
  seedScore:    number
}

/**
 * Pure function — no React, no hooks.
 * Dynamically computes scoring matrices for either Standard or Survivor game types.
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
    scores[p.id] = { 
      profile: p, 
      points: 0, 
      correct: 0, 
      total: 0, 
      maxPossible: 0, 
      isEliminated: false, 
      seedScore: 0 
    }
  })

  const gameMap = new Map(filteredGames.map(g => [g.id, g]))

  allPicks.forEach(pick => {
    if (!scores[pick.user_id]) return
    const game = gameMap.get(pick.game_id)
    if (!game) return

    const tournament = tournamentMap.get(game.tournament_id)
    const entry      = scores[pick.user_id]
    
    // ── SURVIVOR MODE LOGIC ──
    if (tournament?.game_type === 'survivor') {
      entry.total++
      
      // Seed tiebreaker calculation (aggregating the seed of the team picked)
      if (pick.predicted_winner === game.team1_name && game.team1_seed) {
        entry.seedScore += game.team1_seed
      } else if (pick.predicted_winner === game.team2_name && game.team2_seed) {
        entry.seedScore += game.team2_seed
      }

      if (game.actual_winner) {
        if (game.actual_winner === pick.predicted_winner) {
          entry.points += 1  // Survivor gives 1 pt per correct pick
          entry.correct += 1
        } else {
          // If the game is finished and they didn't pick the winner, they are permanently eliminated
          entry.isEliminated = true
        }
      }
      return
    }

    // ── STANDARD BRACKET LOGIC ──
    const pointValue = resolveScore(game.round_num, tournament?.scoring_config)
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

  // maxPossible accumulates on top of already-earned points (only for standard brackets)
  Object.values(scores).forEach(s => { s.maxPossible += s.points })

  return Object.values(scores).sort((a, b) => {
    // 1. Survivor Elimination Check (Active players inherently outrank eliminated ones)
    if (a.isEliminated && !b.isEliminated) return 1
    if (!a.isEliminated && b.isEliminated) return -1
    
    // 2. Primary Points
    if (b.points !== a.points) return b.points - a.points
    
    // 3. Survivor Tiebreaker (Seed Score - higher is better)
    if (b.seedScore !== a.seedScore) return b.seedScore - a.seedScore
    
    // 4. Standard Tiebreaker (Correct Picks)
    return b.correct - a.correct
  })
}