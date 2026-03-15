// src/features/leaderboard/model/selectors.ts
//
// FIX M-NEW-2: tiebreakerScore added to LeaderboardEntry. The championship
// game pick's tiebreaker_score is now read and used in the sort chain for
// tournaments where requires_tiebreaker is true. Ranking is by closest
// absolute delta to the actual combined score (lower delta = better).
// Users who did not submit a tiebreaker, or whose game has not yet
// resolved scores, receive null delta and rank last in that tier.
//
// FIX M-NEW-3: revive_all mass-elimination evaluation now delegates to
// isMassRevivalRound from shared/lib/bracketMath. The duplicate inline
// implementation that previously lived here has been removed. This
// guarantees the leaderboard and the SurvivorGameCard elimination check
// use identical logic and cannot silently diverge.
//
// FIX N-NEW-2: seedScore is now accumulated for standard bracket picks,
// not only survivor picks. When a standard bracket pick is correct, the
// winner's seed (via effectiveNames) is added to the user's seedScore.
// This makes the seedScore tiebreaker tier meaningful for all game types.

import {
  deriveEffectiveNames,
  calculateLocalScore,
  isTeamMatch,
  isMassRevivalRound,
}                          from '../../../shared/lib/bracketMath'
import type { Pick, Game, Profile, Tournament } from '../../../shared/types'

export interface LeaderboardEntry {
  profile:         Profile
  points:          number
  correct:         number
  total:           number
  maxPossible:     number
  isEliminated:    boolean
  seedScore:       number
  // FIX M-NEW-2: User's predicted combined championship score, for display.
  // null when the tournament does not require a tiebreaker or the user
  // did not submit one.
  tiebreakerScore: number | null
}

interface InternalEntry extends LeaderboardEntry {
  _eliminatedInSurvivorTids: Set<string>
  _firstElimRoundByTid:      Map<string, number>
  // FIX M-NEW-2: Absolute delta |predicted - actual| for sort purposes.
  // null means tiebreaker is unavailable or the game has not resolved.
  _tiebreakerDelta:          number | null
}

export function computeLeaderboard(
  allPicks:      Pick[],
  filteredGames: Game[],
  _allGames:     Game[],
  allProfiles:   Profile[],
  tournamentMap: Map<string, Tournament>,
): LeaderboardEntry[] {

  const scores: Record<string, InternalEntry> = {}

  allProfiles.forEach(p => {
    scores[p.id] = {
      profile:                   p,
      points:                    0,
      correct:                   0,
      total:                     0,
      maxPossible:               0,
      isEliminated:              false,
      seedScore:                 0,
      tiebreakerScore:           null, // FIX M-NEW-2
      _eliminatedInSurvivorTids: new Set(),
      _firstElimRoundByTid:      new Map(),
      _tiebreakerDelta:          null, // FIX M-NEW-2
    }
  })

  const filteredGameMap = new Map(filteredGames.map(g => [g.id, g]))

  // ── PRIMARY SCORING PASS (Survivor Only) ──────────────────
  allPicks.forEach(pick => {
    const entry = scores[pick.user_id]
    if (!entry) return

    const game = filteredGameMap.get(pick.game_id)
    if (!game)  return

    const tournament = tournamentMap.get(game.tournament_id)

    if (tournament?.game_type !== 'survivor') return

    let predictedString = pick.predicted_winner
    const isT1 = predictedString === 'team1'
    const isT2 = predictedString === 'team2'

    if (isT1)      predictedString = game.team1_name
    else if (isT2) predictedString = game.team2_name

    entry.total++

    if (game.actual_winner) {
      if (isTeamMatch(predictedString, game.actual_winner)) {
        entry.points  += 1
        entry.correct += 1

        // Only add seed score for a correctly-picked team.
        if (isT1 && game.team1_seed) {
          entry.seedScore += Number(game.team1_seed) || 0
        } else if (isT2 && game.team2_seed) {
          entry.seedScore += Number(game.team2_seed) || 0
        }

      } else {
        entry._eliminatedInSurvivorTids.add(game.tournament_id)
        const prev = entry._firstElimRoundByTid.get(game.tournament_id)
        if (prev === undefined || game.round_num < prev) {
          entry._firstElimRoundByTid.set(game.tournament_id, game.round_num)
        }
      }
    }
  })

  // ── SECONDARY SCORING PASS (Standard Brackets) ────────────────
  const picksByUser = new Map<string, Pick[]>()
  for (const p of allPicks) {
    const arr = picksByUser.get(p.user_id) ?? []
    arr.push(p)
    picksByUser.set(p.user_id, arr)
  }

  for (const [uid, internalEntry] of Object.entries(scores)) {
    const uPicks = picksByUser.get(uid) ?? []

    for (const [tid, tournament] of tournamentMap.entries()) {
      if (tournament.game_type === 'survivor') continue

      const tGames = filteredGames.filter(g => g.tournament_id === tid)
      const tPicks = uPicks.filter(p => tGames.some(g => g.id === p.game_id))

      internalEntry.total += tPicks.length

      const effNames = deriveEffectiveNames(tGames, tPicks)
      const s        = calculateLocalScore(tGames, tPicks, effNames, tournament)

      internalEntry.points     += s.current
      internalEntry.maxPossible += s.max

      for (const pick of tPicks) {
        const game = tGames.find(g => g.id === pick.game_id)
        if (game?.actual_winner) {
          let pStr      = pick.predicted_winner
          const eff     = effNames[game.id]
          // FIX N-NEW-2: Capture the winner seed alongside the pick string
          // so we can accumulate seedScore for standard bracket correct picks.
          let winnerSeed: number | null = null

          if (eff) {
            if (pStr === 'team1') {
              pStr       = eff.team1.predicted
              winnerSeed = eff.team1.predictedSeed ?? null
            } else if (pStr === 'team2') {
              pStr       = eff.team2.predicted
              winnerSeed = eff.team2.predictedSeed ?? null
            }
          }

          if (isTeamMatch(pStr, game.actual_winner)) {
            internalEntry.correct += 1
            // FIX N-NEW-2: Accumulate seed score for standard brackets.
            // Higher seed = bigger upset = meaningful tiebreaker signal.
            internalEntry.seedScore += Number(winnerSeed) || 0
          }
        }
      }
    }
  }

  // ── REVIVE_ALL POST-PROCESSING PASS ──────────────────────────────
  // FIX M-NEW-3: The mass-revival evaluation now delegates to the shared
  // isMassRevivalRound utility from bracketMath instead of re-implementing
  // the active-picker / eliminated counting logic inline. This ensures
  // the leaderboard and the survivor selector (getIsEliminated) use
  // identical logic and cannot silently diverge after future edits.
  for (const [tid, tournament] of tournamentMap.entries()) {
    if (tournament.game_type !== 'survivor')                     continue
    if (tournament.survivor_elimination_rule !== 'revive_all')   continue

    const tournamentGames    = filteredGames.filter(g => g.tournament_id === tid)
    const allTournamentPicks = allPicks.filter(p =>
      tournamentGames.some(g => g.id === p.game_id),
    )

    const gamesByRound = new Map<number, Game[]>()
    for (const g of tournamentGames) {
      const existing = gamesByRound.get(g.round_num) ?? []
      gamesByRound.set(g.round_num, [...existing, g])
    }
    const sortedRounds = [...gamesByRound.entries()].sort(([a], [b]) => a - b)

    const cumulativeEliminated = new Set<string>()

    for (const [_round, roundGames] of sortedRounds) {
      // Stop processing at the first incomplete round.
      if (!roundGames.every(g => !!g.actual_winner)) break

      // FIX M-NEW-3: Use isMassRevivalRound from shared/lib/bracketMath.
      if (isMassRevivalRound(roundGames, allTournamentPicks, cumulativeEliminated)) {
        // Mass revival — undo elimination flags for everyone in this round.
        for (const pick of allTournamentPicks) {
          if (!new Set(roundGames.map(g => g.id)).has(pick.game_id)) continue
          if (cumulativeEliminated.has(pick.user_id))                 continue
          scores[pick.user_id]?._eliminatedInSurvivorTids.delete(tid)
          scores[pick.user_id]?._firstElimRoundByTid.delete(tid)
        }
      } else {
        // Normal round — mark anyone who lost as cumulatively eliminated.
        const roundGameIds = new Set(roundGames.map(g => g.id))
        for (const pick of allTournamentPicks) {
          if (!roundGameIds.has(pick.game_id))        continue
          if (cumulativeEliminated.has(pick.user_id)) continue

          const game = roundGames.find(g => g.id === pick.game_id)!
          let predictedString = pick.predicted_winner
          if (predictedString === 'team1')      predictedString = game.team1_name
          else if (predictedString === 'team2') predictedString = game.team2_name

          if (!isTeamMatch(predictedString, game.actual_winner)) {
            cumulativeEliminated.add(pick.user_id)
          }
        }
      }
    }
  }

  // ── TIEBREAKER PASS (Standard Brackets, requires_tiebreaker = true) ──
  // FIX M-NEW-2: Populate tiebreakerScore (user's prediction) and
  // _tiebreakerDelta (|predicted - actual|) for each user. Delta is only
  // computable once the championship game has both team scores set.
  for (const [tid, tournament] of tournamentMap.entries()) {
    if (tournament.game_type === 'survivor') continue
    if (!tournament.requires_tiebreaker)     continue

    const tGames = filteredGames.filter(g => g.tournament_id === tid)
    if (!tGames.length) continue

    const maxRound = Math.max(...tGames.map(g => g.round_num))
    const champGame =
      tGames.find(g => g.round_num === maxRound && !g.next_game_id) ??
      tGames.find(g => g.round_num === maxRound)
    if (!champGame) continue

    // Actual combined score — only valid when both team scores are present.
    const actualCombined =
      champGame.team1_score != null && champGame.team2_score != null
        ? (Number(champGame.team1_score) || 0) + (Number(champGame.team2_score) || 0)
        : null

    for (const pick of allPicks) {
      if (pick.game_id !== champGame.id) continue
      if (pick.tiebreaker_score == null) continue

      const entry = scores[pick.user_id]
      if (!entry) continue

      // Store the user's predicted combined score for display in the UI.
      entry.tiebreakerScore = pick.tiebreaker_score

      // Compute delta only once the game has actual scores to compare against.
      if (actualCombined != null) {
        entry._tiebreakerDelta = Math.abs(pick.tiebreaker_score - actualCombined)
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

  const eliminationApplies = viewSurvivorTids.size > 0 && viewStandardTids.size === 0

  // Sort internal entries first (before stripping private fields) so the
  // _tiebreakerDelta internal field is available to the comparator.
  const sortedInternal = Object.values(scores).sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1
    if (b.points       !== a.points)       return b.points - a.points

    // FIX M-NEW-2: Tiebreaker sort — lower absolute delta = closer to actual
    // score = better rank. Null delta (no pick or game not scored) goes last.
    const aDelta = a._tiebreakerDelta
    const bDelta = b._tiebreakerDelta
    if (aDelta !== bDelta) {
      if (aDelta == null && bDelta == null) { /* fall through */ }
      else if (aDelta == null) return 1
      else if (bDelta == null) return -1
      else if (aDelta !== bDelta) return aDelta - bDelta
    }

    // FIX N-NEW-2: seedScore is now meaningful for standard brackets too,
    // so this tier correctly differentiates users tied on points.
    if (b.seedScore !== a.seedScore) return b.seedScore - a.seedScore

    return b.correct - a.correct
  })

  return sortedInternal.map((internalEntry): LeaderboardEntry => {
    const {
      _eliminatedInSurvivorTids,
      _firstElimRoundByTid,
      _tiebreakerDelta,
      ...publicEntry
    } = internalEntry

    if (eliminationApplies) {
      publicEntry.isEliminated = [...viewSurvivorTids].every(tid =>
        _eliminatedInSurvivorTids.has(tid),
      )
    } else {
      publicEntry.isEliminated = false
    }

    return publicEntry
  })
}