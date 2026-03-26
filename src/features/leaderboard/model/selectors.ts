import {
  deriveEffectiveNames,
  calculateLocalScore,
  isTeamMatch,
  isMassRevivalRound,
}                          from '../../../shared/lib/bracketMath'
import type { Pick, Game, Profile, Tournament } from '../../../shared/types'
import type { LeaderboardRaw }                  from '../../../entities/leaderboard/api'

export interface LeaderboardEntry {
  profile:         Profile
  points:          number
  correct:         number
  total:           number
  maxPossible:     number
  isEliminated:    boolean
  seedScore:       number
  tiebreakerScore: number | null
}

interface InternalEntry extends LeaderboardEntry {
  _eliminatedInSurvivorTids: Set<string>
  _firstElimRoundByTid:      Map<string, number>
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

  // ── NON-PARTICIPANT FILTER ──────────────────────────────────
  // If a user has made 0 picks across the scoped tournaments, they
  // should not appear on the leaderboard at all.
  // However, if they made a pick in R1 but missed R2, they WILL have
  // picks in `allPicks`, meaning they bypass this filter and get
  // correctly eliminated by the Ghost Loophole pass below.
  const activeUserIds = new Set(allPicks.map(p => p.user_id))
  const activeProfiles = allProfiles.filter(p => activeUserIds.has(p.id))

  activeProfiles.forEach(p => {
    scores[p.id] = {
      profile:                   p,
      points:                    0,
      correct:                   0,
      total:                     0,
      maxPossible:               0,
      isEliminated:              false,
      seedScore:                 0,
      tiebreakerScore:           null, 
      _eliminatedInSurvivorTids: new Set(),
      _firstElimRoundByTid:      new Map(),
      _tiebreakerDelta:          null, 
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

      internalEntry.points      += s.current
      internalEntry.maxPossible += s.max

      for (const pick of tPicks) {
        const game = tGames.find(g => g.id === pick.game_id)
        if (game?.actual_winner) {
          let pStr      = pick.predicted_winner
          const eff     = effNames[game.id]
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
            internalEntry.seedScore += Number(winnerSeed) || 0
          }
        }
      }
    }
  }

  // ── GHOST LOOPHOLE PASS (No-Pick Elimination) ────────────────
  for (const [tid, tournament] of tournamentMap.entries()) {
    if (tournament.game_type !== 'survivor') continue

    const tGames          = filteredGames.filter(g => g.tournament_id === tid)
    const sortedRoundNums = [...new Set(tGames.map(g => g.round_num))].sort(
      (a, b) => a - b,
    )

    const pickedRoundsByUser = new Map<string, Set<number>>()
    for (const pick of allPicks) {
      const game = tGames.find(g => g.id === pick.game_id)
      if (!game) continue
      const existing = pickedRoundsByUser.get(pick.user_id) ?? new Set<number>()
      existing.add(game.round_num)
      pickedRoundsByUser.set(pick.user_id, existing)
    }

    for (const [uid, entry] of Object.entries(scores)) {
      if (entry._eliminatedInSurvivorTids.has(tid)) continue

      const pickedRounds = pickedRoundsByUser.get(uid) ?? new Set<number>()

      for (const r of sortedRoundNums) {
        const roundGames = tGames.filter(g => g.round_num === r)
        if (!roundGames.every(g => !!g.actual_winner)) break
        
        if (!pickedRounds.has(r)) {
          entry._eliminatedInSurvivorTids.add(tid)
          entry._firstElimRoundByTid.set(tid, r)
          break
        }
      }
    }
  }

  // ── REVIVE_ALL POST-PROCESSING PASS ──────────────────────────────
  for (const [tid, tournament] of tournamentMap.entries()) {
    if (tournament.game_type !== 'survivor')                    continue
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
      if (!roundGames.every(g => !!g.actual_winner)) break

      if (isMassRevivalRound(roundGames, allTournamentPicks, cumulativeEliminated)) {
        for (const pick of allTournamentPicks) {
          if (!new Set(roundGames.map(g => g.id)).has(pick.game_id)) continue
          if (cumulativeEliminated.has(pick.user_id))                 continue
          scores[pick.user_id]?._eliminatedInSurvivorTids.delete(tid)
          scores[pick.user_id]?._firstElimRoundByTid.delete(tid)
        }
      } else {
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

    const actualCombined =
      champGame.team1_score != null && champGame.team2_score != null
        ? (Number(champGame.team1_score) || 0) + (Number(champGame.team2_score) || 0)
        : null

    for (const pick of allPicks) {
      if (pick.game_id !== champGame.id) continue
      if (pick.tiebreaker_score == null) continue

      const entry = scores[pick.user_id]
      if (!entry) continue

      entry.tiebreakerScore = pick.tiebreaker_score

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

  const sortedInternal = Object.values(scores).sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1
    if (b.points       !== a.points)       return b.points - a.points

    const aDelta = a._tiebreakerDelta
    const bDelta = b._tiebreakerDelta
    if (aDelta !== bDelta) {
      if (aDelta == null && bDelta == null) { /* fall through */ }
      else if (aDelta == null) return 1
      else if (bDelta == null) return -1
      else if (aDelta !== bDelta) return aDelta - bDelta
    }

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

export function selectGroupLeaderboards(
  rawData:     LeaderboardRaw,
  tournaments: Tournament[],
  members:     Array<{ user_id: string }>,
) {
  if (!rawData || !tournaments.length) return { standard: [], survivor: [] }
  const standardTourneys = tournaments.filter(t => t.game_type !== 'survivor')
  const survivorTourneys = tournaments.filter(t => t.game_type === 'survivor')
  const memberUserIds    = new Set(members.map(m => m.user_id))
  const groupProfiles    = rawData.allProfiles.filter((p: Profile) => memberUserIds.has(p.id))

  const getBoard = (tList: Tournament[]) => {
    const tMap    = new Map(tList.map(t => [t.id, t]))
    const games   = rawData.allGames.filter((g: Game) => tMap.has(g.tournament_id))
    const gameIds = new Set(games.map((g: Game) => g.id))
    const picks   = rawData.allPicks.filter((p: Pick) => gameIds.has(p.game_id))
    return computeLeaderboard(picks, games, rawData.allGames, groupProfiles, tMap)
  }

  return { standard: getBoard(standardTourneys), survivor: getBoard(survivorTourneys) }
}