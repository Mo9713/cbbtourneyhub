// src/features/leaderboard/model/selectors.ts
//
// FIX: allGames is now scoped to the active tournamentMap inside
// this function. This prevents teams from a different tournament (e.g.,
// "Duke" losing in a global tournament) from incorrectly marking that
// team as eliminated in the maxPossible calculation of an unrelated
// private group context.
//
// FIX: survivor_elimination_rule === 'revive_all' is now evaluated.
// After the primary scoring pass, a second pass iterates over every
// completed round in each revive_all survivor tournament. If ALL active
// players lost picks in the same round (mass elimination), every player's
// elimination flag is cleared for that tournament — implementing the
// revival mechanic. Per-round tracking is enabled via the new
// _firstElimRoundByTid internal field.

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

interface InternalEntry extends LeaderboardEntry {
  // Tracks which survivor tournament IDs a user has been eliminated from.
  _eliminatedInSurvivorTids: Set<string>
  // Tracks the first round in which a user was eliminated per tournament.
  // Required by the revive_all post-processing pass.
  _firstElimRoundByTid:      Map<string, number>
}

export function computeLeaderboard(
  allPicks:      Pick[],
  filteredGames: Game[],
  allGames:      Game[],
  allProfiles:   Profile[],
  tournamentMap: Map<string, Tournament>,
): LeaderboardEntry[] {

  // C-02: Scope the elimination-check corpus to only games belonging to
  // the active tournament context. allGames may contain the full global
  // dataset; filtering it here prevents teams eliminated in unrelated
  // tournaments from corrupting maxPossible calculations.
  const contextTournamentIds = new Set(tournamentMap.keys())
  const scopedAllGames       = allGames.filter(g => contextTournamentIds.has(g.tournament_id))

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
      _firstElimRoundByTid:      new Map(),
    }
  })

  const filteredGameMap = new Map(filteredGames.map(g => [g.id, g]))

  // ── PRIMARY SCORING PASS ──────────────────────────────────
  allPicks.forEach(pick => {
    const entry = scores[pick.user_id]
    if (!entry) return

    const game = filteredGameMap.get(pick.game_id)
    if (!game)  return

    const tournament = tournamentMap.get(game.tournament_id)

    // ── SURVIVOR MODE ────────────────────────────────────────
    if (tournament?.game_type === 'survivor') {
      entry.total++

      // Seed addition uses strict Number() cast to prevent string
      // concatenation (e.g. "8" + "1" = "81" vs 8 + 1 = 9).
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
          // Track the earliest round in which this user was eliminated
          // for this tournament — required by revive_all post-processing.
          const prev = entry._firstElimRoundByTid.get(game.tournament_id)
          if (prev === undefined || game.round_num < prev) {
            entry._firstElimRoundByTid.set(game.tournament_id, game.round_num)
          }
        }
      }
      return
    }

    // ── STANDARD BRACKET MODE ────────────────────────────────
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
      if (!pWin) return

      // Uses scopedAllGames — not the raw global allGames — so only
      // results from the active tournament set influence elimination status.
      const teamEliminated = scopedAllGames.some(g => {
        if (!g.actual_winner) return false
        const aWin = g.actual_winner.trim().toLowerCase()
        const t1   = g.team1_name.trim().toLowerCase()
        const t2   = g.team2_name.trim().toLowerCase()
        return aWin !== pWin && (t1 === pWin || t2 === pWin)
      })
      if (!teamEliminated) entry.maxPossible += pointValue
    }
  })

  // maxPossible includes already-earned points.
  Object.values(scores).forEach(s => { s.maxPossible += s.points })

  // ──REVIVE_ALL POST-PROCESSING PASS──────────────────────────────
  // For each survivor tournament with the revive_all rule, check each
  // completed round (all games have actual_winner). If every active
  // player (not eliminated before this round) who picked in this round
  // was eliminated in this round, it is a mass-elimination event and all
  // elimination flags for that round are cleared.
  for (const [tid, tournament] of tournamentMap.entries()) {
    if (tournament.game_type !== 'survivor')                  continue
    if (tournament.survivor_elimination_rule !== 'revive_all') continue

    const tournamentGames    = filteredGames.filter(g => g.tournament_id === tid)
    const allTournamentPicks = allPicks.filter(p =>
      tournamentGames.some(g => g.id === p.game_id),
    )

    // Build a round → games map, sorted ascending.
    const gamesByRound = new Map<number, Game[]>()
    for (const g of tournamentGames) {
      const existing = gamesByRound.get(g.round_num) ?? []
      gamesByRound.set(g.round_num, [...existing, g])
    }
    const sortedRounds = [...gamesByRound.entries()].sort(([a], [b]) => a - b)

    // cumulativeEliminated tracks users confirmed out from previous rounds.
    const cumulativeEliminated = new Set<string>()

    // FIX: Used _round to satisfy TypeScript's unused variable rule
    for (const [_round, roundGames] of sortedRounds) {
      // Only evaluate rounds where every game has a confirmed result.
      if (!roundGames.every(g => !!g.actual_winner)) break

      const roundGameIds = new Set(roundGames.map(g => g.id))

      // Gather players who actively picked in this round and were still alive.
      const activePickers       = new Set<string>()
      const eliminatedThisRound = new Set<string>()

      for (const pick of allTournamentPicks) {
        if (!roundGameIds.has(pick.game_id))       continue
        if (cumulativeEliminated.has(pick.user_id)) continue

        activePickers.add(pick.user_id)

        const game    = roundGames.find(g => g.id === pick.game_id)!
        const actual  = game.actual_winner!.trim().toLowerCase()
        const predicted = pick.predicted_winner?.trim().toLowerCase()

        if (actual !== predicted) {
          eliminatedThisRound.add(pick.user_id)
        }
      }

      if (activePickers.size > 0 && eliminatedThisRound.size === activePickers.size) {
        // MASS ELIMINATION — revive everyone eliminated this round.
        for (const uid of eliminatedThisRound) {
          scores[uid]?._eliminatedInSurvivorTids.delete(tid)
          scores[uid]?._firstElimRoundByTid.delete(tid)
        }
        // Revived players do NOT carry forward into cumulativeEliminated.
      } else {
        // Normal round — confirmed eliminations are permanent.
        for (const uid of eliminatedThisRound) {
          cumulativeEliminated.add(uid)
        }
      }
    }
  }

  // ── DETERMINE ELIMINATION DISPLAY MODE ───────────────────
  const viewSurvivorTids = new Set<string>()
  const viewStandardTids = new Set<string>()

  filteredGames.forEach(g => {
    const t = tournamentMap.get(g.tournament_id)
    if (t?.game_type === 'survivor') viewSurvivorTids.add(g.tournament_id)
    else viewStandardTids.add(g.tournament_id)
  })

  // Elimination badges only render when viewing a pure survivor context.
  const eliminationApplies = viewSurvivorTids.size > 0 && viewStandardTids.size === 0

  const entries = Object.values(scores).map((internalEntry): LeaderboardEntry => {
    // Strip internal fields before returning public shape.
    const { _eliminatedInSurvivorTids, _firstElimRoundByTid, ...publicEntry } = internalEntry

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
    if (b.points       !== a.points)       return b.points - a.points
    if (b.seedScore    !== a.seedScore)     return b.seedScore - a.seedScore
    return b.correct - a.correct
  })
}