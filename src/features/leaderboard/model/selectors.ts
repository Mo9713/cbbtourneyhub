// src/features/leaderboard/model/selectors.ts
//
// Pure computation — no React, no hooks, no side-effects.
//
// ── C-08 Fix: Scoped Survivor Elimination ─────────────────────────────────
//
// The original bug: `entry.isEliminated = true` was written directly onto
// the shared LeaderboardEntry the moment any survivor pick lost. This meant
// a user eliminated from a Survivor pool ranked last globally, even when
// the leaderboard simultaneously showed Standard bracket scores where they
// were leading.
//
// The fix introduces a private side-map `survivorEliminationsByUser` that
// records which specific Survivor tournament IDs have eliminated each user.
// After the accumulation pass, the view's composition is derived from
// `filteredGames` and the final `isEliminated` value is resolved under
// three mutually-exclusive rules:
//
//   1. Standard-only view  → isEliminated = false (never relevant)
//   2. Mixed view          → isEliminated = false (suppressed — Survivor
//                            elimination must not penalise Standard ranking)
//   3. Survivor-only view  → isEliminated = true  if and only if the user
//                            was eliminated in EVERY Survivor tournament
//                            present in the current filter
//
// The public LeaderboardEntry interface is unchanged; no consumer requires
// an update.
// ─────────────────────────────────────────────────────────────────────────

import { resolveScore } from '../../../shared/lib/bracketMath'
import type { Pick, Game, Profile, Tournament } from '../../../shared/types'

// ── Public interface ──────────────────────────────────────────────────────

export interface LeaderboardEntry {
  profile:      Profile
  points:       number
  correct:      number
  total:        number
  maxPossible:  number
  isEliminated: boolean
  seedScore:    number
}

// ── Internal accumulation type ────────────────────────────────────────────
//
// Extends the public entry with a private set that tracks which specific
// Survivor tournament IDs have eliminated this user during the current
// computation pass. It is stripped before the array is returned.

interface InternalEntry extends LeaderboardEntry {
  _eliminatedInSurvivorTids: Set<string>
}

// ── Core selector ─────────────────────────────────────────────────────────

/**
 * Computes ranked leaderboard entries from raw DB data.
 *
 * @param allPicks       - All picks from all users (unfiltered).
 * @param filteredGames  - Games scoped to the currently selected
 *                         tournaments. Determines which picks are scored
 *                         and defines the view composition for the
 *                         elimination scoping logic.
 * @param allGames       - All games across all tournaments. Required
 *                         by the Standard mode "is team still alive"
 *                         check, which must consider results outside the
 *                         current filter to correctly compute maxPossible.
 * @param allProfiles    - All user profiles (determines the full roster).
 * @param tournamentMap  - Lookup map from tournament ID → Tournament.
 */
export function computeLeaderboard(
  allPicks:      Pick[],
  filteredGames: Game[],
  allGames:      Game[],
  allProfiles:   Profile[],
  tournamentMap: Map<string, Tournament>,
): LeaderboardEntry[] {

  // ── Step 1: Initialise one internal entry per profile ─────────────────
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

  // ── Step 2: Build fast lookup from the filtered game set ───────────────
  const filteredGameMap = new Map(filteredGames.map(g => [g.id, g]))

  // ── Step 3: Accumulate scores across all picks ────────────────────────
  allPicks.forEach(pick => {
    const entry = scores[pick.user_id]
    if (!entry) return

    const game = filteredGameMap.get(pick.game_id)
    if (!game) return

    const tournament = tournamentMap.get(game.tournament_id)

    // ── SURVIVOR MODE ──────────────────────────────────────────────────
    if (tournament?.game_type === 'survivor') {
      entry.total++

      // Aggregate seed score for tiebreaker resolution.
      if (pick.predicted_winner === game.team1_name && game.team1_seed) {
        entry.seedScore += game.team1_seed
      } else if (pick.predicted_winner === game.team2_name && game.team2_seed) {
        entry.seedScore += game.team2_seed
      }

      if (game.actual_winner) {
        if (game.actual_winner === pick.predicted_winner) {
          entry.points  += 1   // Survivor: 1 pt per correct round pick
          entry.correct += 1
        } else {
          // C-08 FIX: Record the specific tournament that eliminated this
          // user instead of writing to the shared isEliminated flag directly.
          // The flag is resolved after accumulation under the scoping rules.
          entry._eliminatedInSurvivorTids.add(game.tournament_id)
        }
      }
      return
    }

    // ── STANDARD BRACKET MODE ─────────────────────────────────────────
    const pointValue = resolveScore(game.round_num, tournament?.scoring_config)
    entry.total++

    if (game.actual_winner) {
      if (game.actual_winner === pick.predicted_winner) {
        entry.points  += pointValue
        entry.correct += 1
      }
      // An incorrect result on a completed game contributes 0 — no action.
    } else {
      // Pick is still "alive" if the predicted team has not yet lost any
      // game in the full bracket. allGames is used here (not filteredGames)
      // so that results in other regions/rounds correctly knock out teams
      // even when those games are outside the current view filter.
      const teamEliminated = allGames.some(
        g =>
          g.actual_winner !== null &&
          g.actual_winner !== pick.predicted_winner &&
          (g.team1_name === pick.predicted_winner ||
           g.team2_name === pick.predicted_winner),
      )
      if (!teamEliminated) entry.maxPossible += pointValue
    }
  })

  // ── Step 4: Finalise maxPossible for Standard entries ─────────────────
  //
  // maxPossible represents the ceiling of achievable points: already-earned
  // points plus points still reachable via live picks. Adding `points` here
  // ensures Standard users who have scored are not shown as having zero max.
  Object.values(scores).forEach(s => { s.maxPossible += s.points })

  // ── Step 5: Derive view composition from filteredGames ────────────────
  //
  // The current filter determines whether elimination can meaningfully
  // affect sort order. We classify every tournament present in the
  // filtered game set as Survivor or Standard.
  const viewSurvivorTids = new Set<string>()
  const viewStandardTids = new Set<string>()

  filteredGames.forEach(g => {
    const t = tournamentMap.get(g.tournament_id)
    if (t?.game_type === 'survivor') {
      viewSurvivorTids.add(g.tournament_id)
    } else {
      viewStandardTids.add(g.tournament_id)
    }
  })

  // Elimination sort only applies when the current view is exclusively
  // Survivor tournaments. In a mixed view, suppressing the flag ensures
  // a Survivor loss cannot demote a user who is leading the Standard
  // bracket. In a Standard-only view the flag is never set anyway.
  const eliminationApplies =
    viewSurvivorTids.size > 0 && viewStandardTids.size === 0

  // ── Step 6: Resolve isEliminated per entry, then strip internal field ─
  const entries = Object.values(scores).map((internalEntry): LeaderboardEntry => {
    const {
      _eliminatedInSurvivorTids,
      ...publicEntry
    } = internalEntry

    if (eliminationApplies) {
      // A user is eliminated only if they lost in EVERY Survivor tournament
      // currently visible. Remaining active in at least one pool keeps them
      // ranked as a live participant.
      publicEntry.isEliminated = [...viewSurvivorTids].every(tid =>
        _eliminatedInSurvivorTids.has(tid),
      )
    } else {
      // Mixed or Standard-only view: elimination is always suppressed.
      publicEntry.isEliminated = false
    }

    return publicEntry
  })

  // ── Step 7: Sort ──────────────────────────────────────────────────────
  //
  // Priority chain:
  //   1. Active participants outrank eliminated ones (Survivor-only views).
  //   2. Total points descending.
  //   3. Seed score descending — higher accumulated seed = riskier picks
  //      rewarded (Survivor tiebreaker; harmlessly 0 in Standard views).
  //   4. Correct pick count descending (Standard bracket tiebreaker).
  return entries.sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) {
      return a.isEliminated ? 1 : -1
    }
    if (b.points !== a.points)     return b.points    - a.points
    if (b.seedScore !== a.seedScore) return b.seedScore - a.seedScore
    return b.correct - a.correct
  })
}