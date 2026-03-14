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
  seedScore:    number // Strict Number type for addition
}

interface InternalEntry extends LeaderboardEntry {
  _eliminatedInSurvivorTids: Set<string>
}

export function computeLeaderboard(
  allPicks:      Pick[],
  filteredGames: Game[],
  allGames:      Game[],
  allProfiles:   Profile[],
  tournamentMap: Map<string, Tournament>,
): LeaderboardEntry[] {
  const scores: Record<string, InternalEntry> = {}

  allProfiles.forEach(p => {
    scores[p.id] = {
      profile:      p,
      points:       0,
      correct:      0,
      total:        0,
      maxPossible:  0,
      isEliminated: false,
      seedScore:    0,
      _eliminatedInSurvivorTids: new Set(),
    }
  })

  const filteredGameMap = new Map(filteredGames.map(g => [g.id, g]))

  allPicks.forEach(pick => {
    const entry = scores[pick.user_id]
    if (!entry) return

    const game = filteredGameMap.get(pick.game_id)
    if (!game) return

    const tournament = tournamentMap.get(game.tournament_id)

    // ── SURVIVOR MODE ──────────────────────────────────────────────────
    if (tournament?.game_type === 'survivor') {
      entry.total++

      // Mathematical addition of seeds with strict Number cast
      if (pick.predicted_winner === game.team1_name && game.team1_seed) {
        entry.seedScore += Number(game.team1_seed) || 0
      } else if (pick.predicted_winner === game.team2_name && game.team2_seed) {
        entry.seedScore += Number(game.team2_seed) || 0
      }

      if (game.actual_winner) {
        const actual    = game.actual_winner.trim().toLowerCase()
        const predicted = pick.predicted_winner?.trim().toLowerCase()
        
        if (actual === predicted) {
          entry.points  += 1
          entry.correct += 1
        } else {
          entry._eliminatedInSurvivorTids.add(game.tournament_id)
        }
      }
      return
    }

    // ── STANDARD BRACKET MODE ─────────────────────────────────────────
    const pointValue = resolveScore(game.round_num, tournament?.scoring_config)
    entry.total++

    if (game.actual_winner) {
      const actual    = game.actual_winner.trim().toLowerCase()
      const predicted = pick.predicted_winner?.trim().toLowerCase()
      
      if (actual === predicted) {
        entry.points  += pointValue
        entry.correct += 1
      }
    } else {
      const pWin = pick.predicted_winner?.trim().toLowerCase()
      const teamEliminated = allGames.some(g => {
        if (!g.actual_winner) return false
        const aWin = g.actual_winner.trim().toLowerCase()
        const t1   = g.team1_name.trim().toLowerCase()
        const t2   = g.team2_name.trim().toLowerCase()
        return aWin !== pWin && (t1 === pWin || t2 === pWin)
      })
      if (!teamEliminated) entry.maxPossible += pointValue
    }
  })

  Object.values(scores).forEach(s => { s.maxPossible += s.points })

  const viewSurvivorTids = new Set<string>()
  const viewStandardTids = new Set<string>()

  filteredGames.forEach(g => {
    const t = tournamentMap.get(g.tournament_id)
    if (t?.game_type === 'survivor') viewSurvivorTids.add(g.tournament_id)
    else viewStandardTids.add(g.tournament_id)
  })

  const eliminationApplies = viewSurvivorTids.size > 0 && viewStandardTids.size === 0

  const entries = Object.values(scores).map((internalEntry): LeaderboardEntry => {
    const { _eliminatedInSurvivorTids, ...publicEntry } = internalEntry

    if (eliminationApplies) {
      publicEntry.isEliminated = [...viewSurvivorTids].every(tid =>
        _eliminatedInSurvivorTids.has(tid),
      )
    } else {
      publicEntry.isEliminated = false
    }

    return publicEntry
  })

  return entries.sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1
    if (b.points !== a.points) return b.points - a.points
    if (b.seedScore !== a.seedScore) return b.seedScore - a.seedScore
    return b.correct - a.correct
  })
}