// src/features/survivor/model/selectors.ts
//
// BUG FIX (this PR): getUsedTeams now accepts `games` and decodes slot
// keys ('team1'/'team2') to actual team name strings before returning.
// Without decoding, usedTeams.includes(teamName) in SurvivorGameCard
// always returned false — burned teams appeared available to re-pick.
//
// BUG FIX (this PR): getIsEliminated's user-elimination detection loop
// now decodes slot keys before comparing against actual_winner, using
// isTeamMatch for case-insensitive normalization. Previously, comparing
// 'team1' against 'Duke' always yielded inequality, flagging every pick
// as wrong regardless of outcome.
//
// NEW: isEndEarlyResolved — determines whether the entire pool is dead
// under the 'end_early' rule. Used by BracketView/MatchupColumn and
// SurvivorBracketView to lock all participants out of future rounds
// when every active picker was eliminated in the same resolved round.
// This is data-derived (picks + games), never from tournament.status,
// so it cannot be accidentally triggered by an admin status write.

import { isTeamMatch }              from '../../../shared/lib/bracketMath'
import type { Pick, Game, Tournament } from '../../../shared/types'

// ── Internal helper ───────────────────────────────────────────

/**
 * Decodes a stored slot key ('team1'/'team2') to the resolved team name.
 * Falls through to the raw value for any pick that already stores a name.
 */
function decodePickedTeam(predictedWinner: string, game: Game): string {
  if (predictedWinner === 'team1') return game.team1_name
  if (predictedWinner === 'team2') return game.team2_name
  return predictedWinner
}

// ── Public API ────────────────────────────────────────────────

/**
 * Returns the set of team names this user has already committed to across
 * all rounds. Slot keys are decoded to team names so that string-matching
 * against game.team1_name / game.team2_name is correct.
 *
 * @param userPicks - The current user's picks for this tournament.
 * @param games     - All games for this tournament (required for decoding).
 */
export function getUsedTeams(userPicks: Pick[], games: Game[]): string[] {
  const gameMap = new Map(games.map(g => [g.id, g]))
  return userPicks
    .map(pick => {
      const game = gameMap.get(pick.game_id)
      if (!game || !pick.predicted_winner) return null
      return decodePickedTeam(pick.predicted_winner, game)
    })
    .filter((name): name is string => !!name)
}

/**
 * Returns aggregate seed score for display — sum of seeds of correctly-picked
 * teams. All seed values use Number() casting to prevent string concatenation.
 */
export function getAggregateSeedScore(userPicks: Pick[], games: Game[]): number {
  const gameMap = new Map(games.map(g => [g.id, g]))
  return userPicks.reduce((acc, pick) => {
    const game = gameMap.get(pick.game_id)
    if (!game?.actual_winner) return acc
    const decoded = decodePickedTeam(pick.predicted_winner, game)
    if (!isTeamMatch(decoded, game.actual_winner)) return acc
    const seed = pick.predicted_winner === 'team1' ? game.team1_seed : game.team2_seed
    return acc + (Number(seed) || 0)
  }, 0)
}

/**
 * Determines whether the current user is eliminated from a survivor pool.
 *
 * For the 'end_early' rule, returns true the moment any pick is wrong.
 * For 'revive_all', returns false if every other active participant was
 * also eliminated in the same round (mass elimination = mass revival).
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
  const gameMap = new Map(games.map(g => [g.id, g]))

  // Find the earliest round in which this user lost a pick.
  let userFirstElimRound: number | null = null

  for (const pick of userPicks) {
    const game = gameMap.get(pick.game_id)
    if (!game?.actual_winner) continue

    // Decode slot key before comparison — raw 'team1'/'team2' never
    // matches an actual winner name like 'Duke'.
    const decoded = decodePickedTeam(pick.predicted_winner, game)

    if (!isTeamMatch(decoded, game.actual_winner)) {
      if (userFirstElimRound === null || game.round_num < userFirstElimRound) {
        userFirstElimRound = game.round_num
      }
    }
  }

  // User has not lost any pick — still alive.
  if (userFirstElimRound === null) return false

  // User is out under the default rule.
  if (tournament.survivor_elimination_rule !== 'revive_all') return true

  // ── REVIVE_ALL check ────────────────────────────────────────
  // Evaluate whether the elimination round was a mass-elimination event.
  const eliminationRound = userFirstElimRound
  const roundGames = games.filter(g => g.round_num === eliminationRound)

  // Cannot confirm a mass revival if the round is not fully resolved.
  if (!roundGames.every(g => !!g.actual_winner)) return true

  const roundGameIds = new Set(roundGames.map(g => g.id))

  // Build per-player loss data, skipping users already eliminated in prior rounds.
  const priorEliminated = new Set<string>()
  const activePickers   = new Set<string>()
  const lostThisRound   = new Set<string>()

  // First pass: find who was already out before this round.
  for (const pick of allPicks) {
    const game = gameMap.get(pick.game_id)
    if (!game?.actual_winner || game.round_num >= eliminationRound) continue
    const decoded = decodePickedTeam(pick.predicted_winner, game)
    if (!isTeamMatch(decoded, game.actual_winner)) {
      priorEliminated.add(pick.user_id)
    }
  }

  // Second pass: evaluate this round for non-prior-eliminated pickers.
  for (const pick of allPicks) {
    if (!roundGameIds.has(pick.game_id)) continue
    if (priorEliminated.has(pick.user_id)) continue

    activePickers.add(pick.user_id)

    const game    = gameMap.get(pick.game_id)!
    const decoded = decodePickedTeam(pick.predicted_winner, game)
    if (!isTeamMatch(decoded, game.actual_winner ?? '')) {
      lostThisRound.add(pick.user_id)
    }
  }

  // Mass revival: every active picker was eliminated in the same round.
  if (activePickers.size > 0 && lostThisRound.size === activePickers.size) return false

  return true
}

/**
 * Returns true when the 'end_early' rule applies AND every active
 * participant was eliminated in the most recently fully-resolved round.
 *
 * This is the data-derived "pool is over" signal for the lock gate in
 * BracketView and SurvivorBracketView. It must NEVER be derived from
 * tournament.status to avoid the admin-status-write false-lock bug.
 *
 * When this returns true, the entire pool is dead — including any user
 * who happened to survive previous rounds. No further picks are valid.
 *
 * @param allPicks   - All participants' picks for this tournament.
 * @param games      - All games for this tournament.
 * @param tournament - The tournament being evaluated.
 */
export function isEndEarlyResolved(
  allPicks:   Pick[],
  games:      Game[],
  tournament: Tournament,
): boolean {
  if (tournament.survivor_elimination_rule !== 'end_early') return false

  const gameMap = new Map(games.map(g => [g.id, g]))

  // Find the highest fully-resolved round.
  const resolvedRoundNums = [...new Set(
    games.filter(g => !!g.actual_winner).map(g => g.round_num),
  )]
  if (resolvedRoundNums.length === 0) return false

  const latestResolved = Math.max(...resolvedRoundNums)
  const roundGames     = games.filter(g => g.round_num === latestResolved)

  // The round must be 100% resolved — a partial round cannot confirm mass elimination.
  if (!roundGames.every(g => !!g.actual_winner)) return false

  const roundGameIds = new Set(roundGames.map(g => g.id))

  // Track who was already eliminated before this round.
  const priorEliminated = new Set<string>()
  for (const pick of allPicks) {
    const game = gameMap.get(pick.game_id)
    if (!game?.actual_winner || game.round_num >= latestResolved) continue
    const decoded = decodePickedTeam(pick.predicted_winner, game)
    if (!isTeamMatch(decoded, game.actual_winner)) {
      priorEliminated.add(pick.user_id)
    }
  }

  const activePickers    = new Set<string>()
  const eliminatedLatest = new Set<string>()

  for (const pick of allPicks) {
    if (!roundGameIds.has(pick.game_id)) continue
    if (priorEliminated.has(pick.user_id)) continue

    activePickers.add(pick.user_id)

    const game    = gameMap.get(pick.game_id)!
    const decoded = decodePickedTeam(pick.predicted_winner, game)
    if (!isTeamMatch(decoded, game.actual_winner ?? '')) {
      eliminatedLatest.add(pick.user_id)
    }
  }

  return activePickers.size > 0 && eliminatedLatest.size === activePickers.size
}